/** AUTH_MODE=ansattporten: the person signs in here, and genki is asked with their token (decisions/0011). */
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import {
  clearUser,
  cookieOptions,
  readSessionId,
  readUser,
  RETURN_TO,
  safeReturnTo,
  secure,
  writeUser,
} from './auth.ts';
import { ansattportenLoginPage, noAccessPage, organisationPage } from './authPages.ts';
import { knownProblem } from './backend.ts';
import { config } from './config.ts';
import {
  createOidcClient,
  newPkce,
  organisationsFrom,
  randomToken,
  type OidcClient,
  type Tokens,
} from './oidc.ts';
import type { SessionVars } from './session.ts';
import {
  dropTokens,
  getTokens,
  newSessionId,
  setTokens,
  type TokenSession,
} from './tokenStore.ts';
import type { Organisation } from './types.ts';

const REFRESH_MARGIN_MS = 60_000;

const NO_ORGANISATION =
  'Innloggingen virket, men du har ikke tilgang til tjenesten for noen virksomhet. Be den som forvalter tilganger i Altinn for virksomheten din om tilgang.';

type Routes = {
  get: (path: string, handler: (c: Context) => Promise<Response> | Response) => unknown;
  post: (path: string, handler: (c: Context) => Promise<Response> | Response) => unknown;
};

let client: OidcClient | undefined;

export function ansattportenClient(): OidcClient {
  const a = config.auth.ansattporten;
  client ??= createOidcClient({
    issuer: a.issuer,
    clientId: a.clientId,
    clientSecret: a.clientSecret,
    redirectUri: a.redirectUri,
    audience: a.audience,
    altinnResource: a.altinnResource,
  });
  return client;
}

const text = (...values: unknown[]) =>
  values.find((v): v is string => typeof v === 'string' && v.length > 0);

type Access = { organisations: Organisation[] } | { refused: string };

/**
 * The organisations from the token, or from genki's `GET /me` when the token
 * lists none, as an Entra ID login through Ansattporten does.
 */
