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
} from '../../model';
import { corpusKeyFromTags } from '../corpus';
import { documentUrl } from '../documentUrls';

/**
 * The conversation store behind `/api/conversations`.
 *
 * Measured against the running stack on 2026-09-16, not guessed from the
 * route names. What the backend actually does:
 *
 *   GET  /api/conversations       lists the conversations whose stored
 *                                 `user-id` equals the `X-User-Id` header.
 *                                 400 without that header.
 *   POST /api/conversations       creates one owned by that header, with the
 *                                 `title` given. `agent-id` is required as
 *                                 soon as the key can reach more than one
 *                                 agent, which it can locally.
 *   GET  /api/conversations/:id   the conversation and its messages.
 *
 * **Why the frontend creates the conversation itself**, rather than letting
 * `tools/call` do it, which it will: a conversation `tools/call` creates is
 * owned by the API KEY's client id, not by `X-User-Id` (`ensure-conversation!`
 * in mcp/tools.clj). It would cost one call fewer and be invisible in the
 * list forever, in a bucket shared with every other user of that key. Created
 * here it carries our id and our title, and `tools/call` appends to it when
 * it is handed the `conversation_id` — verified end to end against the local
 * stack: owner and topic both survived the turn.
 */

/** A conversation as the backend writes it. `created` is epoch milliseconds. */
export type ApiConversation = {
  id: string;
  topic?: string | null;
  agentId?: string | null;
  userId?: string | null;
  tags?: string[];
  created?: number | null;
};

/**
 * One stored chunk. Note what is NOT here: no url and no page.
 *
 * `contentMarkdown` is the passage itself, which the live stream does not
 * carry at all (`structuredContent.chunks` has ids and titles only — see
 * API-bestilling A1). So a conversation read back can hold more than the one
 * that was watched, and less: no address to send the reader to.
 */
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
  /**
   * The filter the conversation was made with, on a message of its own whose
   * `role` is null: what `filter-value` on the create call is kept as. Null on
   * every turn, whatever the turn was asked with (measured 05.10). See
   * `filterFromMessages`.
   */
  filterValue?: unknown;
};

/**
 * The agent id for `POST /api/conversations`, derived from the MCP tool name.
 *
 * The same agent has two spellings, and only one works in each place:
 * `builtin.agent-rag-agent__agent-rag-graph-bundled` names the tool,
 * `builtin/agent-rag-agent` names the agent. Measured on three agents
 * (`builtin.agent-rag-agent`, `digdir.altinn-docs-tuned`,
 * `builtin.ai-overview-agent`): drop the skill graph after `__`, and the
 * first dot is a slash. Passing the tool name gives «Agent not found».
 *
 * Derived rather than configured because a second setting that must agree
 * with the first is a second thing to get wrong. `agentId` in the options
 * overrides it for a backend that names them differently.
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
 * A stored conversation as a thread in the list.
 *
 * `updatedAt` is the creation time, because that is all there is: the record
 * has `created` and nothing that moves when a turn is added. The thread list
 * groups on `updatedAt` — «I dag», «Siste 7 dager» — so a conversation
 * answered today but started last month is filed under last month. That is a
 * gap in the backend and not something to paper over here; a guessed
 * timestamp would put rows in the wrong group just as wrongly, without saying
 * so.
 *
 * `titleFromQuestion` is true because the title we `POST` is the reader's own
 * first question. The day the backend writes a real topic, this is what has
 * to stop being set.
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
    // Written by `#createConversation` when the thread was made. Absent on
    // threads from before there was a choice, which is why it is optional
    // rather than defaulted to whatever is selected now — a thread's corpus
    // is a fact about when it was asked, not about the reader's current pick.
    ...(corpusKey ? { corpusKey } : {}),
  };
}

/**
 * The sources behind one stored answer, grouped per document (answer 57).
 *
 * Returns undefined when the message carries no chunks, and that is the state
 * the backend is in today: measured against the local stack, an answer read
 * back had `chunks: []` even though the field exists and the live turn had
 * retrieved five. Undefined and empty mean different things to the sources
 * panel — «nothing is known» against «nothing was found» — and this is the
 * first.
 *
 * The stored chunk has no address, only the document's number, so the link
 * is built from the corpus's template the way the live stream builds it
 * (Simens issue 92, documentUrls.ts). A corpus with no template gets no
 * link, and the panel draws that honestly.
 */
