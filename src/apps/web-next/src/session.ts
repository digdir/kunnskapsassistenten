// Who is signed in, from the server (`GET /api/next/me`), before the first render. Without a
// session the page goes to the sign-in, and comes back to the same address afterwards.
import { isAssistantLayout, type AssistantLayout } from '@genai/ui-blocks';

export interface Me {
  /** The person's name, as the profile button shows it. */
  name: string;
  /** Their organisation, under the name in the profile menu. */
  organisation?: string | undefined;
  /** KA's sign-out, a full navigation; `null` with sign-in off. */
  signOut: string | null;
  /** The genki service and variant asked, `kunnskapsassistenten__default`. */
  model: string;
  service: string;
  tenant: string;
  /** Rename and delete reach genki only with a person's token. */
  writes: boolean;
  /**
   * The layout from genki's builder the server was given (`KA_NEXT_LAYOUT`, decisions/0017),
   * checked there with genki's rules. Without it, the page draws KA's own.
   */
  layout?: AssistantLayout | undefined;
  /** This site serves only this client (`KA_NEXT_ONLY`): no apps/web, its pages nor a way back. */
  nextOnly?: boolean | undefined;
}

export class SignedOut extends Error {}

/** Where the sign-in starts, with the way back to this address. */
export const signInHref = (where: Location = location) =>
  `/auth/login?next=${encodeURIComponent(`${where.pathname}${where.search}`)}`;

const isMe = (value: unknown): value is Me => {
  if (typeof value !== 'object' || value === null) return false;
  const me = value as Record<string, unknown>;
  return (
    typeof me.name === 'string' &&
    typeof me.model === 'string' &&
    typeof me.service === 'string' &&
    typeof me.tenant === 'string' &&
    typeof me.writes === 'boolean' &&
    (me.layout === undefined || isAssistantLayout(me.layout)) &&
    (me.nextOnly === undefined || typeof me.nextOnly === 'boolean')
  );
};

/** The signed-in person, or `SignedOut` with a 401. */
export async function loadMe(fetcher: typeof fetch = fetch): Promise<Me> {
  const response = await fetcher('/api/next/me', { headers: { Accept: 'application/json' } });
  if (response.status === 401) throw new SignedOut();
  if (!response.ok) throw new Error(`GET /api/next/me ${response.status}`);
  const body: unknown = await response.json();
  if (!isMe(body)) throw new Error('GET /api/next/me: not the expected shape');
  return body;
}

/** Whether the session is gone, asked again after a call failed with 401. */
export async function sessionGone(fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    return (
      (await fetcher('/api/next/me', { headers: { Accept: 'application/json' } })).status ===
      401
    );
  } catch {
    return false;
  }
}
