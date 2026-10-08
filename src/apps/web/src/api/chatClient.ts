import type {
  AgentList,
  FilterFacet,
  FilterSelection,
  StreamEvent,
  Thread,
  ThreadDetail,
} from '../model';

/** How much of a thread the caller vouches for. See `ChatClient.openThread`. */
export type ThreadCertainty = 'known' | 'id-only';

/** One question to the assistant. */
export interface AskParams {
  /** The question, as the user typed it. */
  query: string;
  /** Continue an existing backend conversation. Omit to start a new one. */
  conversationId?: string;
  /** Which documents to search in. Empty selection means the whole corpus. */
  filters?: FilterSelection;
  /** Ids of the reader's own documents this question is about. Mock only: no backend field. */
  attachments?: string[];
  /** The agent to ask: `Agent.model` from `listAgents`. Omitted, the backend default. */
  model?: string;
  /** Cancels the answer. */
  signal?: AbortSignal;
}

/**
 * Everything the frontend needs from a backend, so nothing above this layer
 * knows which client it has. `ask` returns an async iterable, which gives
 * cancellation and back pressure for free and maps onto server-sent events.
 */
export interface ChatClient {
  ask(params: AskParams): AsyncIterable<StreamEvent>;
  listThreads(signal?: AbortSignal): Promise<Thread[]>;
  /**
   * Which thread the next questions belong to; `ask()` only gets a conversation id.
   * An `id-only` thread's stand-in title must never overwrite what the client knows.
   */
  openThread?(thread: Thread, certainty?: ThreadCertainty): void;
  /**
   * Make the backend conversation for the shell's stand-in thread and return it, or
   * undefined. The mock implements it too, so mock and live agree on thread identity.
   */
  createThread?(thread: Thread, signal?: AbortSignal): Promise<Thread | undefined>;
  /** Resolves to null when the thread does not exist. */
  getThread(threadId: string, signal?: AbortSignal): Promise<ThreadDetail | null>;
  /** Filter dropdowns; counts follow `selection` except a dimension's own. None in live. */
  listFacets(signal?: AbortSignal, selection?: FilterSelection): Promise<FilterFacet[]>;
  /** Agents to choose from; empty hides the choice. None in live: `/v1/models` is not proxied. */
  listAgents?(signal?: AbortSignal): Promise<AgentList>;
}