export function sourcesFromChunks(
  chunks: ApiChunk[] | null | undefined,
  corpusKey?: string,
): SourceDocument[] | undefined {
  if (!chunks || chunks.length === 0) return undefined;

  const documents = new Map<string, SourceDocument>();

  chunks.forEach((chunk, index) => {
    const documentId = String(chunk.docNum ?? chunk.chunkId ?? `doc-${index}`);
    const url = documentUrl(corpusKey, chunk.docNum);
    const excerpt = {
      id: chunk.chunkId ?? `${documentId}-${index}`,
      text: chunk.contentMarkdown ?? '',
      // The order the backend returns them in is the ranking, and `[n]` in
      // the answer is 1-indexed into it. Same convention as the live stream.
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
 * How many distinct `[n]` an answer's text carries.
 *
 * Distinct, because the number is «how many sources does this answer point
 * at», not «how many times does it point». The recorded answer writes `[2]`
 * twice, and it is still one source.
 *
 * Counted off the text rather than taken from the store, because the store is
 * exactly what is missing: the backend keeps the answer and not the chunks
 * behind it, so this is the only place left that knows the markers were ever
 * there.
 */
export function citationCountIn(text: string | null | undefined): number {
  const numbers = new Set((text ?? '').match(/\[\d+\]/g) ?? []);
  return numbers.size;
}

/**
 * The stored messages as turns.
 *
 * `system` is dropped: the stack writes «You are a helpful assistant.» as the
 * first message of every conversation, and that is the prompt rather than
 * something anybody said. Measured on the local stack.
 *
 * A message with no text is dropped too. A turn that failed leaves one
 * behind, and an empty bubble in the middle of a conversation reads as a
 * rendering fault rather than as what it is.
 *
 * `corpusKey` is the thread's, off its `corpus:` tag, and it is stamped on
 * every answer in it. The store keeps no corpus per message and does not need
 * to: a thread cannot be continued in another corpus — switching starts a new
 * one — so every turn in it was asked of the same one. Stamping it here is
 * what lets a restored answer say which corpus it came from instead of
 * borrowing whatever the chooser stands on now (KA CC on #129).
 */
/**
 * The agent loop's own prefix for a turn it could not finish
 * (`digdir/skills/builtin/agent/loop.clj`). The backend stores that sentence
 * as the assistant's message, so it comes back with the conversation looking
 * exactly like an answer, and both clients read it from here.
 *
 * Measured 2026-09-29: a turn whose caller disconnected mid-stream left «LLM
 * request failed at iteration 2: Interceptor Exception: » in the thread, and
 * reopening the thread put that on screen as the answer. Reported as
 * digdir/digdir-headless-rag#22; until it is fixed there, a reader must not be
 * shown an English stack-trace fragment as the answer to their question.
 *
 * Anchored, and only this one prefix. The other patterns this app reads
 * failures by are unanchored on purpose — «timeout», «rate limit» — and an
 * answer about public documents may well contain those words. A wrong match
 * here hides a real answer, which is worse than the English sentence it was
 * meant to catch.
 */
const STORED_FAILURE = /^LLM request failed\b/u;

export function messagesFromApi(
  messages: ApiMessage[] | null | undefined,
  corpusKey?: string,
): Message[] {
  return (messages ?? [])
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .filter((message) => (message.text ?? '').trim() !== '')
    .map((message) => {
      const sources = sourcesFromChunks(message.chunks, corpusKey);
      const role = message.role === 'user' ? ('user' as const) : ('assistant' as const);
      // A turn the backend recorded as failed, drawn as failed rather than
      // answered. The text goes, because it is English, technical, and was
      // never written for a reader; `status: 'error'` is what makes the chat
      // draw its own sentence under the question instead (`FAILED_NOTE`).
      const failed = role === 'assistant' && STORED_FAILURE.test(message.text ?? '');
      return {
        id: message.id,
        role,
        content: failed ? '' : (message.text ?? ''),
        createdAt: isoFrom(message.created, new Date(0).toISOString()),
        // No answer left for a marker to point into, on a failed turn.
        citations: failed ? [] : citationsFromSources(sources),
        // Only an answer cites. A question with brackets in it is a question
        // with brackets in it.
        ...(role === 'assistant' && !failed
          ? { citationCount: citationCountIn(message.text) }
          : {}),
        // On the answer and not on the question, for the same reason: the
        // corpus is where the answer was retrieved from, and a question was
        // retrieved from nothing. Absent when the thread carries no tag,
        // which is every thread from before there was a choice.
        ...(role === 'assistant' && corpusKey ? { corpusKey } : {}),
        ...(sources && !failed ? { sources } : {}),
        status: failed ? ('error' as const) : ('complete' as const),
      };
    });
}

/** «document-type» and «documentType» are the same name. */
function bareName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The filter a conversation was made with, by dimension, or undefined when it
 * has none (Simens issue 90).
 *
 * The backend keeps `filter-value` from the create call on a message of its
 * own, and gives its keys back in kebab case: `documentType` comes back as
 * `document-type` (measured 05.10). The names are matched without case and
 * punctuation, so either spelling finds the dimension. Anything that is not a
 * list of strings is left out rather than guessed at.
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
    // The last turn is the best «last activity» available, and it is better
    // than `created` whenever there is one. The list endpoint returns no
    // messages, so only a thread that has been opened can say this.
    updatedAt: turns.at(-1)?.createdAt ?? thread.updatedAt,
    messages: turns,
  };
}
