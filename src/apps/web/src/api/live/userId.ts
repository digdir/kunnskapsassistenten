// The `X-User-Id` that `/api/conversations` filters on when there is no login: a random id kept in
// `localStorage`; behind the test environment's login the server replaces it (server/identity.ts).
// A stand-in, not an identity: anyone with the API key can pass any id. A new shape gets a new key.
const STORAGE_KEY = 'ka.user.v1';

// Kept here too: `localStorage` throws in a private window and can be cleared, and without this
// every question would be a new user.
let cached: string | undefined;

// `randomUUID` needs a secure context. Fall back on `getRandomValues`, not `Math.random()`: the id
// keeps readers' threads apart and should not be guessable.
function newUserId(): string {
  if (typeof crypto.randomUUID === 'function') return `ka-${crypto.randomUUID()}`;

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `ka-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
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
    // Not writable either: the id lasts as long as the tab, which beats a new one per question.
  }

  return cached;
}

/** Only for tests: forget the cached id so the next call reads storage again. */
export function resetUserId(): void {
  cached = undefined;
}
