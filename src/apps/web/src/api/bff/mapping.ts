import { filterDimensions } from '../../model';
import type {
  Agent,
  AgentList,
  ChatError,
  Excerpt,
  FilterSelection,
  SourceDocument,
  StreamEvent,
  ThinkingStep,
  Thread,
  ThreadDetail,
} from '../../model';
import { errorFromBackend, errorFromStatus } from '../backendErrors';
import type { DatasetFilterFields } from '../filterFields';
import { messagesFromApi, threadFromConversation } from '../live/conversations';
import { relevanceFromRank, toCitations } from '../live/mcp';
import { publicUrl } from '../publicUrl';
import type {
  BffAgentOption,
  BffConversationDetail,
  BffConversationSummary,
  BffFacet,
  BffSource,
  BffTurnEvent,
} from './contract';

/**
 * The BFF's wire format, translated into our model. Pure functions, so the
 * recorded fixtures can be run through them without a server.
 */

/**
 * The reader's filter, as `POST /api/ask` takes it: `{ type: ['Årsrapport'] }`.
 *
 * Keyed by the corpus's own field names from `VITE_KA_FILTER_FIELDS`, the same
 * translation the live client makes (src/decisions/0004). `value-type` has
 * no place here: the BFF's contract is field to values and nothing else, and
 * the BFF decides what goes on to the backend.
 *
 * Undefined rather than `{}` when there is nothing to send, for the reason
 * `filterArguments` gives in live/mcp.ts: no opinion and an empty opinion are
 * different things, and only one of them should reach a server.
 */
export function filterBody(
  selection: FilterSelection | undefined,
  fields: DatasetFilterFields | undefined,
): Record<string, string[]> | undefined {
  if (!selection || !fields) return undefined;

  const body: Record<string, string[]> = {};
  for (const dimension of filterDimensions) {
    const mapping = fields[dimension];
    if (!mapping) continue;
    const values = (selection[dimension] ?? []).map((value) => value.trim()).filter(Boolean);
    if (values.length > 0) body[mapping.field] = values;
  }
  return Object.keys(body).length > 0 ? body : undefined;
}

/**
 * The BFF's sources as documents with excerpts.
 *
 * One entry per CHUNK arrives, and `marker` is the answer's own `[n]`, so the
 * grouping here is the same one the live client does in `toSourceDocuments`:
 * the excerpts keep their numbers, and the documents are the coarser view of
 * the same list. Excerpts are grouped per document so the title is not
 * repeated once per excerpt (answer 57).
 *
 * Before the BFF numbered per chunk this had to say the opposite, and a
 * document that gave two chunks swallowed every marker after the first.
 *
 * `excerpt` absent is not an empty quote: the chunk was retrieved, its text
 * could not be looked up. That is `textUnavailable`, which the sources panel
 * says in words rather than drawing a blank.
 */
export function sourceDocumentsFrom(sources: BffSource[] | undefined): SourceDocument[] {
  const list = sources ?? [];
  const documents = new Map<string, SourceDocument>();

  list.forEach((source, index) => {
    const id = source.docNum || source.chunkId || `doc-${source.marker}`;
    const url = publicUrl(source.url);
    const excerpt: Excerpt = {
      id: source.chunkId ?? `${id}-${source.marker}`,
      text: source.excerpt ?? '',
      ...(source.excerpt ? {} : { textUnavailable: true as const }),
      relevance: relevanceFromRank(index, list.length),
      ...(url ? { kudosUrl: url } : {}),
      citationNumber: source.marker,
    };

    const existing = documents.get(id);
    if (existing) {
      existing.excerpts.push(excerpt);
      return;
    }
    documents.set(id, {
      id,
      title: source.title.trim() || 'Uten tittel',
      ...(url ? { url } : {}),
      excerpts: [excerpt],
    });
  });

  return [...documents.values()];
}

/** A stored conversation as a thread. Same shape as the backend's own. */
export function threadFromSummary(summary: BffConversationSummary, corpusKey?: string): Thread {
  return { ...threadFromConversation(summary), ...(corpusKey ? { corpusKey } : {}) };
}

