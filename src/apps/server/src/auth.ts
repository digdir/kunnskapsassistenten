import { randomUUID } from 'node:crypto';
import { ConfidentialClientApplication } from '@azure/msal-node';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { config } from './config.ts';
import { entraLoginPage } from './authPages.ts';

const MAX_AGE = 60 * 60 * 8;
const SCOPES = ['openid', 'profile', 'email'];

export interface User {
  id: string;
  name: string;
  email: string;
}

const msal =
  config.auth.mode === 'entra'
    ? new ConfidentialClientApplication({
        auth: {
          clientId: config.auth.clientId,
          authority: `https://login.microsoftonline.com/${config.auth.tenantId}`,
          clientSecret: config.auth.clientSecret,
        },
      })
    : null;

const secure = () => !config.auth.origin.startsWith('http://localhost');
// __Host- needs Secure, which a plain-http localhost cannot have.
const SESSION = secure() ? '__Host-ka_session' : 'ka_session';
const RETURN_TO = secure() ? '__Host-ka_return_to' : 'ka_return_to';

function cookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    secure: secure(),
    sameSite: 'Lax' as const,
    maxAge: MAX_AGE,
  };
}

export async function readUser(c: Context): Promise<User | null> {
  const raw = await getSignedCookie(c, config.auth.sessionSecret, SESSION);
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as User & { exp?: number };
    if (!u.id) return null;
    if (u.exp && Date.now() > u.exp) return null;
    return { id: u.id, name: u.name, email: u.email };
  } catch {
    return null;
  }
}

export function clearUser(c: Context): void {
  deleteCookie(c, SESSION, { path: '/' });
}

export async function writeUser(c: Context, user: User): Promise<void> {
  await setSignedCookie(
    c,
    SESSION,
    JSON.stringify({ ...user, exp: Date.now() + MAX_AGE * 1000 }),
    config.auth.sessionSecret,
    cookieOptions(),
  );
}

const UNSAFE_IN_PATH = /[\u0000-\u001f\u007f<>"'`\\]/;

export function safeReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith('/')) return '/';
  if (UNSAFE_IN_PATH.test(value)) return '/';
  if (value.startsWith('//')) return '/';
  let url: URL;
  try {
    url = new URL(value, 'http://ka.invalid');
  } catch {
    return '/';
  }
  if (url.origin !== 'http://ka.invalid') return '/';
  if (url.pathname.startsWith('/auth/')) return '/';
  return value;
}

export function mountAuth(app: {
  get: (path: string, handler: (c: Context) => Promise<Response> | Response) => unknown;
  post: (path: string, handler: (c: Context) => Promise<Response> | Response) => unknown;
}): void {
  if (!msal) return;

  app.get('/auth/login', (c) => c.html(entraLoginPage(safeReturnTo(c.req.query('next')))));

  app.get('/auth/start', async (c) => {
    const next = safeReturnTo(c.req.query('next'));
    const state = randomUUID();
    const pending = JSON.stringify({ state, next });
    await setSignedCookie(c, RETURN_TO, pending, config.auth.sessionSecret, {
      ...cookieOptions(),
      maxAge: 600,
    });
    const url = await msal.getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri: config.auth.redirectUri,
      state,
      prompt: 'select_account',
    });
    return c.redirect(url);
  });

  app.get('/auth/callback', async (c) => {
    if (c.req.query('error')) {
      return c.html(entraLoginPage('/', 'Innloggingen ble avbrutt. Prøv igjen.'), 400);
    }
    const code = c.req.query('code');
    if (!code) return c.html(entraLoginPage('/', 'Innloggingen feilet. Prøv igjen.'), 400);

    const pendingRaw = await getSignedCookie(c, config.auth.sessionSecret, RETURN_TO);
    deleteCookie(c, RETURN_TO, { path: '/' });
    let pending: { state?: string; next?: string } = {};
    try {
      pending = typeof pendingRaw === 'string' ? JSON.parse(pendingRaw) : {};
    } catch {}
    if (!pending.state || pending.state !== c.req.query('state')) {
      return c.html(
        entraLoginPage(
          '/',
          'Innloggingen tok for lang tid eller ble startet et annet sted. Prøv igjen.',
        ),
        400,
      );
    }

    try {
      const result = await msal.acquireTokenByCode({
        code,
        scopes: SCOPES,
        redirectUri: config.auth.redirectUri,
      });
      const claims = (result.idTokenClaims ?? {}) as Record<string, string>;
      const id = result.account?.homeAccountId ?? claims.oid ?? claims.sub;
      if (!id)
        return c.html(entraLoginPage('/', 'Fant ingen bruker i svaret fra Entra ID.'), 502);
      const email = claims.preferred_username ?? claims.email ?? '';
      await writeUser(c, {
        id,
        name: result.account?.name ?? claims.name ?? '',
        email,
      });
      return c.redirect(safeReturnTo(pending.next));
    } catch (err) {
      console.error('auth callback', err);
      return c.html(entraLoginPage('/', 'Innloggingen feilet. Prøv igjen.'), 502);
    }
  });

  app.get('/auth/logout', (c) => {
    deleteCookie(c, SESSION, { path: '/' });
    const post = encodeURIComponent(new URL('/', config.auth.redirectUri).toString());
    return c.redirect(
      `https://login.microsoftonline.com/${config.auth.tenantId}/oauth2/v2.0/logout` +
        `?post_logout_redirect_uri=${post}`,
    );
  });
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (!config.auth.enabled) return next();
  if (await readUser(c)) return next();
  return c.json({ error: 'Ikke innlogget.', login: '/auth/login' }, 401);
};
