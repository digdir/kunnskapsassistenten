import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

/**
 * Which client's page a browser gets: `ny` is apps/web, `gammel` is
 * apps/web-preact. Only the page: each client asks for its own API version by
 * path (decisions/0009).
 */
export type Client = 'ny' | 'gammel';

export const CLIENT_COOKIE = 'ka_klient';

const ONE_YEAR = 60 * 60 * 24 * 365;

const isClient = (value: string | undefined): value is Client =>
  value === 'ny' || value === 'gammel';

/** The cookie, if it names a client, or else the default. */
export function chooseClient(cookie: string | undefined, fallback: Client): Client {
  return isClient(cookie) ? cookie : fallback;
}

export const clientOf = (c: Context, fallback: Client): Client =>
  chooseClient(getCookie(c, CLIENT_COOKIE), fallback);

/**
 * `KA_DEFAULT_CLIENT`: the client a browser without the cookie gets. The
 * current one, `gammel`, until it is decided otherwise.
 */
export function defaultClientFrom(raw: string | undefined): Client {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return 'gammel';
  if (isClient(value)) return value;
  throw new Error(`KA_DEFAULT_CLIENT må være ny eller gammel. Fikk "${raw}".`);
}

/**
 * `?klient=ny` and `?klient=gammel` set the cookie and send the browser to the
 * same address without the parameter, so a link copied afterwards does not
 * choose for whoever opens it. Any other value is left alone.
 */
export function switchByQuery(secure: boolean): MiddlewareHandler {
  return async (c, next) => {
    const asked = c.req.query('klient');
    if (!isClient(asked)) return next();
    setCookie(c, CLIENT_COOKIE, asked, {
      path: '/',
      maxAge: ONE_YEAR,
      httpOnly: true,
      sameSite: 'Lax',
      secure,
    });
    const url = new URL(c.req.url);
    url.searchParams.delete('klient');
    // A path on this host, and nothing else: `//host` or `/\host` in
    // Location is another host to the browser, and this runs before the
    // sign-in check. Every leading slash and backslash becomes one slash.
    const path = `/${url.pathname.replace(/^[/\\]+/, '')}`;
    return c.redirect(`${path}${url.search}`, 302);
  };
}
