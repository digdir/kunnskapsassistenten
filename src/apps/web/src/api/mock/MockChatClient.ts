import {
  emptyFilterSelection,
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

/**
 * The reader's own documents this question was asked with, as sources.
 *
 * Read from the store rather than passed in, because `AskParams.attachments`
 * carries ids and the names live with the documents. An id the store does not
 * know is skipped in silence: it is a document removed between the question
 * being typed and sent, and a mock that threw there would fail a turn a real
 * backend would simply answer without it.
 */
function attachedSources(attachments: string[] | undefined): SourceDocument[] {
  if (!attachments?.length) return [];
  const known = new Map(userDocuments().map((document) => [document.id, document]));

  return attachments
    .map((id) => known.get(id))
    .filter((document) => document !== undefined)
    .map((document, index) => userDocumentSource(document, index + 1));
}

/**
 * Renumber every excerpt by its position in the flat list.
 *
 * A citation number IS that position — `[3]` means the third excerpt of the
 * answer — so putting documents in front of others moves the rest along. Only
 * excerpts that carry a number are renumbered: one the answer never cited
 * keeps having none.
 */
function renumber(documents: SourceDocument[]): SourceDocument[] {
  let next = 1;
  return documents.map((document) => ({
    ...document,
    excerpts: document.excerpts.map((excerpt) =>
      excerpt.citationNumber === undefined ? excerpt : { ...excerpt, citationNumber: next++ },
    ),
  }));
}

/**
 * A first line that cites the documents the reader attached.
 *
 * Mock data saying so about itself, in the words rather than in chrome:
 * nothing draws this sentence as a label, so a screenshot has to read as what
 * it is. One marker per attached excerpt, in order, so every number in the
 * panel has something in the text pointing at it.
 */
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
 * How fast the mock answers, as three settings rather than a number.
 *
 * `realistic` is the default and the reason this exists: a mock that answers
 * instantly cannot show what it is supposed to show. Lars asked to see the
 * skeletons, the thinking panel and the streaming actually happen, and at
 * 500 ms per thinking step and 18 ms per token the whole thing was over
 * before any of them registered. These numbers are what a real agent takes —
 * measured against the running stack on 2026-09-11, one question took 15,1
 * seconds, 15,1 of them inside the agent.
 *
 * `fast` is for the end-to-end suite, which tests what the app does and not
 * how long it takes: 56 tests each waiting out a realistic answer is minutes
 * of nothing. `slow` is for looking hard at one state.
 *
 * Chosen with `VITE_MOCK_SPEED`; see src/api/index.ts.
 */
export const mockSpeeds = {
  /*
   * Quick, not instant. These are the delays the mock had before there were
   * three settings, and the end-to-end suite is written against them.
   *
   * Zero was tried and is wrong: «avbryt stopper genereringen og beholder
   * teksten som kom» needs an answer that is still arriving when the stop
   * button is pressed, and at zero the whole thing is over before the test
   * can press anything. A mock that streams instantly does not stream.
   */
  fast: {
    thinkingStepMs: 500,
    firstTokenMs: 300,
    tokenMs: 18,
    sourcesMs: 400,
    requestMs: 250,
  },
  realistic: {
    thinkingStepMs: 1100, // the brief asks for 0,8–1,5 s
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
 * Ask this and the mock fails instead of answering.
 *
 * The error path has no other way in from a built app: the mock never fails
 * on its own, so «Prøv igjen» and the alert region could not be reached by an
 * end-to-end test or shown to a designer without swapping in a live backend
 * that is down. An environment flag would have meant a second build, since
 * Vite substitutes those at build time and the suite builds once.
 *
 * An exact match on the whole question, not a word inside it: «hva er feil i
 * rapporten» is a real question and has to get a real answer.
 */
export const MOCK_FAILURE_QUERY = 'simuler feil';

/**
 * One question per error code, so each of the cases can be seen.
 *
 * The frontend now says something different for a model that is down, a
 * corpus that is down, a request that timed out, a key that was rejected and
 * a search that found nothing — and none of those five could be reached from
 * a built app before, for the same reason `MOCK_FAILURE_QUERY` exists. The
 * backend does not send the codes yet either (API-bestilling A16), so this is
 * the only way in until it does.
 *
 * `simuler feil` keeps its old meaning, `unknown`: the generic failure the
 * end-to-end suite and the brukerblikk tests already ask for by name. The
 * longer phrases are exact matches too, so `simuler feil modell` is its own
 * question and not a prefix match on the short one.
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
 * Ask this and the mock answers with a question back instead of an answer.
 *
 * Same reasoning as the failure query: `needs-clarification` is a real state
 * the backend reports in `_meta.status`, and without a way in from a built app
 * neither an end-to-end test nor a designer could ever see what it looks like.
 * The text is what that state IS — a question to the user — so it carries no
 * sources and no citations, and nothing here pretends otherwise.
 */
export const MOCK_CLARIFICATION_QUERY = 'simuler avklaring';

const clarificationMarkdown = [
  'Jeg trenger litt mer for å svare godt på dette.',
  '',
  'Mener du måloppnåelsen slik den er rapportert i årsrapportene, eller slik',
  'den er satt opp som mål i tildelingsbrevene? De to henger sammen, men',
  'tallene står forskjellige steder.',
].join('\n');

/**
 * The thinking step a simulated failure shows.
 *
 * All six codes used to yield `nkomThinkingSteps[0]` — «Jeg deler spørsmålet i
 * to: hvordan måloppnåelse gjøres opp, og hvor målene er satt» — so asking
 * «simuler avvist nøkkel» and opening «Tenkte» explained a question nobody
 * had asked. Brukerblikk runde 3, funn 4.
 *
 * What repairs it is the LABEL. «Jeg søker i korpuset» is true of whatever was
 * asked, where the old one described one particular question in detail.
 *
 * `queries` carries the reader's own words beside it, and nothing draws them
 * today — `ThinkingPanel` renders `label` and `detail` and stops there (KA CC,
 * 2026-09-16). It is here because it is the field the words belong in when a
 * view does draw them, and because the stream is read by more than the panel;
 * it is not what makes the screen right, and this comment used to claim it
 * was.
 *
 * `no-hits` is the one code that says what came back, and that is the
 * difference the model file draws: the search RAN and found nothing, which is
 * an answer with an empty source list rather than a failure. The others
 * stopped somewhere inside this step, and the `error` frame is what says
 * where — a step that also said it would be doing the view's job a second
 * time, in the mock's wording instead of the view's.
 *
 * `thinkingMs` is the wait this mock is about to perform, not a number
 * written down beside it. It has to be, and that is the second half of funn 4:
 * a failed turn has no first token, so the view's own clock never closes and
 * the summary falls back to what the steps reported. A constant would have
 * said «Tenkte i 2 sekunder» after the 4,9 s the realistic speed actually
 * waits, and «Tenkte i 2 sekunder» after the 0,8 s the fast one does. Taken
 * from the delays it is true at every speed — and the turns that used to say
 * «Tenkte» with no number now say the same kind of thing a finished answer
 * does, which is the rest of that finding.
 *
 * Nothing here for `aborted`. That is the reader pressing stop, never one of
 * these queries, and a turn they stopped keeps the steps it had already been
 * shown.
 */
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

/**
 * The thinking step behind the question back.
 *
 * Its own, and not the failure one: a clarification is not a turn that broke.
 * The agent read the question, saw that it has two answers in two different
 * places, and decided that picking one for the reader would look like an
 * answer. That is what `clarificationMarkdown` above says in the answer, and
 * this is the same reasoning one step earlier.
 *
 * This turn does reach a first token, so the view measures the wait itself
 * while the reader watches. `durationMs` is what is left after a reload, and
 * it comes from the same delay for the same reason as above: the two readings
 * should not disagree about a turn that has not changed.
 */
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

/**
 * Split into tokens that keep their trailing whitespace, so joining them back
 * reproduces the markdown exactly. Roughly word-sized, which is finer than
 * the real backend flushes (it batches at paragraph boundaries or every
 * 250 ms) — deliberately, because it makes streaming bugs visible.
 */
function tokenize(markdown: string): string[] {
  return markdown.match(/\S+\s*/g) ?? [];
}

let answerCounter = 0;

/**
 * An id for one answer. The clock alone was not enough: two questions asked
 * inside the same millisecond produced the same id, and the stored thread
 * then had two messages React could not tell apart.
 */
function nextMessageId(): string {
  answerCounter += 1;
  return `msg-${Date.now()}-${answerCounter}`;
}

/**
 * A backend that is not there. Streams the NKOM answer token by token with
 * thinking steps first and sources last, in the same order and shape the live
 * client will produce.
 *
 * It honours the document filter, which the real backend does not yet. See
 * filtering.ts for why that belongs here and not only in a test.
 *
 * Cancellation surfaces as a final `error` event with code `aborted` rather
 * than a thrown exception, so a caller has one code path for «the answer
 * stopped» regardless of why.
 *
 * It also remembers: every turn that produced text is written into the open
 * thread in `sessionStorage`, so a reload finds the conversation again and
 * the thread list shows it. See sessionThreads.ts for why a mock does this
 * and the live client does not.
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

    /*
     * Which corpus this question is asked of, read once and used for
     * everything below: which fixtures answer, what is written into the
     * store, and what every exit frame reports.
     *
     * Once, and up here, for the reason the live client resolves its dataset
     * once per question. The read used to sit down where the fixtures are
     * picked — after the thinking steps have gone out — so a switch during a
     * stream could have chosen one corpus's documents and filed the turn
     * under the other's. Switching navigates away and cancels the stream
     * today, but a turn whose sources do not match its label is not worth
     * leaving to timing.
     *
     * Spread rather than assigned, so an unconfigured mock records no key at
     * all: undefined means «not known», and a field that is absent says that
     * where a field holding `undefined` would be written into
     * `sessionStorage` as `null`.
     */
    const corpusKey = activeCorpusKey();
    const askedOf = corpusKey ? { corpusKey } : {};

    /*
     * The steps that have actually gone out, and the wait up to the first
     * word. Both live out here rather than inside the `try`, because the
     * `catch` is where a stopped turn is written down and it needs them.
     *
     * A turn stopped during «Tenker …» came back from a reload without its
     * thinking panel: the card said it had been stopped and offered to run
     * again, but the part that said how long it had taken and how far it got
     * was gone. That is the part the reader who stopped BECAUSE it was slow
     * was looking at (brukerblikk 3, funn 6).
     *
     * `thoughtAtFirstToken` is set where the first word goes out and nowhere
     * else, so it exists for exactly the turns whose live copy has it. Giving
     * a stopped-before-the-first-word turn a measured number here would make
     * the store say something the screen does not — «Tenkte i 6 sekunder»
     * before a reload and a different number after, which is runde 2 punkt 5
     * all over again.
     */
    const stepsSent: ThinkingStep[] = [];
    let thoughtAtFirstToken: { thoughtMs: number } | undefined;
    /*
     * The clock over the thinking, so the turn written into `sessionStorage`
     * carries the wait the reader actually sat through. Without it a reloaded
     * conversation showed the sum of the steps' own `durationMs` instead —
     * a different number for a turn that had not changed (brukerblikk runde
     * 2, funn 5). The view measures the same interval off the stream; both
     * are the same clock over the same two events.
     */
    let thinkingStartedAt: number | undefined;
    const thoughtMs = () =>
      thinkingStartedAt === undefined ? undefined : { thoughtMs: Date.now() - thinkingStartedAt };
    try {
      const simulated = MOCK_ERROR_QUERIES[params.query.trim().toLocaleLowerCase('nb-NO')];
      if (simulated) {
        // After a thinking step, not instantly: a failure that arrives before
        // anything has happened does not exercise the state the views go
        // through, which is «an answer was under way and then it was not».
        // The same holds for a search that came back empty — it searched
        // first, and the thinking panel is what says so.
        await wait(this.#delays.thinkingStepMs, signal);
        thinkingStartedAt = Date.now();
        const failureStep = failureThinkingStep(simulated, params.query, this.#delays.firstTokenMs);
        stepsSent.push(failureStep);
        yield { type: 'thinking-step', step: failureStep };
        await wait(this.#delays.firstTokenMs, signal);
        /*
         * Written down like any other turn, with its thinking steps and the
         * status that says it failed. Failures were the one kind of turn the
         * store never saw, so a reload left the question with nothing under
         * it at all — see the note on the other failure path below.
         */
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
        // No `message`: the whole point is that the text comes from the code,
        // so a mock that wrote its own would be testing the mock's wording.
        yield { type: 'error', error: { code: simulated }, createdAt: failedAt, ...askedOf };
        return;
      }

      if (params.query.trim().toLocaleLowerCase('nb-NO') === MOCK_CLARIFICATION_QUERY) {
        // One thinking step and then the question back: the agent looked at
        // what was asked and decided it could not search on it yet. No
        // `sources` event, because nothing was retrieved — a clarification
        // with sources behind it would be a different thing entirely.
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
        // One turn, one time. Made here and handed to both the store and the
        // `done` frame, so the answer says the same thing before and after a
        // reload. See `StreamEvent`'s `done`.
        const clarificationAt = new Date().toISOString();
        recordMockTurn({
          question: params.query,
          answerId: clarificationId,
          // No sources, because nothing was retrieved. A clarification with
          // sources behind it would be a different thing entirely.
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

      /*
       * A cached conversation, when the question is one of the eleven. Lars
       * asked for «noen nye søk, cachede, så jeg kan teste selv»; see
       * conversations/scripts.ts. Everything below it — steps, answer,
       * sources, done — is the same sequence the default answer uses, so a
       * scripted turn and an unscripted one are indistinguishable to a view.
       */
      const scripted = scriptedFor(params.query);

      /*
       * What the filter leaves to search in. The backend ignores the
       * parameter today (API-bestilling A2), so this is the only place the
       * control has an effect — and a filter with no effect is the thing
       * reise 8 says a first-time user meets first. See filtering.ts.
       *
       * It narrows a scripted conversation the same way it narrows the
       * default one. The filter belongs to the reader and not to the answer,
       * and a control that quietly stops working on eleven of the questions is
       * worse than one that never worked at all.
       */
      /*
       * A question asked WITH the reader's own documents cites at least one
       * of them. The attached ones come first, so `[1]` in the answer points
       * at the reader's own file — which is what a reader who just attached
       * something expects the first marker to be.
       *
       * The corpus documents are renumbered after them, because a citation
       * number is a position in the answer's flat excerpt list and inserting
       * at the front moves everything else along. Renumbering here rather
       * than in the fixture keeps the fixture a fixture.
       */
      /*
       * Which fixtures the corpus resolved at the top of `ask` answers from.
       * The Wikipedia mock has one canonical answer with its own sources;
       * everything else is Kudos, including the eleven scripted
       * conversations, which were written against Kudos documents and only
       * make sense there.
       */
      const wikipedia = corpusKey === WIKIPEDIA_MOCK_KEY;
      const attached = attachedSources(params.attachments);
      const fromCorpus = narrowToSelection(
        wikipedia ? wikipediaMockSources : (scripted?.documents ?? nkomSources),
        params.filters,
      );
      const documents = attached.length === 0 ? fromCorpus : renumber([...attached, ...fromCorpus]);
      const cited = citedNumbers(documents);

      /*
       * How far the corpus markers moved. The attached documents take the
       * first numbers, so every `[n]` written for the corpus now means
       * `[n + attachedExcerpts]` — and the text has to say so, or each claim
       * points one document too early and the last source is left with no
       * marker. Found by KA CC on #117.
       */
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
        /*
         * The same as the simulated codes above: the turn is remembered, so a
         * reader who reloads still has the question, what was tried, and a
         * card saying it did not finish. Which error it was is not written
         * down — the wording belongs to the view, keyed on a code the store
         * has no field for — so the restored card says less than the alert
         * did, on purpose. See `FAILED_NOTE`.
         */
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
      /*
       * The answer, with the corpus markers moved along and a first sentence
       * that cites what the reader attached.
       *
       * The sentence is not decoration. Shifting alone leaves source 1 — the
       * reader's own document — with no marker pointing at it, which is the
       * same inconsistency the shift fixes, only mirrored: a number in the
       * panel that the text never refers to. One of the two has to give, and
       * an answer that mentions the document it was handed is the honest one.
       */
      const baseAnswer = wikipedia
        ? WIKIPEDIA_MOCK_ANSWER
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

      // No sources event for a clarification: nothing was retrieved, and a
      // question back with sources behind it would be a different thing.
      //
      // Asked of the script and not of `documents`: a conversation the filter
      // has narrowed to nothing is an answer whose sources are all outside
      // the selection, which is not the same thing as a question back.
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

      /*
       * Written down as the turn that was actually streamed, not as the
       * default one. Named locals rather than the fixtures, because the two
       * had drifted apart the moment a scripted or filtered answer existed: a
       * reload would then have replaced a Bufdir answer's sources with NKOM's,
       * and a filtered answer's with the whole unfiltered set.
       */
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
      /*
       * Stopped by the reader. The turn stays on screen — answer 34 — so it
       * is part of the conversation and is remembered as one.
       *
       * Remembered as `aborted`, which is what it is and what `useChat`
       * settles it as. It used to be stored as `complete`, from a time when
       * `useChat` settled it that way too; after #4's funn A it no longer
       * did, and the note here went stale without anything failing. A half
       * answer came back from a reload dressed as a finished one — «Kopier
       * svaret», a closing question, and no way to run it again.
       *
       * Stored whatever phase it was stopped in, including before the first
       * word. That is the same finding one step earlier: the card is what
       * says the turn was stopped and offers «Generer på nytt», and it is
       * drawn for an empty stopped turn too. Storing only the ones with text
       * meant the reader who stopped during «Tenker …» came back from a
       * reload to an empty thread, having watched a card a moment before.
       */
      // One turn, one time, the same rule the `done` path follows: made once
      // here and handed to both the store and the frame that ends the stream.
      const stoppedAt = new Date().toISOString();
      if (signal?.aborted) {
        recordMockTurn({
          question: params.query,
          answerId: nextMessageId(),
          answer: {
            content: written,
            citations: [],
            createdAt: stoppedAt,
            // What the agent had done by the time it was stopped, so the
            // restored card carries the same «Tenkte i N sekunder» it did a
            // moment before. Empty when nothing had gone out yet, and then
            // there is no panel to draw either way.
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

  /**
   * Which conversation the questions that follow belong to. See
   * `ChatClient.openThread`, and sessionThreads.ts for what is kept.
   */
  openThread(thread: Thread, certainty?: ThreadCertainty): void {
    openMockThread(thread, certainty);
  }

  /**
   * The mock names its own conversations, exactly as the backend does.
   *
   * It did not, and that was the hole: the mock filed threads under the id
   * the shell made up, so the one thing live does differently — owning the
   * identity — was the one thing no test in mock could see. The address in
   * live named a conversation nobody could open, for a week (brukerblikk 8).
   *
   * No delay and no failure path. This stands in for a store that answers in
   * a millisecond, and a mock that could not mint an id would be testing the
   * shell's fallback rather than the flow the reader walks through.
   */
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

  /**
   * Facets counted from the real corpus, conditioned on what is already
   * ticked — what API-bestilling A2 asks the backend for. See
   * corpus/facets.ts for the rule about a dimension not narrowing itself.
   */
  async listFacets(signal?: AbortSignal, selection?: FilterSelection): Promise<FilterFacet[]> {
    await wait(this.#delays.requestMs, signal);
    // Counted from the corpus that is selected, so switching changes what the
    // filter panel offers. Half of what makes a switch visible at all.
    return facetsFor(selection ?? emptyFilterSelection, corpusDocumentsFor(activeCorpusKey()));
  }
}