/**
 * One conversation with its turns.
 *
 * The messages are the backend's own shape, passed through by the BFF, so the
 * live client's reading of them is reused as it is. The sources are not: the
 * BFF keeps only the LAST answer's, in memory, so they go on the last answer
 * and every earlier one is read back without — which is what the sources
 * panel is built to say.
 *
 * `corpusKey` is the one the deployment says the BFF answers from. The BFF
 * tags nothing with a corpus, and it serves exactly one.
 */
export function threadDetailFromBff(
  detail: BffConversationDetail,
  corpusKey?: string,
): ThreadDetail {
  const thread = threadFromSummary(detail.conversation, corpusKey);
  // `messagesFromApi` has already turned a turn the backend recorded as failed
  // into one with `status: 'error'` and no text, for both clients at once.
  const turns = messagesFromApi(detail.messages, corpusKey);

  const documents = sourceDocumentsFrom(detail.sources);
  // The last ANSWER, not the last assistant turn: the BFF keeps one set of
  // sources per conversation, and they are the last answer's. Hanging them on
  // a turn that failed would credit it with excerpts it never had.
  const last = turns.findLastIndex(
    (message) => message.role === 'assistant' && message.status !== 'error',
  );

  return {
    ...thread,
    // As in live: the last turn is the best «last activity» there is.
    updatedAt: turns.at(-1)?.createdAt ?? thread.updatedAt,
    messages: turns.map((message, index) => {
      if (message.role !== 'assistant' || message.status === 'error') return message;
      if (index === last && documents.length > 0) {
        return { ...message, sources: documents, citations: toCitations(documents) };
      }
      // Every other answer comes back without sources whether it had them or
      // not, and so does the last one after a restart. Not «none», but «not
      // stored»: see `Message.sourcesNotStored`.
      return { ...message, sourcesNotStored: true };
    }),
  };
}

/**
 * The agents from `GET /api/models`, each with the mode it marks as its
 * default, and the default agent from `GET /api/me`.
 *
 * The modes are not offered. They are the same work split into steps
 * differently, for the backend's evaluation of which way is better
 * (`iteration_faithful.clj` in headless-rag), and not something a reader
 * chooses between. An agent with no mode has nothing to send, and is left out.
 *
 * `defaultTool` is the tool the BFF answers with when no `model` is sent. The
 * agent that has it among its modes is the default; with none that does, the
 * BFF has not said, and `defaultId` stays undefined.
 */
export function agentsFromBff(
  options: BffAgentOption[] | undefined,
  defaultTool?: string,
): AgentList {
  const agents: Agent[] = [];
  let defaultId: string | undefined;
  for (const option of options ?? []) {
    const mode = option.modes.find((candidate) => candidate.isDefault) ?? option.modes[0];
    if (!mode) continue;
    agents.push({
      id: option.id,
      label: option.label,
      ...(option.description ? { description: option.description } : {}),
      model: mode.id,
    });
    if (defaultTool && option.modes.some((candidate) => candidate.id === defaultTool)) {
      defaultId = option.id;
    }
  }
  return defaultId ? { agents, defaultId } : { agents };
}

/** The same sentences the live client shows for the same steps. */
const SEARCH_LABEL = 'Jeg søker i dokumentene.';
const READ_LABEL = 'Jeg leser utdragene.';
const FINALIZING_LABEL = 'Jeg skriver svaret med kildehenvisninger.';

/**
 * What one turn has said so far, and the translation of the next event.
 *
 * The BFF's order is `conversation`, `stage` many times, `delta`, `sources`
 * and `done` — and ours wants `sources` exactly once before `done`, even when
 * it is empty, because an answer with no sources is a state the panel draws.
 * So `sources` is held and sent with `done`.
 *
 * `starting` and `writing` show nothing. `starting` is a loop going round
 * again, which the live client drops too; `writing` is the BFF's name for the
 * agent thinking, and it carries none of the thinking's words.
 */
