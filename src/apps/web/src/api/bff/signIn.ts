let redirecting = false;

/**
 * Navigates to the BFF's sign-in, which returns to `returnTo`. Once per page, since several calls
 * fail with 401 at once when a session ends, and never from `/auth/`, which would loop.
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
