let redirecting = false;

export function toLogin(): void {
  if (redirecting || location.pathname.startsWith('/auth/')) return;
  redirecting = true;
  const next = encodeURIComponent(location.pathname + location.search);
  location.assign(`/auth/login?next=${next}`);
}

export function installAuthRedirect(): void {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const res = await original(input, init);
    if (res.status === 401) {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/api/')) {
        toLogin();
      }
    }
    return res;
  };
}

/** Unreachable server counts as signed in: the app then shows its own error. */
export async function signedIn(): Promise<boolean> {
  try {
    const res = await fetch('/api/me');
    if (res.status === 401) return false;
    if (!res.ok) return true;
    const body = (await res.json()) as { authenticated?: boolean };
    return body.authenticated !== false;
  } catch {
    return true;
  }
}

/** Supabase drops the session on whatever Site URL points at, not just our callback. */
export async function claimFragmentSession(): Promise<boolean> {
  const token = new URLSearchParams(location.hash.slice(1)).get('access_token');
  if (!token) return false;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const res = await fetch('/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