/**
 * What the BFF said went wrong, as one of this app's cases.
 *
 * Three of the codes are the BFF's own words about itself, and only it can
 * know them, so only this file can read them. Everything else — the backend's
 * `dataset_not_authorized`, its `LLM request failed …`, its own sentence
 * about a question that is too long — goes on to `errorFromBackend`, which is
 * the same reading the live client does.
 *
 * `backend_http_<status>` carries the status rather than a case, because the
 * status is all the BFF knows: a 5xx from the backend does not say whether it
 * was the search or the model, and the two ask the reader for opposite
 * things. `errorFromStatus` is where that judgement already lives.
 */
export function chatErrorFromBff(code: string | undefined, message: string): ChatError {
  const status = code?.match(/^backend_http_(\d{3})$/u);
  if (status) return errorFromStatus(Number(status[1]));

  switch (code) {
    // The BFF never got an answer to pass on. Not the same as the backend
    // answering badly, and the only place that can tell them apart is the BFF.
    case 'backend_unreachable':
      return { code: 'unknown', message: 'Tjenesten svarte ikke.' };
    // The stream ended before the answer did.
    case 'stream_broken':
      return { code: 'unknown', message: 'Forbindelsen brøt sammen mens svaret kom.' };
    default:
      return errorFromBackend(message, code);
  }
}

export class BffTurnState {
  #text = '';
  #sources: BffSource[] = [];
  #keywords: string[] = [];
  #steps = 0;
  #conversationId: string | undefined;

  /** Set when the BFF has said which conversation this turn is in. */
  get conversationId(): string | undefined {
    return this.#conversationId;
  }