export async function organisationsFor(tokens: Tokens): Promise<Access> {
  const resource = config.auth.ansattporten.altinnResource;
  const listed = organisationsFrom(tokens.access, resource);
  const found = listed.length ? listed : organisationsFrom(tokens.id, resource);
  if (found.length) return { organisations: found };
  const res = await fetch(`${config.apiBase}/me`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${tokens.accessToken}` },
  });
  const problem = await knownProblem(res.clone());
  if (problem) return { refused: problem.message };
  if (!res.ok) throw new Error(`GET /me ${res.status}`);
  const body = (await res.json()) as {
    organisations?: Array<{ orgNumber?: unknown; name?: unknown }>;
  };
  const organisations = (body.organisations ?? []).flatMap((o) =>
    typeof o.orgNumber === 'string'
      ? [{ orgNumber: o.orgNumber, name: text(o.name) ?? o.orgNumber }]
      : [],
  );
  return { organisations };
}

const refreshing = new Map<string, Promise<TokenSession | undefined>>();

/** The session's tokens, refreshed when they are about to run out. `undefined`: sign in again. */
export async function freshTokens(sid: string | undefined): Promise<TokenSession | undefined> {
  const session = getTokens(sid);
  if (!sid || !session || session.refused) return undefined;
  if (session.expiresAt - REFRESH_MARGIN_MS > Date.now()) return session;
  if (!session.refreshToken) {
    dropTokens(sid);
    return undefined;
  }
  const running = refreshing.get(sid);
  if (running) return running;
  const refreshToken = session.refreshToken;
  const next = ansattportenClient()
    .refresh(refreshToken)
    .then((tokens) => {
      const renewed: TokenSession = {
        ...session,
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        refreshToken: tokens.refreshToken ?? refreshToken,
        ...(tokens.idToken ? { idToken: tokens.idToken } : {}),
      };
      setTokens(sid, renewed);
      return renewed;
    })
    .catch((err: unknown) => {
      console.error('ansattporten refresh', err);
      dropTokens(sid);
      return undefined;
    })
    .finally(() => refreshing.delete(sid));
  refreshing.set(sid, next);
  return next;
}

const needsChoice = (s: TokenSession) => s.organisations.length > 1 && !s.actingFor;

/** For `/api/*`: the person's token as the caller, or 401 so the client signs in again. */
export const requireAnsattporten: MiddlewareHandler<{ Variables: SessionVars }> = async (
  c,
  next,
) => {
  const user = await readUser(c);
  const session = user ? await freshTokens(await readSessionId(c)) : undefined;
  if (!user || !session || needsChoice(session))
    return c.json({ error: 'Ikke innlogget.', login: '/auth/login' }, 401);
  c.set('caller', {
    userId: user.id,
    token: session.accessToken,
    ...(session.actingFor ? { actingFor: session.actingFor } : {}),
  });
  return next();
};

export function mountAnsattporten(app: Routes, oidc: OidcClient = ansattportenClient()): void {
  client = oidc;

  app.get('/auth/login', async (c) => {
    const next = safeReturnTo(c.req.query('next'));
    const session = getTokens(await readSessionId(c));
    if (session?.refused) return c.html(noAccessPage(session.refused), 403);
    if (session && needsChoice(session))
      return c.redirect(`/auth/org?next=${encodeURIComponent(next)}`);
    return c.html(ansattportenLoginPage(next));
  });

  app.get('/auth/start', async (c) => {
    const pkce = newPkce();
    const pending = {
      state: randomToken(),
      nonce: randomToken(),
      verifier: pkce.verifier,
      next: safeReturnTo(c.req.query('next')),
    };
    await setSignedCookie(c, RETURN_TO, JSON.stringify(pending), config.auth.sessionSecret, {
      ...cookieOptions(),
      maxAge: 600,
    });
    try {
      return c.redirect(
        await oidc.authorizeUrl({
          state: pending.state,
          nonce: pending.nonce,
          challenge: pkce.challenge,
        }),
      );
    } catch (err) {
      console.error('ansattporten start', err);
      return c.html(ansattportenLoginPage('/', 'Ansattporten svarer ikke. Prøv igjen.'), 502);
    }
  });

  app.get('/auth/callback', async (c) => {
    const raw = await getSignedCookie(c, config.auth.sessionSecret, RETURN_TO);
    deleteCookie(c, RETURN_TO, { path: '/', secure: secure() });
    let pending: { state?: string; nonce?: string; verifier?: string; next?: string } = {};
    try {
      pending = typeof raw === 'string' ? JSON.parse(raw) : {};
    } catch {}
    if (c.req.query('error'))
      return c.html(ansattportenLoginPage('/', 'Innloggingen ble avbrutt. Prøv igjen.'), 400);
    const code = c.req.query('code');
    if (
      !code ||
      !pending.state ||
      !pending.nonce ||
      !pending.verifier ||
      pending.state !== c.req.query('state')
    ) {
      return c.html(
        ansattportenLoginPage(
          '/',
          'Innloggingen tok for lang tid eller ble startet et annet sted. Prøv igjen.',
        ),
        400,
      );
    }

    let tokens: Tokens;
    let access: Access;
    try {
      tokens = await oidc.exchange(code, pending.verifier, pending.nonce);
      access = await organisationsFor(tokens);
    } catch (err) {
      console.error('ansattporten callback', err);
      return c.html(ansattportenLoginPage('/', 'Innloggingen feilet. Prøv igjen.'), 502);
    }

    const { id, access: claims } = tokens;
    const email = text(id.email, claims.email) ?? '';
    dropTokens(await readSessionId(c));
    const sid = newSessionId();
    const organisations = 'organisations' in access ? access.organisations : [];
    const refused =
      'refused' in access
        ? access.refused
        : organisations.length === 0
          ? NO_ORGANISATION
          : undefined;
    setTokens(sid, {
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
      organisations,
      createdAt: Date.now(),
      ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
      ...(tokens.idToken ? { idToken: tokens.idToken } : {}),
      ...(refused ? { refused } : {}),
    });
    await writeUser(
      c,
      {
        id: `ansattporten:${String(id.sub)}`,
        name: text(id.name, claims.name, email) ?? '',
        email,
      },
      sid,
    );
    const next = safeReturnTo(pending.next);
    const stored = getTokens(sid)!;
    if (stored.refused) return c.html(noAccessPage(stored.refused), 403);
    if (needsChoice(stored)) return c.redirect(`/auth/org?next=${encodeURIComponent(next)}`);
    return c.redirect(next);
  });

  app.get('/auth/org', async (c) => {
    const session = getTokens(await readSessionId(c));
    if (!session || session.refused) return c.redirect('/auth/login');
    return c.html(
      organisationPage(
        session.organisations,
        safeReturnTo(c.req.query('next')),
        session.actingFor,
      ),
    );
  });

  app.post('/auth/org', async (c) => {
    const sid = await readSessionId(c);
    const session = getTokens(sid);
    if (!sid || !session || session.refused) return c.redirect('/auth/login');
    const form = await c.req.parseBody();
    const org = typeof form.org === 'string' ? form.org : '';
    const next = safeReturnTo(typeof form.next === 'string' ? form.next : undefined);
    if (!session.organisations.some((o) => o.orgNumber === org))
      return c.html(organisationPage(session.organisations, next, session.actingFor), 400);
    setTokens(sid, { ...session, actingFor: org });
    return c.redirect(next);
  });

  app.get('/auth/logout', async (c) => {
    // As for Entra (auth.ts): only a page load ends the session.
    const dest = c.req.header('Sec-Fetch-Dest');
    if (dest && dest !== 'document')
      return c.text('Utlogging skjer bare når siden lastes.', 403);
    const idToken = getTokens(await readSessionId(c))?.idToken;
    await clearUser(c);
    if (idToken) {
      try {
        const url = await oidc.endSessionUrl(idToken, `${config.auth.origin}/`);
        if (url) return c.redirect(url);
      } catch (err) {
        console.error('ansattporten logout', err);
      }
    }
    return c.redirect('/auth/login');
  });
}
