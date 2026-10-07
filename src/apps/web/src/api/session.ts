import { forgetFlags } from '../flags/flags';
import { forgetStoredFilter } from '../layout/persistence';
import { forgetAgentChoice } from './agentChoice';
import { forgetCorpusChoice } from './corpus';
import { BFF_API } from './bff/api';
import { forgetAllAnswers } from './live/sourceStore';
import { kaEnv } from './runtimeConfig';

/** Who is signed in, and where signing out goes. */
export type Session = {
  /** The name from the sign-in, or the address when there is no name. */
  name: string;
  email?: string;
  /** Where «Logg ut» goes: the BFF ends the session there and at Entra. */
  logoutUrl: string;
};

/**
 * The reader's session, when there is one to show.
 *
 * Only the BFF signs anybody in (Entra, `src/decisions/0005`), and it says
 * who in `GET /api/me`. With `AUTH_MODE=off` — the local pod — it says
 * `authEnabled: false` and has no user, and then there is nothing to show:
 * a «Logg ut» with no session behind it would sign nobody out.
 *
 * Undefined on any failure as well. The name is a courtesy, not something to
 * put an error on screen about, and a 401 here is the BFF client's to handle
 * on the next real call.
 *
 * Beside the ChatClient, as threadActions.ts is, and for the same reason.
 */
export async function fetchSession(signal?: AbortSignal): Promise<Session | undefined> {
  if (kaEnv().VITE_API_MODE !== 'bff') return undefined;

  try {
    const response = await fetch(`${BFF_API}/me`, { credentials: 'same-origin', signal });
    if (!response.ok) return undefined;
    const body = (await response.json()) as {
      authEnabled?: boolean;
      userId?: unknown;
      user?: { name?: string; email?: string } | null;
    };
    noteSignedIn(body.userId);
    const name = body.user?.name?.trim() || body.user?.email?.trim();
    if (!body.authEnabled || !name) return undefined;
    return {
      name,
      ...(body.user?.email ? { email: body.user.email } : {}),
      logoutUrl: '/auth/logout',
    };
  } catch {
    return undefined;
  }
}

/**
 * What «Logg ut» does in this browser before the BFF ends the session.
 *
 * It empties the answer store (`ka.sources.v1`), which keeps what came of the
 * reader's questions per browser and not per user (src/decisions/0008).
 * Decided on 5.10. Synchronous, and called from the link's
 * click, so it is done before the browser follows the link to
 * `/auth/logout`.
 *
 * A draft kept from an expired session goes too: it was written by the
 * reader who is signing out, and the next one to sign in in this tab is not
 * necessarily them. So does the agent they chose (`ka.agent.v1`), which is
 * kept per browser for the same reason the answers are, and so do the filter
 * (`ka.filter.v1`) and the corpus (`ka.corpus.v1`).
 */
export function beforeLogout(): void {
  forgetAllAnswers();
  forgetDraft();
  forgetAgentChoice();
  forgetFlags();
  forgetStoredFilter();
  forgetCorpusChoice();
}

/**
 * What the reader had written when the session ran out.
 *
 * Behind the BFF a session lasts eight hours from sign-in and is not renewed
 * (`auth.ts`, `MAX_AGE`, in digdir/kunnskapsassistenten). A 401 sends the
 * browser to `/auth/login`, and the text in the compose field used to go with
 * the page.
 *
 * In `sessionStorage`, so it stays with the tab that signs in again and goes
 * when the tab does. Kept with the page it was written on, which is the
 * address the sign-in comes back to, so it is put back in the same thread and
 * in no other.
 */
const DRAFT_STORAGE_KEY = 'ka.draft.v1';

/** `user` is who wrote it, as `noteSignedIn` heard it. */
type StoredDraft = { text: string; path: string; user: string };

/**
 * Who the BFF says is signed in on this page: `userId` from `/api/me`, the id
 * it also gives the backend. Undefined until `/api/me` has answered.
 *
 * A draft is kept with it and given back only to the same id. Behind the BFF
 * a tab that signs in again can be somebody else's on a shared machine, and
 * the draft is what the previous reader was writing.
 */
let signedInAs: string | undefined;

/**
 * `/api/me` has answered. Called by whoever asked: the session here, and the
 * BFF client for its agents (BffChatClient.ts, `listAgents`), which the chat
 * view asks for when it mounts, with or without the thread list.
 */
export function noteSignedIn(userId: unknown): void {
  if (typeof userId === 'string' && userId !== '') signedInAs = userId;
}

/** Who is signed in, asking `/api/me` when nobody has yet. */
async function signedInUser(signal: AbortSignal): Promise<string | undefined> {
  if (signedInAs === undefined) await fetchSession(signal);
  return signedInAs;
}

