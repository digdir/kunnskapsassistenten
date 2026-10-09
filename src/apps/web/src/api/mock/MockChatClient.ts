import {
  emptyFilterSelection,
  type AgentList,
  type ChatErrorCode,
  type FilterFacet,
  type FilterSelection,
  type SourceDocument,
  type StreamEvent,
  type Thread,
  type ThinkingStep,
  type ThreadDetail,
} from '../../model';
import { facetsFor } from './corpus/facets';
import { corpusDocumentsFor } from './corpus';
import {
  WIKIPEDIA_MOCK_ANSWER,
  WIKIPEDIA_MOCK_KEY,
  wikipediaMockSources,
} from './corpus/wikipedia';
import { activeCorpusKey } from '../corpus';
import { citationsFor, scriptedFor } from './conversations';
import {
  mockThreadDetail,
  mockThreadList,
  newMockThreadId,
  openMockThread,
  recordMockTurn,
} from './sessionThreads';
import type { AskParams, ChatClient, ThreadCertainty } from '../chatClient';
import {
  citedNumbers,
  narrowToSelection,
  retrievalFor,
  shiftCitations,
  withOnlyCitations,
} from './filtering';
import {
  findThread,
  mockAnswerMarkdown,
  nkomCitations,
  nkomRetrieval,
  nkomSources,
  nkomThinkingSteps,
  threads,
  userDocumentSource,
} from './fixtures';
import { userDocuments } from '../userDocuments';

// The reader's attached documents as sources. An unknown id (removed before sending) is
// skipped, as a real backend would answer without it.
function attachedSources(attachments: string[] | undefined): SourceDocument[] {
  if (!attachments?.length) return [];
  const known = new Map(userDocuments().map((document) => [document.id, document]));

  return attachments
    .map((id) => known.get(id))
    .filter((document) => document !== undefined)
    .map((document, index) => userDocumentSource(document, index + 1));
}

// Renumber cited excerpts by position, since a citation number IS that position.
function renumber(documents: SourceDocument[]): SourceDocument[] {
  let next = 1;
  return documents.map((document) => ({
    ...document,
    excerpts: document.excerpts.map((excerpt) =>
      excerpt.citationNumber === undefined ? excerpt : { ...excerpt, citationNumber: next++ },
    ),
  }));
}

// A first line citing the attached documents, one marker per excerpt, so every number in the
// panel has a marker in the text.
function attachmentSentence(attached: SourceDocument[]): string {
  if (attached.length === 0) return '';

  const markers = attached
    .flatMap((document) => document.excerpts)
    .map((excerpt) => `[${excerpt.citationNumber}]`)
    .join('');
  const names = attached.map((document) => `«${document.title}»`).join(', ');

  return `Svaret er også bygget på dokumentet du la ved, ${names}.${markers}\n\n`;
}

export interface MockDelays {
  /** Between thinking steps. */
  thinkingStepMs: number;
  /** Before the first token, once the thinking steps are done. */
  firstTokenMs: number;
  /** Between tokens. */
  tokenMs: number;
  /** Between the last token and the sources. */
  sourcesMs: number;
  /** For listThreads, getThread and listFacets. */
  requestMs: number;
}

/**
 * How fast the mock answers (`VITE_MOCK_SPEED`, see src/api/index.ts).
 * `realistic` is close to a real agent so loading states are visible; `fast`
 * is for the end-to-end suite; `slow` is for looking hard at one state.
 */
export const mockSpeeds = {
  // Quick, not instant: the end-to-end suite is written against these, and testing stop needs
  // an answer that is still arriving.
  fast: {
    thinkingStepMs: 500,
    firstTokenMs: 300,
    tokenMs: 18,
    sourcesMs: 400,
    requestMs: 250,
  },
  realistic: {
    thinkingStepMs: 1100, // target 0,8–1,5 s
    firstTokenMs: 3800, // 3–5 s after the last thinking step
    tokenMs: 25,
    sourcesMs: 500,
    requestMs: 350,
  },
  slow: {
    thinkingStepMs: 2500,
    firstTokenMs: 7000,
    tokenMs: 60,
    sourcesMs: 1200,
    requestMs: 800,
  },
} as const satisfies Record<string, MockDelays>;

