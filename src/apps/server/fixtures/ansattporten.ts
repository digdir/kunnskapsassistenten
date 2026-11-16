/**
 * A fake Ansattporten and a fake genki on localhost, for ansattporten.test.ts and testers.test.ts.
 * The tokens are signed with a key made here, and say nothing true.
 */
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
  type KeyObject,
} from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

export const ALTINN_RESOURCE = 'urn:altinn:resource:digdir-genai-platform-test';

export interface FakeLogin {
  sub?: string;
  name?: string;
  email?: string;
  /** None: the token lists no organisations, as an Entra ID login does. */
  parties?: Array<{ orgNumber: string; name: string }>;
  nonce?: string;
  issuer?: string;
  audience?: string;
  accessExpiresIn?: number;
  idExpiresIn?: number;
  signWith?: 'trusted' | 'stranger' | 'none';
}

const base64url = (b: Buffer) => b.toString('base64url');

const jwt = (
  claims: Record<string, unknown>,
  key: KeyObject,
  kid: string,
  unsigned = false,
) => {
  const alg = unsigned ? 'none' : 'RS256';
  const head = base64url(Buffer.from(JSON.stringify({ alg, kid, typ: 'JWT' })));
  const body = base64url(Buffer.from(JSON.stringify(claims)));
  if (unsigned) return `${head}.${body}.`;
  const signature = sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key);
  return `${head}.${body}.${base64url(signature)}`;
};

const listen = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let raw = '';
    req.on('data', (c: Buffer) => (raw += c.toString()));
    req.on('end', () => resolve(raw));
  });

const json = (
  res: ServerResponse,
  status: number,
  body: unknown,
  type = 'application/json',
) => {
  res.writeHead(status, { 'content-type': type });
  res.end(JSON.stringify(body));
};

const close = (server: Server) =>
  new Promise<void>((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });

export async function startFakeAnsattporten(clientId: string, clientSecret: string) {
  const trusted = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const stranger = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key';
  const codes = new Map<string, { challenge: string; nonce: string; login: FakeLogin }>();
  const refreshTokens = new Map<string, FakeLogin>();
  const tokenRequests: Array<{ form: Record<string, string>; authorization?: string }> = [];
  let next: FakeLogin = {};
  let issued = 0;
  let refuseRefresh = false;

  const tokensFor = (login: FakeLogin, nonce: string | undefined) => {
    issued += 1;
    const now = Math.floor(Date.now() / 1000);
    const parties = login.parties ?? [];
    const details = login.parties
      ? [
          {
            type: 'ansattporten:altinn:resource',
            resource: ALTINN_RESOURCE,
            authorized_parties: parties.map((p) => ({
              orgno: { authority: 'iso6523-actorid-upis', ID: `0192:${p.orgNumber}` },
              name: p.name,
            })),
          },
        ]
      : undefined;
    const key = login.signWith === 'stranger' ? stranger.privateKey : trusted.privateKey;
    const common = {
      iss: login.issuer ?? issuer,
      sub: login.sub ?? 'pairwise-subject',
      iat: now,
      ...(login.email ? { email: login.email } : {}),
      ...(details ? { authorization_details: details } : { acr: 'entraid' }),
    };
    const refreshToken = `rt-${issued}`;
    refreshTokens.set(refreshToken, login);
    return {
      id_token: jwt(
        {
          ...common,
          aud: login.audience ?? clientId,
          exp: now + (login.idExpiresIn ?? 600),
          ...(login.name ? { name: login.name } : {}),
          ...(nonce !== undefined ? { nonce: login.nonce ?? nonce } : {}),
        },
        key,
        kid,
        login.signWith === 'none',
      ),
      access_token: jwt(
        {
          ...common,
          aud: 'digdir:genai',
          client_id: clientId,
          exp: now + (login.accessExpiresIn ?? 600),
          n: issued,
        },
        key,
        kid,
      ),
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: login.accessExpiresIn ?? 600,
    };
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://fake');
    if (url.pathname === '/.well-known/openid-configuration')
      return json(res, 200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        end_session_endpoint: `${issuer}/logout`,
      });
    if (url.pathname === '/jwks')
      return json(res, 200, {
        keys: [{ ...trusted.publicKey.export({ format: 'jwk' }), kid, use: 'sig' }],
      });
    if (url.pathname === '/token' && req.method === 'POST') {
      const form = Object.fromEntries(new URLSearchParams(await readBody(req)));
      const authorization = req.headers.authorization;
      tokenRequests.push({ form, ...(authorization ? { authorization } : {}) });
      const basic = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
      if (authorization !== basic) return json(res, 401, { error: 'invalid_client' });
      if (form.grant_type === 'refresh_token') {
        if (refuseRefresh) return json(res, 400, { error: 'invalid_grant' });
        const login = refreshTokens.get(form.refresh_token ?? '');
        refreshTokens.delete(form.refresh_token ?? '');
        if (!login) return json(res, 400, { error: 'invalid_grant' });
        const { id_token: _, ...rest } = tokensFor(login, undefined);
        return json(res, 200, rest);
      }
      const code = codes.get(form.code ?? '');
      codes.delete(form.code ?? '');
      const challenge = base64url(
        createHash('sha256')
          .update(form.code_verifier ?? '')
          .digest(),
      );
      if (!code || code.challenge !== challenge)
        return json(res, 400, { error: 'invalid_grant' });
      return json(res, 200, tokensFor(code.login, code.nonce));
    }
    json(res, 404, { error: 'not found' });
  });
  const issuer = await listen(server);

  return {
    issuer,
    tokenRequests,
    nextLogin: (login: FakeLogin) => {
      next = login;
    },
    refuseRefresh: (refuse: boolean) => {
      refuseRefresh = refuse;
    },
    /** What the person's browser does at the authorize endpoint: a code for the redirect. */
    authorize: (authorizeUrl: string) => {
      const q = new URL(authorizeUrl).searchParams;
      const code = base64url(randomBytes(16));
      codes.set(code, {
        challenge: q.get('code_challenge') ?? '',
        nonce: q.get('nonce') ?? '',
        login: next,
      });
      return { code, state: q.get('state') ?? '' };
    },
    close: () => close(server),
  };
}