/** The compose fields on the page, each able to say what it holds. */
const draftSources = new Set<() => string>();

/**
 * A question that has been sent and not yet answered, and the page it belongs
 * on when that is not the page the browser is on.
 */
let questionInFlight: { text: string; page: () => string | undefined } | undefined;

/**
 * A compose field says how its text can be read. Returns the way to take that
 * back, for when the field goes.
 */
export function provideDraft(read: () => string): () => void {
  draftSources.add(read);
  return () => {
    draftSources.delete(read);
  };
}

/**
 * A question is on its way. Returns the way to say it has arrived.
 *
 * The field empties the moment a question is sent (`ChatView`, `submit`), so
 * a 401 on `/api/ask` comes when the field has nothing in it, and the
 * question is the text the reader would lose.
 *
 * `page` is where the question belongs, when the address is not it. A
 * question that starts a thread is filed under a stand-in address until the
 * BFF names the conversation (`ChatSlotView`). A 401 means it never will, so
 * after the sign-in that address says «Fant ikke tråden» (measured
 * 2026-10-06). Such a question belongs on the front page, where threads are
 * started.
 */
export function noteQuestionInFlight(
  question: string,
  page: () => string | undefined = () => undefined,
): () => void {
  const entry = { text: question, page };
  questionInFlight = entry;
  return () => {
    if (questionInFlight === entry) questionInFlight = undefined;
  };
}

/**
 * Keep what the reader has written, just before the browser leaves for
 * sign-in: the text in the field, or, when the field is empty, the question
 * on its way. A 401 on the question itself comes when the field has just
 * been emptied, so that is the question; a 401 on anything else keeps what
 * the reader is writing at that moment.
 *
 * Returns the address the sign-in should come back to: the page the draft
 * belongs on. That is the page the reader is on, unless a question on its
 * way says otherwise (see `noteQuestionInFlight`).
 *
 * Nothing is kept when nothing is written. Never throws: storage that is not
 * there, as in a private window, must not stand between the reader and the
 * sign-in.
 */
export function keepDraft(): string {
  const here = window.location.pathname + window.location.search;
  let page: string | undefined;
  try {
    page = questionInFlight?.page();
    const text = [...[...draftSources].map((read) => read()), questionInFlight?.text].find(
      (candidate): candidate is string => candidate !== undefined && candidate.trim() !== '',
    );
    // Without a known writer there is nobody to give it back to, and it could
    // be put in front of whoever signs in next.
    if (text !== undefined && signedInAs !== undefined) {
      const draft: StoredDraft = { text, path: page ?? window.location.pathname, user: signedInAs };
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  } catch {
    // The sign-in matters more than the draft.
  }
  return page ?? here;
}

/**
 * The draft kept for this page, without taking it. A stored value that is
 * not a whole draft is thrown away. Never throws.
 */
function draftFor(path: string): StoredDraft | undefined {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw === null) return undefined;
    const draft = JSON.parse(raw) as Partial<StoredDraft> | null;
    if (
      typeof draft?.text !== 'string' ||
      typeof draft.path !== 'string' ||
      typeof draft.user !== 'string'
    ) {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      return undefined;
    }
    return draft.path === path ? (draft as StoredDraft) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Put the draft kept for this page back, once, and only for the reader who
 * wrote it.
 *
 * Who that is, is known when `/api/me` has answered, so `put` is called then
 * and not at once. Somebody else signed in: the draft is thrown away and
 * never shown. No answer: it is left where it is. Removed as it is given
 * back, so a reload after that does not bring it back again. A draft from
 * another page is left for when the reader gets there.
 *
 * Returns the way to stop waiting, for a field that goes first.
 */
export function restoreDraft(
  put: (text: string) => void,
  path: string = window.location.pathname,
): () => void {
  const draft = draftFor(path);
  if (draft === undefined) return () => {};

  const abort = new AbortController();
  void signedInUser(abort.signal).then((user) => {
    if (abort.signal.aborted || user === undefined) return;
    // Taken again, so two fields waiting for the same answer put it back once.
    if (draftFor(path)?.text !== draft.text) return;
    forgetDraft();
    if (user === draft.user) put(draft.text);
  });
  return () => abort.abort();
}

/** Throw a kept draft away. Never throws. */
export function forgetDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Nothing kept, or nowhere to keep it: either way there is none.
  }
}

/** For tests: forget the fields, the question in flight and who is signed in. */
export function resetDraftSources(): void {
  draftSources.clear();
  questionInFlight = undefined;
  signedInAs = undefined;
}
