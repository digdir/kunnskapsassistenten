import {
  emptyFilterSelection,
  filterDimensions,
  isEmptySelection,
  type Citation,
  type FilterSelection,
  type Message,
  type SourceDocument,
  type Thread,
  type ThreadDetail,
  withoutRetriedAttempts,
} from '../../model';
import { corpusKeyFromTags } from '../corpus';
import { documentUrl } from '../documentUrls';
import { publicUrl } from '../publicUrl';

// The conversation store behind `/api/conversations`, which lists and creates by `X-User-Id` (400
// without it). The client creates conversations itself: one made by `tools/call` is owned by the
// API key's client id and never shows in the reader's list.

/** A conversation as the backend writes it. `created` is epoch milliseconds. */
export type ApiConversation = {
  id: string;
  topic?: string | null;
  agentId?: string | null;
  userId?: string | null;
  tags?: string[];
  created?: number | null;
};

/** One stored chunk. Unlike the live stream it carries the passage, but no url and no page. */
export type ApiChunk = {
  chunkId?: string | null;
  docTitle?: string | null;
  docNum?: string | number | null;
  contentMarkdown?: string | null;
};

export type ApiMessage = {
  id: string;
  text?: string | null;
  /** `user`, `assistant` — and `system`, which is the prompt and not a turn. */
  role?: string | null;
  created?: number | null;
  chunks?: ApiChunk[] | null;
  /** The conversation store's own labelling. Not read here. */
  tags?: string[] | null;
  /** The create call's `filter-value`, on a message of its own (role null); null on turns. */
  filterValue?: unknown;
  /** The BFF's mark for a turn stored as failed, sent with no text (`/api/v2`). */
  failed?: boolean | null;
};

/**
 * The agent id for `POST /api/conversations`, derived from the MCP tool name so two settings
 * cannot disagree: drop the skill graph after `__`, and the first dot becomes a slash. The backend
 * answers the tool name itself with «Agent not found».
 */
export function agentIdFromToolName(toolName: string): string {
  const withoutSkillGraph = toolName.split('__')[0] ?? toolName;
  return withoutSkillGraph.replace('.', '/');
}

/** Epoch milliseconds to ISO 8601, which is what the model holds. */
function isoFrom(created: number | null | undefined, fallback: string): string {
  if (typeof created !== 'number' || !Number.isFinite(created)) return fallback;
  return new Date(created).toISOString();
}

/**
 * A stored conversation as a thread in the list. `updatedAt` is the creation time because the
 * record has nothing that moves when a turn is added, and `titleFromQuestion` is true because the
 * title we `POST` is the reader's first question.
 */
export function threadFromConversation(conversation: ApiConversation): Thread {
  const createdAt = isoFrom(conversation.created, new Date(0).toISOString());
  const topic = conversation.topic?.trim();
  const corpusKey = corpusKeyFromTags(conversation.tags);
  return {
    id: conversation.id,
    title: topic === undefined || topic === '' ? 'Uten tittel' : topic,
    titleFromQuestion: true,
    createdAt,
    updatedAt: createdAt,
    conversationId: conversation.id,
    // Optional, not defaulted to the current pick: a thread's corpus is a fact about when it was
    // asked, and older threads have none.
    ...(corpusKey ? { corpusKey } : {}),
  };
}

/**
 * The sources behind one stored answer, grouped per document, or undefined («nothing is known»)
 * when the message has no chunks, which is what the backend returns today. Links come from the
 * corpus's template (documentUrls.ts), because a stored chunk has no address.
 */
export function sourcesFromChunks(
  chunks: ApiChunk[] | null | undefined,
  corpusKey?: string,
): SourceDocument[] | undefined {
  if (!chunks || chunks.length === 0) return undefined;

  const documents = new Map<string, SourceDocument>();

  chunks.forEach((chunk, index) => {
    const documentId = String(chunk.docNum ?? chunk.chunkId ?? `doc-${index}`);
    // Through `publicUrl` as in `mcp.ts`, a second lock behind `documentUrls.ts`: one rule for
    // what may become an `href`.
    const url = publicUrl(documentUrl(corpusKey, chunk.docNum));
    const excerpt = {
      id: chunk.chunkId ?? `${documentId}-${index}`,
      text: chunk.contentMarkdown ?? '',
      // The backend's order is the ranking, and `[n]` in the answer is 1-indexed into it.
      relevance: 'medium' as const,
      citationNumber: index + 1,
      ...(url ? { kudosUrl: url } : {}),
    };

    const existing = documents.get(documentId);
    if (existing) {
      existing.excerpts.push(excerpt);
      return;
    }

    documents.set(documentId, {
      id: documentId,
      title: chunk.docTitle?.trim() || 'Uten tittel',
      ...(url ? { url } : {}),
      excerpts: [excerpt],
    });
  });

  return [...documents.values()];
}

