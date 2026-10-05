import type { FilterFacet, FilterSelection, StreamEvent, Thread, ThreadDetail } from '../model';

/**
 * How much of a thread the caller vouches for when it opens one.
 *
 * `known` is the thread as it stands; `id-only` is the id and a stand-in for
 * the rest. See `ChatClient.openThread`.
 */
export type ThreadCertainty = 'known' | 'id-only';

/** One question to the assistant. */
export interface AskParams {
  /** The question, as the user typed it. */
  query: string;
  /** Continue an existing backend conversation. Omit to start a new one. */
  conversationId?: string;
  /** Which documents to search in. Empty selection means the whole corpus. */
  filters?: FilterSelection;
  /**
   * Ids of the reader's own uploaded documents this question was asked with.
   *
   * Separate from `filters`, because they answer different questions. The
   * filter narrows the CORPUS and belongs to the reader across questions;
   * this says which of their own documents THIS question is about, and a
   * follow-up may well be about none of them.
   *
   * backend: mangler, se API-bestilling A3 — nothing on the wire carries
   * this yet. The mock honours it, and the live client has nowhere to send
   * it; see src/api/live/LiveUploadClient.ts.
   */
  attachments?: string[];
  /** Cancels the answer (answer 34). */
  signal?: AbortSignal;
}

/**
 * Everything the frontend needs from a backend. The mock and the live client
 * implement the same interface, so nothing above this layer knows which one
 * it is talking to.
 *
 * `ask` returns an async iterable rather than taking callbacks: `for await`
 * gives the caller cancellation and back pressure for free, and it maps
 * straight onto the server-sent events the live client will read.
 */
export interface ChatClient {
  ask(params: AskParams): AsyncIterable<StreamEvent>;
  listThreads(signal?: AbortSignal): Promise<Thread[]>;
  /**
   * Tell the client which conversation the questions that follow belong to.
   *
   * The shell calls it when it mints a thread for a question asked on `/`, and
   * when it has read one from `/threads/:threadId`. It is the handshake a
   * session would be on a server: `ask()` is given a query and a backend
   * conversation id, never our thread id, so without this a client has no way
   * to know which thread an answer belongs in.
   *
   * Optional, because only a client that can remember anything needs it. The
   * mock keeps the conversation in `sessionStorage`; the live backend has no
   * thread API to write to at all (gap 4 in
   * design/eksisterende/api-for-frontend.md, API-bestilling A6), so it does
   * not implement this and the shell's call is a no-op.
   *
   * `certainty` says how much of the thread the caller vouches for. `known`
   * is the whole of it, as the backend has it. `id-only` is the shell saying
   * it is sure of the id and of nothing else: a question asked while
   * `/threads/:id` is still being read has to be filed somewhere, and the
   * title it carries is a stand-in until the read lands. A client that
   * remembers threads must not write a stand-in over what it already knows —
   * it said so, so it does not have to be guessed from who wrote first.
   */
  openThread?(thread: Thread, certainty?: ThreadCertainty): void;
  /**
   * Make the conversation this thread will live in, and say what it is called.
   *
   * The shell mints a stand-in thread the moment a question is asked, because
   * it has to return one synchronously and the answer starts streaming at
   * once. In live that stand-in's id is a uuid this browser made up, and the
   * backend's conversation has a different id — so the address the reader was
   * given named a conversation nobody could open, including them. «Kopier
   * lenke til tråden» copied exactly that address (brukerblikk 8).
   *
   * So the client is asked for the real thread, and the shell moves the
   * address to it when it arrives. Returns undefined when it could not make
   * one; the stand-in then stands, which is what happened before this existed.
   *
   * Optional, because only a client whose backend owns the identity needs it.
   * The live client does. The mock does too, on purpose: it used to file
   * conversations under the id the client made up, so mock and live disagreed
   * about exactly the thing that was broken, and no test could see it.
   */
  createThread?(thread: Thread, signal?: AbortSignal): Promise<Thread | undefined>;
  /** Resolves to null when the thread does not exist. */
  getThread(threadId: string, signal?: AbortSignal): Promise<ThreadDetail | null>;
  /**
   * The filter dropdowns with their values.
   *
   * `selection` is what the user has already ticked, and the counts come back
   * conditioned on it: pick an organisation and the years then say how many
   * of THAT organisation's documents each year holds. A dimension never
   * narrows its own counts, or every unticked value would drop to zero the
   * moment the first one was ticked.
   *
   * Optional, and omitting it asks for the unconditioned counts. Mock mode
   * computes all of this from the corpus. Live mode returns nothing at all:
   * the backend filters by whole dataset and has no facet aggregation. See
   * `FacetValue.count` and API-bestilling A2.
   */
  listFacets(signal?: AbortSignal, selection?: FilterSelection): Promise<FilterFacet[]>;
}
