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
 * The reader's session from the BFF's `/api/me`. Undefined with auth off (a
 * «Logg ut» would sign nobody out) and on any failure: the name is a courtesy.
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
 * What «Logg ut» clears, since answers, draft, agent, filter and corpus are kept
 * per browser and not per user (src/decisions/0008). Synchronous, so it is
 * done before the browser follows the link to `/auth/logout`.
 */
export function beforeLogout(): void {
  forgetAllAnswers();
  forgetDraft();
  forgetAgentChoice();
  forgetFlags();
  forgetStoredFilter();
  forgetCorpusChoice();
}

// The compose field's text when a 401 sends the browser to sign in (the BFF
// session is not renewed). In `sessionStorage` with the page it was written
// on, so it comes back in the same tab and thread only.
const DRAFT_STORAGE_KEY = 'ka.draft.v1';

/** `user` is who wrote it, as `noteSignedIn` heard it. */
type StoredDraft = { text: string; path: string; user: string };

// Who `/api/me` says is signed in. A kept draft goes back only to the same id:
// on a shared machine the tab that signs in again may be someone else's.
let signedInAs: string | undefined;

/** `/api/me` has answered: called here and by the BFF client's `listAgents`. */
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

/** A question sent and not yet answered, and the page it belongs on if not this one. */
let questionInFlight: { text: string; page: () => string | undefined } | undefined;

/** A compose field says how to read its text. Returns the way to take that back. */
export function provideDraft(read: () => string): () => void {
  draftSources.add(read);
  return () => {
    draftSources.delete(read);
  };
}

/**
 * A question is on its way; returns the way to say it has arrived. The field is
 * empty by then, so on a 401 the question is what the reader would lose. `page`
 * overrides a stand-in thread address, which a 401 means will never exist.
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
 * Keep the field's text, or else the question on its way, just before sign-in,
 * and return the address to come back to. Never throws: missing storage must
 * not stand between the reader and the sign-in.
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

/** The draft kept for this page, without taking it; a malformed one is dropped. */
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
 * Put the draft for this page back once, when `/api/me` says its writer is
 * signed in; anyone else gets it thrown away. Returns the way to stop waiting.
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
