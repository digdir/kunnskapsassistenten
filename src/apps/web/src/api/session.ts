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
 * Only the BFF signs anybody in (Entra, `docs/arkitektur/0002`), and it says
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
 * reader's questions per browser and not per user (docs/arkitektur/0005).
 * Lars said yes to this on 5.10. Synchronous, and called from the link's
 * click, so it is done before the browser follows the link to
 * `/auth/logout`.
 */
export function beforeLogout(): void {
  forgetAllAnswers();
}