export type MockSpeed = keyof typeof mockSpeeds;

export const defaultMockSpeed: MockSpeed = 'realistic';

export const defaultMockDelays: MockDelays = mockSpeeds[defaultMockSpeed];

/**
 * Ask this exact question and the mock fails, so the error path is reachable
 * from a built app. Not an env flag: Vite inlines those and the suite builds
 * once. Exact, because «hva er feil i rapporten» needs a real answer.
 */
export const MOCK_FAILURE_QUERY = 'simuler feil';

/**
 * Ask this and the answer is a link with no space, wider than a phone, for the
 * no-sideways-scroll check (tests/e2e/viewport-fit.spec.ts). Short, so the
 * check measures the link and not the streaming.
 */
export const MOCK_LONG_LINK_QUERY = 'simuler lang lenke';

/** The link in the answer to `MOCK_LONG_LINK_QUERY`: 175 characters, no space. */
export const MOCK_LONG_LINK =
  'https://kudos.dfo.no/dokument/987461a2-6260-4deb-ab9b-296056dac256?utdrag=arsrapport-2024-kapittel-3-maloppnaelse-og-resultater-for-kommunikasjonsmyndigheten&visning=fulltekst';

/**
 * One exact question per error code, so each case can be seen from a built
 * app; the backend does not send the codes yet. `simuler feil` is `unknown`.
 */
export const MOCK_ERROR_QUERIES: Readonly<Record<string, ChatErrorCode>> = {
  [MOCK_FAILURE_QUERY]: 'unknown',
  'simuler feil modell': 'model-unavailable',
  'simuler feil korpus': 'retrieval-unavailable',
  'simuler tidsavbrudd': 'timeout',
  'simuler ingen treff': 'no-hits',
  'simuler avvist nøkkel': 'unauthorized',
};

/**
 * Ask this and the mock asks back instead of answering, so
 * `needs-clarification` (reported in `_meta.status`) can be seen from a built
 * app. It is a question to the user, so it carries no sources or citations.
 */
export const MOCK_CLARIFICATION_QUERY = 'simuler avklaring';

const clarificationMarkdown = [
  'Jeg trenger litt mer for å svare godt på dette.',
  '',
  'Mener du måloppnåelsen slik den er rapportert i årsrapportene, eller slik',
  'den er satt opp som mål i tildelingsbrevene? De to henger sammen, men',
  'tallene står forskjellige steder.',
].join('\n');

// Generic, so it is true of whatever was asked; for codes other than `no-hits` the `error` frame
// says where it stopped. `thinkingMs` is the wait about to happen, right at any speed.
function failureThinkingStep(code: ChatErrorCode, query: string, thinkingMs: number): ThinkingStep {
  return {
    id: 'mock-feil-1',
    kind: 'search',
    label: 'Jeg søker i korpuset',
    queries: [query],
    ...(code === 'no-hits' ? { detail: 'Ingen utdrag kom over relevansterskelen.' } : {}),
    durationMs: thinkingMs,
  };
}

// The agent saw two answers in two places and asks rather than picks. `durationMs` matches the
// delay the view measures live, so the number survives a reload.
function clarificationThinkingStep(thinkingMs: number): ThinkingStep {
  return {
    id: 'mock-avklaring-1',
    kind: 'reasoning',
    label: 'Jeg leser spørsmålet',
    detail:
      'Måloppnåelse står både i årsrapportene og i tildelingsbrevene, og de to svarene er ikke det samme. Jeg spør heller enn å velge for leseren.',
    durationMs: thinkingMs,
  };
}

/** Resolves after `ms`, or rejects with the abort reason if the signal fires. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason);
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// Word-sized tokens that keep trailing whitespace. Finer than the backend flushes (paragraphs or
// every 250 ms), to expose streaming bugs.
function tokenize(markdown: string): string[] {
  return markdown.match(/\S+\s*/g) ?? [];
}

let answerCounter = 0;

// Not the clock alone: two answers in the same millisecond would share an id, and React could
// not tell the stored messages apart.
function nextMessageId(): string {
  answerCounter += 1;
  return `msg-${Date.now()}-${answerCounter}`;
}