function citationsFromSources(documents: SourceDocument[] | undefined): Citation[] {
  return (documents ?? []).flatMap((document) =>
    document.excerpts
      .filter((excerpt) => excerpt.citationNumber !== undefined)
      .map((excerpt) => ({
        number: excerpt.citationNumber as number,
        excerptId: excerpt.id,
        documentId: document.id,
      })),
  );
}

/**
 * How many distinct `[n]` an answer's text carries. Counted off the text because the backend keeps
 * the answer but not the chunks behind it.
 */
export function citationCountIn(text: string | null | undefined): number {
  const numbers = new Set((text ?? '').match(/\[\d+\]/g) ?? []);
  return numbers.size;
}

// The agent loop's prefix for a turn it could not finish, stored as the answer
// (digdir/digdir-headless-rag#22). Anchored: answers may contain words like «timeout», and a wrong
// match would hide a real answer.
const STORED_FAILURE = /^LLM request failed\b/u;

/**
 * The stored messages as turns. `system` (the prompt) and empty messages (left by failed turns)
 * are dropped. `corpusKey` is the thread's and is stamped on every answer, because switching
 * corpus starts a new thread.
 */
export function messagesFromApi(
  messages: ApiMessage[] | null | undefined,
  corpusKey?: string,
): Message[] {
  const turns = (messages ?? [])
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .filter((message) => (message.text ?? '').trim() !== '' || message.failed === true)
    .map((message) => {
      const sources = sourcesFromChunks(message.chunks, corpusKey);
      const role = message.role === 'user' ? ('user' as const) : ('assistant' as const);
      // The stored failure text was never written for a reader; `status: 'error'` makes the chat
      // draw its own sentence instead (`FAILED_NOTE`).
      const failed =
        role === 'assistant' &&
        (message.failed === true || STORED_FAILURE.test(message.text ?? ''));
      return {
        id: message.id,
        role,
        content: failed ? '' : (message.text ?? ''),
        createdAt: isoFrom(message.created, new Date(0).toISOString()),
        // A failed turn has no answer for a marker to point into.
        citations: failed ? [] : citationsFromSources(sources),
        // Only an answer cites; brackets in a question are just brackets.
        ...(role === 'assistant' && !failed
          ? { citationCount: citationCountIn(message.text) }
          : {}),
        // On the answer only: the corpus is where the answer was retrieved from.
        ...(role === 'assistant' && corpusKey ? { corpusKey } : {}),
        ...(sources && !failed ? { sources } : {}),
        status: failed ? ('error' as const) : ('complete' as const),
      };
    });
  return withoutRetriedAttempts(turns);
}

/** «document-type» and «documentType» are the same name. */
function bareName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The filter a conversation was made with, by dimension, or undefined (issue 90). The backend
 * returns the keys in kebab case, so names are matched without case and punctuation, and anything
 * that is not a list of strings is left out.
 */
export function filterFromMessages(
  messages: ApiMessage[] | null | undefined,
): FilterSelection | undefined {
  const value = (messages ?? []).find(
    (message) => message.filterValue !== null && typeof message.filterValue === 'object',
  )?.filterValue as Record<string, unknown> | undefined;
  if (!value) return undefined;

  const selection: FilterSelection = { ...emptyFilterSelection };
  for (const dimension of filterDimensions) {
    const key = Object.keys(value).find((name) => bareName(name) === bareName(dimension));
    const values = key === undefined ? undefined : value[key];
    if (Array.isArray(values)) {
      selection[dimension] = values.filter((entry): entry is string => typeof entry === 'string');
    }
  }
  return isEmptySelection(selection) ? undefined : selection;
}

export function threadDetailFrom(
  conversation: ApiConversation,
  messages: ApiMessage[] | null | undefined,
): ThreadDetail {
  const thread = threadFromConversation(conversation);
  const turns = messagesFromApi(messages, thread.corpusKey);
  const filter = filterFromMessages(messages);
  return {
    ...thread,
    // What the thread is locked to; see `lockOf` in useThreadFilterLock.ts.
    ...(filter ? { filter } : {}),
    // The last turn is the best «last activity» there is; the list endpoint returns no messages,
    // so only an opened thread can say this.
    updatedAt: turns.at(-1)?.createdAt ?? thread.updatedAt,
    messages: turns,
  };
}