export interface GenkiRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: string;
}

const problem = (type: string, title: string) => ({ type, title, status: 403, detail: title });

/** genki's calls the client makes through the server, and genki's own `/me`. */
export async function startFakeGenki() {
  const requests: GenkiRequest[] = [];
  const state = {
    me: { organisations: [] as Array<{ orgNumber: string; name: string; rights: string[] }> },
    meRefused: false,
    locked: false,
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://fake');
    const body = await readBody(req);
    requests.push({
      method: req.method ?? 'GET',
      path: url.pathname,
      headers: {
        authorization: req.headers.authorization,
        'genai-acting-for': req.headers['genai-acting-for'] as string | undefined,
        'genai-environment': req.headers['genai-environment'] as string | undefined,
        'x-api-key': req.headers['x-api-key'] as string | undefined,
        'x-user-id': req.headers['x-user-id'] as string | undefined,
      },
      body,
    });
    const problemJson = 'application/problem+json';
    if (url.pathname === '/me')
      return state.meRefused
        ? json(
            res,
            403,
            problem('urn:genai:problem:entra-not-trusted', 'Entra login not trusted'),
            problemJson,
          )
        : json(res, 200, state.me);
    if (url.pathname === '/v1/models') return json(res, 200, { data: [] });
    if (url.pathname === '/api/conversations' && req.method === 'POST')
      return json(res, 201, { conversation: { id: 'c1', topic: 'Spørsmål' } });
    if (url.pathname === '/api/conversations')
      return json(res, 200, { conversations: [{ id: 'c1', topic: 'Spørsmål', created: 1 }] });
    if (url.pathname === '/api/conversations/c1')
      return json(res, 200, {
        conversation: { id: 'c1', topic: 'Spørsmål', created: 1 },
        messages: [
          { id: 'm1', role: 'user', text: 'Spørsmål', created: 1 },
          { id: 'm2', role: 'assistant', text: 'Svar.', created: 2, task: 't1' },
        ],
      });
    if (url.pathname === '/api/feedback') return json(res, 201, { ok: true, task: 't1' });
    if (url.pathname === '/v1/chat/completions') {
      if (state.locked)
        return json(
          res,
          403,
          problem('urn:genai:problem:locked-environment', 'The environment is locked'),
          problemJson,
        );
      res.writeHead(200, { 'content-type': 'text/event-stream', 'genai-task': 't1' });
      res.end('data: {"choices":[{"delta":{"content":"Svar."}}]}\n\ndata: [DONE]\n\n');
      return;
    }
    json(res, 404, { error: 'not found' });
  });
  const base = await listen(server);
  return { base, requests, state, close: () => close(server) };
}
