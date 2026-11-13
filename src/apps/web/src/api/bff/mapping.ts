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
import { citationCountIn, messagesFromApi, threadFromConversation } from '../live/conversations';
import { citeAnswer, type CitedAnswer, type MarkerRef } from '../excerptCitations';
import { relevanceFromRank } from '../live/mcp';
import { publicUrl } from '../publicUrl';
import { stepFindings } from '../stepFindings';
import type {
  BffAgentOption,
  BffConversationDetail,
  BffConversationSummary,
  BffFacet,
  BffSource,
  BffTurnEvent,
} from './contract';

// The BFF's wire format, translated into our model. Pure functions, so the recorded fixtures can
// be run through them without a server.

/**
 * The reader's filter as `POST /api/ask` takes it, keyed by the corpus's field names
 * (src/decisions/0004). Undefined rather than `{}` when there is nothing to send, as in
 * `filterArguments`.
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
 * The BFF's sources grouped by document, in order of first appearance, with no footnote numbers.
 * A missing `excerpt` becomes `textUnavailable`.
 */
export function sourceDocumentsFrom(sources: BffSource[] | undefined): SourceDocument[] {
  const list = sources ?? [];
  const documents = new Map<string, SourceDocument>();

  list.forEach((source, index) => {
    const id = source.docNum || source.chunkId || `doc-${index + 1}`;
    const url = publicUrl(source.url);
    const excerpt: Excerpt = {
      id: source.chunkId ?? `${id}-${index + 1}`,
      text: source.excerpt ?? '',
      ...(source.excerpt ? {} : { textUnavailable: true as const }),
      ...(typeof source.heading === 'string' && source.heading.trim()
        ? { heading: source.heading }
        : {}),
      relevance: relevanceFromRank(index, list.length),
      ...(url ? { kudosUrl: url } : {}),
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

/** The markers the BFF passed on, or undefined when the service cited by document. */
function markersFrom(sources: BffSource[]): MarkerRef[] | undefined {
  const markers = sources.flatMap((source) =>
    source.chunkId === undefined
      ? []
      : (source.markers ?? []).map((marker) => ({ marker, chunkId: source.chunkId as string })),
  );
  return sources.some((source) => source.markers !== undefined) ? markers : undefined;
}

/** An answer and its sources with what each `[n]` names; live and reload share it. */
export function citedAnswer(content: string, sources: BffSource[] | undefined): CitedAnswer {
  const list = sources ?? [];
  return citeAnswer(content, sourceDocumentsFrom(list), markersFrom(list));
}

/** A stored conversation as a thread. Same shape as the backend's own. */
export function threadFromSummary(summary: BffConversationSummary, corpusKey?: string): Thread {
  return { ...threadFromConversation(summary), ...(corpusKey ? { corpusKey } : {}) };
}

/**
 * One conversation with its turns. The BFF keeps only the last answer's sources, in memory, so the
 * earlier answers are marked as not stored. `corpusKey` is the deployment's: the BFF serves one
 * corpus and tags nothing with it.
 */
export function threadDetailFromBff(
  detail: BffConversationDetail,
  corpusKey?: string,
): ThreadDetail {
  const thread = threadFromSummary(detail.conversation, corpusKey);
  // `messagesFromApi` has already turned a turn the backend recorded as failed into one with
  // `status: 'error'` and no text, for both clients at once.
  const turns = messagesFromApi(detail.messages, corpusKey);

  // The last ANSWER, not the last assistant turn: the BFF keeps one set of sources per
  // conversation, and they are the last answer's. Hanging them on a turn that failed would credit
  // it with excerpts it never had.
  const last = turns.findLastIndex(
    (message) => message.role === 'assistant' && message.status !== 'error',
  );
  const kept = detail.sources ?? [];

  return {
    ...thread,
    // As in live: the last turn is the best «last activity» there is.
    updatedAt: turns.at(-1)?.createdAt ?? thread.updatedAt,
    messages: turns.map((message, index) => {
      if (message.role !== 'assistant' || message.status === 'error') return message;
      if (index === last && kept.length > 0) {
        const cited = citedAnswer(message.content, kept);
        return {
          ...message,
          content: cited.content,
          citationCount: citationCountIn(cited.content),
          sources: cited.documents,
          citations: cited.citations,
        };
      }
      // Every other answer comes back without sources whether it had them or not, and so does the
      // last one after a restart. Not «none», but «not stored»: see `Message.sourcesNotStored`.
      return { ...message, sourcesNotStored: true };
    }),
  };
}

/**
 * The agents from `GET /api/models`, each with its default mode, and the default agent from
 * `GET /api/me`. Modes are not offered (they serve the backend's own evaluation), and an agent
 * without one is left out.
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
 * What the BFF said went wrong, as one of this app's cases. Only the BFF's own codes are read here;
 * the rest goes to `errorFromBackend`, as in live. `backend_http_<status>` maps by status, because
 * a backend 5xx does not say whether the search or the model failed.
 */
export function chatErrorFromBff(code: string | undefined, message: string): ChatError {
  const status = code?.match(/^backend_http_(\d{3})$/u);
  if (status) return errorFromStatus(Number(status[1]));

  switch (code) {
    // The BFF never got an answer to pass on. Not the same as the backend answering badly, and the
    // only place that can tell them apart is the BFF.
    case 'backend_unreachable':
      return { code: 'unknown', message: 'Tjenesten svarte ikke.' };
    // The stream ended before the answer did.
    case 'stream_broken':
      return { code: 'unknown', message: 'Forbindelsen brøt sammen mens svaret kom.' };
    // genki refused the person, not the question (apps/server/src/backend.ts).
    case 'locked_environment':
    case 'entra_not_trusted':
      return { code: 'locked' };
    default:
      return errorFromBackend(message, code);
  }
}

/**
 * One turn's state and the translation of each BFF event. `sources` is held and sent just before
 * `done`, because ours wants it exactly once, even when empty.
 */
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

      // Of the stages only `done` (the BFF's `agent/finalized`) becomes a step, as in live; the
      // others name a phase, not what the agent did. Search and read steps come from `tool-call`.
      case 'stage': {
        // Collected here too, for a BFF that sends no `tool-call`; `#rememberQueries` drops
        // repeats.
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

      // The BFF passes the backend's own text through as it came, English and all, so it is read
      // for a code like the live client's and never put on screen.
      case 'error':
        return [
          {
            type: 'error',
            error: chatErrorFromBff(event.code, event.message),
            ...askedOf,
          },
        ];

      case 'done': {
        const cited = citedAnswer(this.#text, this.#sources);
        const documents = cited.documents;
        // Searched, found nothing, said nothing: an answer with no sources, not a failure. Same
        // test and same event as the live client.
        if (documents.length === 0 && this.#text === '') {
          return [{ type: 'error', error: { code: 'no-hits' }, ...askedOf }];
        }
        return [
          {
            type: 'sources',
            documents,
            citations: cited.citations,
            retrieval: {
              // Counted over every chunk, before uncited excerpts are left out.
              hitCount: this.#sources.length,
              documentCount: sourceDocumentsFrom(this.#sources).length,
              keywords: this.#keywords,
            },
            // The streamed text had genki's markers; the answer is shown with KA's.
            ...(cited.content !== this.#text ? { content: cited.content } : {}),
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

  /** Every search the agent ran, in order and without repeats, as live collects them. */
  #rememberQueries(queries: string[] | undefined): void {
    for (const query of queries ?? []) {
      if (!this.#keywords.includes(query)) this.#keywords.push(query);
    }
  }

  // One tool call as one step, by the same rule as `toolCallStep` in live/mcp.ts. Keep the two in
  // step: they read different shapes of the same call, and the reader should see the same.
  #toolStep(event: {
    tool: string;
    detail?: string;
    queries?: string[];
    durationMs?: number;
    chunkCount?: number;
  }): ThinkingStep {
    const isRead = event.tool.includes('read') || Boolean(event.chunkCount);
    // The same reading of the same report as live, so «Fremgangsmåte» is the same either way.
    const findings = stepFindings(event.tool, event.queries, event.detail);

    this.#rememberQueries(event.queries);
    this.#steps += 1;
    return {
      id: `tool-${this.#steps}-${event.tool}`,
      kind: isRead ? 'read' : 'search',
      label: isRead ? READ_LABEL : SEARCH_LABEL,
      ...(event.detail ? { detail: event.detail } : {}),
      ...(event.queries?.length ? { queries: event.queries } : {}),
      ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
      tool: event.tool,
      ...(findings ? { findings } : {}),
    };
  }
}

/**
 * The field names per dimension from the BFF's tagged facets (`KA_FILTER_FIELDS`), or undefined
 * when it tags none, so the caller can fall back to the build (src/decisions/0006).
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
 * A thread's filter from the BFF, by dimension, or undefined. A field no dimension is mapped to is
 * left out rather than guessed, so the reader never sees a filter that was not the one used.
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