/**
 * Three of the agents the BFF lists, with its names and descriptions
 * (`api/bff/fixtures/models.json` in the BFF), so the agent choice can be
 * seen and tested. The mock answers the same whichever is chosen.
 */
export const MOCK_AGENTS: AgentList = {
  agents: [
    {
      id: 'builtin/agent-rag-agent',
      label: 'agent-rag',
      description: 'General-purpose agentic retrieval assistant.',
      model: 'builtin.agent-rag-agent__agent-rag-graph-bundled',
    },
    {
      id: 'builtin/research-assistant-agent',
      label: 'research-assistant',
      description:
        'Breadth-first retrieval with a synthesis-heavy answer, for questions that want a survey of the sources rather than a single fact.',
      model: 'builtin.research-assistant-agent__agent-rag-graph-faithful',
    },
    {
      id: 'builtin/fact-checker-agent',
      label: 'fact-checker',
      description: 'Verification-focused agent for checking claims against evidence.',
      model: 'builtin.fact-checker-agent__fact-checker',
    },
  ],
  defaultId: 'builtin/agent-rag-agent',
};

/**
 * A backend that is not there: thinking steps, tokens and sources in the live
 * client's order and shape. A stop ends with an `aborted` error event, not a
 * throw, so callers have one path; turns are kept per tab (sessionThreads.ts).
 */
export class MockChatClient implements ChatClient {
  readonly #delays: MockDelays;

  constructor(delays: Partial<MockDelays> = {}) {
    this.#delays = { ...defaultMockDelays, ...delays };
  }

