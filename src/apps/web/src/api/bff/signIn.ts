let redirecting = false;

/**
 * To the BFF's sign-in, and back to `returnTo`: where the reader was, or where
 * the draft kept for them belongs (session.ts, `keepDraft`).
 *
 * Once per page, for every caller: several calls fail with 401 at once when a
 * session runs out, from the chat client and the thread actions alike, and
 * one navigation is enough. Not from `/auth/` itself, which would loop.
 */
export function toLogin(returnTo: string): void {
  if (redirecting || window.location.pathname.startsWith('/auth/')) return;
  redirecting = true;
  window.location.assign(`/auth/login?next=${encodeURIComponent(returnTo)}`);
}

/** For tests: forget that a sign-in redirect has been started. */
export function resetSignIn(): void {
  redirecting = false;
}