  read(event: BffTurnEvent, askedOf: { corpusKey?: string } = {}): StreamEvent[] {
    switch (event.type) {
      case 'conversation':
        this.#conversationId = event.id;
        return [];

      /*
       * Av `stage` blir bare `done` et steg, som i live.
       *
       * De andre sier hvilken fase agenten er i, ikke hva den gjorde, og ble
       * til faste setninger uansett hva som skjedde. Søk og lesing kommer nå
       * fra `tool-call`, ett per kall. `done` er BFF-ens `agent/finalized`,
       * og live tegner sitt avsluttende steg av nettopp den rammen
       * (`live/mcp.ts`).
       */
      case 'stage': {
        // Søkeordene samles fortsatt herfra. En BFF som ikke sender
        // `tool-call`, har dem bare her, og da ville «Fremgangsmåte» stått
        // tom. Kommer de begge veier, hindrer settet dobbeltføring.
        this.#rememberQueries(event.queries);
        if (event.stage !== 'done') return [];
        this.#steps += 1;
        return [
          {
            type: 'thinking-step',
            step: { id: `finalizing-${this.#steps}`, kind: 'finalizing', label: FINALIZING_LABEL },
          },
        ];
      }

      case 'thinking':
        if (!event.reasoning) return [];
        this.#steps += 1;
        return [
          {
            type: 'thinking-step',
            step: { id: `thinking-${this.#steps}`, kind: 'reasoning', label: event.reasoning },
          },
        ];

      case 'tool-call':
        return [{ type: 'thinking-step', step: this.#toolStep(event) }];

      case 'delta':
        if (!event.text) return [];
        this.#text += event.text;
        return [{ type: 'token', text: event.text }];

      case 'sources':
        this.#sources = event.sources;
        return [];

      // The BFF passes the backend's own text through as it came, English
      // and all, so it is read for a code like the live client's and never
      // put on screen.
      case 'error':
        return [
          {
            type: 'error',
            error: chatErrorFromBff(event.code, event.message),
            ...askedOf,
          },
        ];

      case 'done': {
        const documents = sourceDocumentsFrom(this.#sources);
        // Searched, found nothing, said nothing: an answer with no sources,
        // not a failure. Same test and same event as the live client.
        if (documents.length === 0 && this.#text === '') {
          return [{ type: 'error', error: { code: 'no-hits' }, ...askedOf }];
        }
        return [
          {
            type: 'sources',
            documents,
            citations: toCitations(documents),
            retrieval: {
              // A hit is one chunk and a document is the grouping of them, so
              // the two are counted apart now that the BFF sends one source
              // per chunk. They were the same number for as long as it sent
              // one per document. See `sourceDocumentsFrom`.
              hitCount: documents.reduce((n, document) => n + document.excerpts.length, 0),
              documentCount: documents.length,
              keywords: this.#keywords,
            },
          },
          {
            type: 'done',
            messageId: `msg-${Date.now()}`,
            conversationId: event.conversationId || this.#conversationId || '',
            ...askedOf,
          },
        ];
      }

      default:
        return [];
    }
  }

  /**
   * Hvert søk agenten kjørte, i rekkefølge og uten gjentakelser, til
   * «Fremgangsmåte» — som live samler dem.
   */
  #rememberQueries(queries: string[] | undefined): void {
    for (const query of queries ?? []) {
      if (!this.#keywords.includes(query)) this.#keywords.push(query);
    }
  }

  /**
   * Ett verktøykall som ett steg, etter samme regel som live.
   *
   * `toolCallStep` i `live/mcp.ts` skiller lesing fra søk på navnet eller på
   * at kallet ba om biter, og setter den engelske `result-summary` som
   * detaljen under den norske setningen. Regelen står to steder fordi de to
   * klientene leser hver sin form av det samme kallet; holdes de i takt, ser
   * leseren det samme uansett modus.
   */
  #toolStep(event: {
    tool: string;
    detail?: string;
    queries?: string[];
    durationMs?: number;
    chunkCount?: number;
  }): ThinkingStep {
    const isRead = event.tool.includes('read') || Boolean(event.chunkCount);

    this.#rememberQueries(event.queries);
    this.#steps += 1;
    return {
      id: `tool-${this.#steps}-${event.tool}`,
      kind: isRead ? 'read' : 'search',
      label: isRead ? READ_LABEL : SEARCH_LABEL,
      ...(event.detail ? { detail: event.detail } : {}),
      ...(event.queries?.length ? { queries: event.queries } : {}),
      ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
    };
  }
}

/**
 * The field names per dimension, as the BFF says them, or undefined when it
 * says none.
 *
 * A BFF with `KA_FILTER_FIELDS` tags each facet with its dimension and value
 * type (D16), so the corpus's field names are the deployment's and nothing is
 * baked into this build. Undefined, and not `{}`, for a BFF that tags none —
 * the one on `8639267` — so the caller can tell «no fields» from «ask the
 * build» (src/decisions/0006-filter-fields-and-corpus-from-the-bff.md).
 */
export function fieldsFromFacets(facets: BffFacet[]): DatasetFilterFields | undefined {
  const fields: DatasetFilterFields = {};
  for (const facet of facets) {
    if (!facet.id || !filterDimensions.includes(facet.id) || fields[facet.id]) continue;
    fields[facet.id] = {
      field: facet.field,
      ...(facet.valueType ? { valueType: facet.valueType } : {}),
    };
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}

/**
 * A thread's filter from the BFF, by dimension, or undefined when it has none.
 *
 * The BFF keys it by the corpus's field names, the way the question sent it;
 * the panel and «Avgrenset til» hold it by dimension. A field no dimension is
 * mapped to is left out: there is nowhere to show it, and guessing which
 * dimension it was would show the reader a filter that is not the one used.
 */
export function selectionFromBff(
  filter: Record<string, string[]> | undefined,
  fields: DatasetFilterFields | undefined,
): FilterSelection | undefined {
  if (!filter || !fields) return undefined;
  const selection: FilterSelection = { documentType: [], organisation: [], year: [] };
  for (const dimension of filterDimensions) {
    const field = fields[dimension]?.field;
    const values = field && Object.hasOwn(filter, field) ? filter[field] : undefined;
    if (Array.isArray(values)) {
      selection[dimension] = values.filter((value): value is string => typeof value === 'string');
    }
  }
  return filterDimensions.some((dimension) => selection[dimension].length > 0)
    ? selection
    : undefined;
}