  async *ask(params: AskParams): AsyncIterable<StreamEvent> {
    const { signal } = params;
    // What has actually been said, so a turn the reader stopped can be
    // remembered as the half-answer it is rather than dropped.
    let written = '';

    // Read once, as the live client does, so a switch mid-stream cannot mix corpora. Spread so an
    // unconfigured mock records no key («not known»).
    const corpusKey = activeCorpusKey();
    const askedOf = corpusKey ? { corpusKey } : {};

    // Outside the `try`: the `catch` stores a stopped turn with its steps. `thoughtAtFirstToken`
    // is set only at the first word, so the store never holds a number the screen did not show.
    const stepsSent: ThinkingStep[] = [];
    let thoughtAtFirstToken: { thoughtMs: number } | undefined;
    // The clock over the thinking, so the stored turn has the wait the reader sat through.
    let thinkingStartedAt: number | undefined;
    const thoughtMs = () =>
      thinkingStartedAt === undefined ? undefined : { thoughtMs: Date.now() - thinkingStartedAt };
    try {
      const simulated = MOCK_ERROR_QUERIES[params.query.trim().toLocaleLowerCase('nb-NO')];
      if (simulated) {
        // After a thinking step, not instantly: the views must go through «an
        // answer was under way and then it was not». An empty search also
        // searched first, and the thinking panel says so.
        await wait(this.#delays.thinkingStepMs, signal);
        thinkingStartedAt = Date.now();
        const failureStep = failureThinkingStep(simulated, params.query, this.#delays.firstTokenMs);
        stepsSent.push(failureStep);
        yield { type: 'thinking-step', step: failureStep };
        await wait(this.#delays.firstTokenMs, signal);
        // Stored with its steps and failed status, so a reload does not leave
        // the question with nothing under it.
        const failedAt = new Date().toISOString();
        recordMockTurn({
          question: params.query,
          answerId: nextMessageId(),
          answer: {
            content: '',
            citations: [],
            createdAt: failedAt,
            thinkingSteps: [...stepsSent],
            ...askedOf,
            status: 'error',
          },
        });
        // No `message`: the text must come from the code, or the mock tests its own wording.
        yield { type: 'error', error: { code: simulated }, createdAt: failedAt, ...askedOf };
        return;
      }

      if (params.query.trim().toLocaleLowerCase('nb-NO') === MOCK_CLARIFICATION_QUERY) {
        // One thinking step, then the question back. No `sources` event:
        // nothing was retrieved.
        await wait(this.#delays.thinkingStepMs, signal);
        thinkingStartedAt = Date.now();
        const clarificationStep = clarificationThinkingStep(this.#delays.firstTokenMs);
        stepsSent.push(clarificationStep);
        yield { type: 'thinking-step', step: clarificationStep };

        await wait(this.#delays.firstTokenMs, signal);
        const clarificationThought = thoughtMs();
        for (const text of tokenize(clarificationMarkdown)) {
          await wait(this.#delays.tokenMs, signal);
          written += text;
          yield { type: 'token', text };
        }

        const clarificationId = nextMessageId();
        // One turn, one time: shared by the store and the `done` frame, so the
        // answer reads the same after a reload.
        const clarificationAt = new Date().toISOString();
        recordMockTurn({
          question: params.query,
          answerId: clarificationId,
          // No sources: nothing was retrieved.
          answer: {
            content: written,
            citations: [],
            createdAt: clarificationAt,
            ...clarificationThought,
            ...askedOf,
            status: 'needs-clarification',
          },
        });
        yield {
          type: 'done',
          messageId: clarificationId,
          conversationId: params.conversationId ?? 'conv-nkom-1',
          createdAt: clarificationAt,
          outcome: 'needs-clarification',
          ...askedOf,
        };
        return;
      }

      // A cached answer when the question has one (conversations/scripts.ts), sent
      // through the same sequence as the default answer.
      const scripted = scriptedFor(params.query);

      // The filter narrows scripted and default answers alike (filtering.ts). Attached documents
      // come first, so `[1]` is the reader's own file.
      const wikipedia = corpusKey === WIKIPEDIA_MOCK_KEY;
      const attached = attachedSources(params.attachments);
      const fromCorpus = narrowToSelection(
        wikipedia ? wikipediaMockSources : (scripted?.documents ?? nkomSources),
        params.filters,
      );
      const documents = attached.length === 0 ? fromCorpus : renumber([...attached, ...fromCorpus]);
      const cited = citedNumbers(documents);

      // Attached documents take the first numbers, so every corpus `[n]` in the text must shift by
      // this, or each claim points one document too early.
      const attachedExcerpts = attached.reduce(
        (total, document) => total + document.excerpts.length,
        0,
      );

      const steps = scripted?.thinkingSteps ?? nkomThinkingSteps;
      for (const step of steps) {
        await wait(this.#delays.thinkingStepMs, signal);
        thinkingStartedAt ??= Date.now();
        stepsSent.push(step);
        yield { type: 'thinking-step', step };
      }

      // A question that fails does it after the thinking steps, the way the
      // real one does: an answer was under way and then it was not.
      if (scripted?.failure) {
        await wait(this.#delays.firstTokenMs, signal);
        // Stored without the error code (the store has no field for it), so the restored card
        // says less than the alert did. See `FAILED_NOTE`.
        const failedAt = new Date().toISOString();
        recordMockTurn({
          question: params.query,
          answerId: nextMessageId(),
          answer: {
            content: '',
            citations: [],
            createdAt: failedAt,
            thinkingSteps: [...stepsSent],
            ...askedOf,
            status: 'error',
          },
        });
        yield { type: 'error', error: scripted.failure, createdAt: failedAt, ...askedOf };
        return;
      }

      await wait(this.#delays.firstTokenMs, signal);
      const thought = thoughtMs();
      thoughtAtFirstToken = thought;
      // Without the attachment sentence, source 1 would be a number the text never refers to.
      const longLink = params.query.trim().toLocaleLowerCase('nb-NO') === MOCK_LONG_LINK_QUERY;
      const baseAnswer = wikipedia
        ? WIKIPEDIA_MOCK_ANSWER
        : longLink
          ? `Hele kapitlet ligger her: ${MOCK_LONG_LINK}`
          : (scripted?.answer ?? mockAnswerMarkdown);
      const answer = withOnlyCitations(
        attachmentSentence(attached) + shiftCitations(baseAnswer, attachedExcerpts),
        cited,
      );

      for (const text of tokenize(answer)) {
        await wait(this.#delays.tokenMs, signal);
        written += text;
        yield { type: 'token', text };
      }

      // No sources event for a clarification: nothing was retrieved. Asked of
      // the script, not of `documents`: an answer the filter narrowed to
      // nothing is not a question back.
      if (scripted && scripted.documents.length === 0) {
        const scriptedId = nextMessageId();
        const scriptedAt = new Date().toISOString();
        recordMockTurn({
          question: params.query,
          answerId: scriptedId,
          answer: {
            content: written,
            citations: [],
            createdAt: scriptedAt,
            thinkingSteps: steps,
            ...thought,
            ...askedOf,
            status: scripted.outcome ?? 'complete',
          },
        });
        yield {
          type: 'done',
          messageId: scriptedId,
          conversationId: params.conversationId ?? 'conv-nkom-1',
          createdAt: scriptedAt,
          ...(scripted.outcome ? { outcome: scripted.outcome } : {}),
          ...askedOf,
        };
        return;
      }

      const citations = (scripted ? citationsFor(scripted) : nkomCitations).filter((citation) =>
        cited.has(citation.number),
      );
      const retrieval = retrievalFor(documents, scripted?.retrieval ?? nkomRetrieval);

      await wait(this.#delays.sourcesMs, signal);
      yield { type: 'sources', documents, citations, retrieval };

      // Stored as streamed, from these locals, or a reload shows default or unfiltered sources.
      const messageId = nextMessageId();
      const answeredAt = new Date().toISOString();
      recordMockTurn({
        question: params.query,
        answerId: messageId,
        answer: {
          content: written,
          citations,
          createdAt: answeredAt,
          sources: documents,
          retrieval,
          thinkingSteps: steps,
          ...thought,
          ...askedOf,
          status: scripted?.outcome ?? 'complete',
        },
      });
      yield {
        type: 'done',
        messageId,
        conversationId: params.conversationId ?? 'conv-nkom-1',
        createdAt: answeredAt,
        ...(scripted?.outcome ? { outcome: scripted.outcome } : {}),
        ...askedOf,
      };
    } catch {
      // Stored as `aborted`, matching `useChat` (keep them in step), even before the first word:
      // the stopped card is drawn for an empty turn too.
      // One turn, one time, as on the `done` path.
      const stoppedAt = new Date().toISOString();
      if (signal?.aborted) {
        recordMockTurn({
          question: params.query,
          answerId: nextMessageId(),
          answer: {
            content: written,
            citations: [],
            createdAt: stoppedAt,
            // The steps so far, so the restored card shows the same
            // «Tenkte i N sekunder» as before the reload.
            ...(stepsSent.length > 0 ? { thinkingSteps: [...stepsSent] } : {}),
            ...(thoughtAtFirstToken ?? {}),
            ...askedOf,
            status: 'aborted',
          },
        });
      }
      yield {
        type: 'error',
        error: signal?.aborted ? { code: 'aborted' } : { code: 'unknown' },
        createdAt: stoppedAt,
        ...askedOf,
      };
    }
  }

  /** Which conversation the next questions belong to; see sessionThreads.ts. */
  openThread(thread: Thread, certainty?: ThreadCertainty): void {
    openMockThread(thread, certainty);
  }

  /** Mints its own ids, as the backend does. No delay or failure, so tests cover the real flow. */
  async createThread(thread: Thread): Promise<Thread> {
    const id = newMockThreadId();
    return { ...thread, id, conversationId: id };
  }

  async listThreads(signal?: AbortSignal): Promise<Thread[]> {
    await wait(this.#delays.requestMs, signal);
    return mockThreadList(threads);
  }

  async getThread(threadId: string, signal?: AbortSignal): Promise<ThreadDetail | null> {
    await wait(this.#delays.requestMs, signal);
    return mockThreadDetail(threadId, findThread(threadId));
  }

  /** Facets from the selected corpus, conditioned on what is ticked. See corpus/facets.ts. */
  async listFacets(signal?: AbortSignal, selection?: FilterSelection): Promise<FilterFacet[]> {
    await wait(this.#delays.requestMs, signal);
    // From the selected corpus, so a switch changes what the filter panel offers.
    return facetsFor(selection ?? emptyFilterSelection, corpusDocumentsFor(activeCorpusKey()));
  }

  async listAgents(signal?: AbortSignal): Promise<AgentList> {
    await wait(this.#delays.requestMs, signal);
    return MOCK_AGENTS;
  }
}
