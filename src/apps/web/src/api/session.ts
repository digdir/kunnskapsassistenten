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
    const response = await fetch('/api/me', { credentials: 'same-origin', signal });
    if (!response.ok) return undefined;
    const body = (await response.json()) as {
      authEnabled?: boolean;
      user?: { name?: string; email?: string } | null;
    };
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
 * Lars said yes to this on 5.10. Synchronous, and called from the link's
 * click, so it is done before the browser follows the link to
 * `/auth/logout`.
 *
 * A draft kept from an expired session goes too: it was written by the
 * reader who is signing out, and the next one to sign in in this tab is not
 * necessarily them.
 */
export function beforeLogout(): void {
  forgetAllAnswers();
  forgetDraft();
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

type StoredDraft = { text: string; path: string };

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
    if (text !== undefined) {
      const draft: StoredDraft = { text, path: page ?? window.location.pathname };
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  } catch {
    // The sign-in matters more than the draft.
  }
  return page ?? here;
}

/**
 * The draft kept for this page, once.
 *
 * Read and removed in one go, so a reload after it has been put back does not
 * bring it back again. A draft from another page is left for when the reader
 * gets there. Never throws.
 */
export function takeDraft(path: string = window.location.pathname): string | undefined {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw === null) return undefined;
    const draft = JSON.parse(raw) as Partial<StoredDraft> | null;
    if (typeof draft?.text !== 'string' || typeof draft.path !== 'string') {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      return undefined;
    }
    if (draft.path !== path) return undefined;
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    return draft.text;
  } catch {
    return undefined;
  }
}

/** Throw a kept draft away. Never throws. */
export function forgetDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Nothing kept, or nowhere to keep it: either way there is none.
  }
}

/** For tests: forget the fields and the question in flight. */
export function resetDraftSources(): void {
  draftSources.clear();
  questionInFlight = undefined;
}
