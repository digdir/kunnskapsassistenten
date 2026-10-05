/**
 * Who the backend thinks is asking, when there is no login.
 *
 * `/api/conversations` refuses a request without `X-User-Id` (400) and lists
 * only the conversations whose `conversation/user-id` equals it. Without a
 * sign-in the id is one we make up and keep: a random value in `localStorage`
 * under `ka.user.v1`. Behind the test environment's login the server throws
 * this one away and sends the signed-in user instead (`server/identity.ts`).
 *
 * **This is a stand-in, not an identity.** It is not a secret and it proves
 * nothing — anyone holding the API key can pass any id and read that user's
 * conversations, because the backend checks the header against the stored
 * value and nothing else. It exists so that one browser sees its own threads
 * and not every thread the key has ever created. The day the client only
 * runs behind a login, this file goes away. Written up in README under
 * «Live-modus».
 *
 * The version in the key is there for the day the shape changes: a stored id
 * that no longer means what it meant is a new key, not a migration.
 */
const STORAGE_KEY = 'ka.user.v1';

/**
 * The id for this browser, made on first use.
 *
 * Held in a module variable as well as in storage, and that is the case that
 * matters rather than a saving: `localStorage` throws in a private window and
 * in a browser with site data blocked, and it comes back empty after the
 * reader clears it. Without the fallback every question would be a new user
 * and the thread list would be empty every time. With it, the session at
 * least agrees with itself.
 */
let cached: string | undefined;

function newUserId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ka-${crypto.randomUUID()}`;
  }
  return `ka-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function currentUserId(): string {
  if (cached !== undefined) return cached;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null && stored.trim() !== '') {
      cached = stored;
      return cached;
    }
  } catch {
    // Storage is not readable. Fall through and make one for this session.
  }

  cached = newUserId();

  try {
    window.localStorage.setItem(STORAGE_KEY, cached);
  } catch {
    // Not writable either. The id lives as long as the tab does, which is
    // better than a new one per question.
  }

  return cached;
}

/** Only for tests: forget the cached id so the next call reads storage again. */
export function resetUserId(): void {
  cached = undefined;
}
