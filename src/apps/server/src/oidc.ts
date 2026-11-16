/** Ansattporten for a confidential client: the code flow with PKCE, refresh and logout. */
import { createHash, createPublicKey, randomBytes, verify, type JsonWebKey } from 'node:crypto';
import type { Organisation } from './types.ts';

export interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}

export interface OidcClientOptions {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Sent as `resource`: the API the access token is for. */
  audience: string;
  altinnResource: string;
  fetch?: typeof fetch;
  now?: () => number;
}

export interface Tokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
  /** The ID token's claims, verified. Empty after a refresh without a new ID token. */
  id: Record<string, unknown>;
  /** The access token's claims, unverified: for reading only, genki verifies it. */
  access: Record<string, unknown>;
}

export class OidcError extends Error {}

export const ALTINN_RESOURCE_DETAIL = 'ansattporten:altinn:resource';

const base64url = (b: Buffer) => b.toString('base64url');

export const randomToken = () => base64url(randomBytes(24));

export const newPkce = () => {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
};

export function decodeJwt(token: string): Record<string, unknown> {
  const part = token.split('.')[1];
  if (!part) throw new OidcError('malformed token');
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}

const ORGNO = /^0192:(\d{9})$/;

/** The organisations in `authorization_details` for the Altinn resource, once each. */
export function organisationsFrom(
  claims: Record<string, unknown>,
  altinnResource: string,
): Organisation[] {
  const details = Array.isArray(claims.authorization_details)
    ? claims.authorization_details
    : [];
  const found = new Map<string, Organisation>();
  for (const d of details as Record<string, unknown>[]) {
    if (d?.type !== ALTINN_RESOURCE_DETAIL || d.resource !== altinnResource) continue;
    const parties = Array.isArray(d.authorized_parties) ? d.authorized_parties : [];
    for (const p of parties as Record<string, unknown>[]) {
      const id = (p?.orgno as { ID?: unknown } | undefined)?.ID;
      const match = typeof id === 'string' ? ORGNO.exec(id) : null;
      if (match?.[1] && !found.has(match[1]))
        found.set(match[1], {
          orgNumber: match[1],
          name: typeof p.name === 'string' && p.name ? p.name : match[1],
        });
    }
  }
  return [...found.values()];
}

export function createOidcClient(options: OidcClientOptions) {
  const send = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const now = options.now ?? (() => Date.now());
  let discovery: Promise<Discovery> | undefined;
  let keys: { at: number; keys: JsonWebKey[] } | undefined;

  const discover = () => {
    discovery ??= (async () => {
      const res = await send(`${options.issuer}/.well-known/openid-configuration`);
      if (!res.ok) throw new OidcError(`discovery failed with HTTP ${res.status}`);
      const doc = (await res.json()) as Discovery;
      if (doc.issuer !== options.issuer) throw new OidcError('discovery names another issuer');
      return doc;
    })().catch((err: unknown) => {
      discovery = undefined;
      throw err;
    });
    return discovery;
  };

  const jwks = async (refresh: boolean) => {
    if (!refresh && keys && now() - keys.at < 10 * 60_000) return keys.keys;
    const res = await send((await discover()).jwks_uri);
    if (!res.ok) throw new OidcError(`jwks failed with HTTP ${res.status}`);
    keys = { at: now(), keys: ((await res.json()) as { keys?: JsonWebKey[] }).keys ?? [] };
    return keys.keys;
  };

  const verifyIdToken = async (token: string, nonce: string | undefined) => {
    const [h, p, sig] = token.split('.');
    const header = JSON.parse(Buffer.from(h ?? '', 'base64url').toString('utf8')) as {
      alg?: string;
      kid?: string;
    };
    if (header.alg !== 'RS256') throw new OidcError('unexpected signing algorithm');
    let key = (await jwks(false)).find((k) => k.kid === header.kid);
    if (!key) key = (await jwks(true)).find((k) => k.kid === header.kid);
    if (!key || !sig) throw new OidcError('unknown signing key');
    const valid = verify(
      'RSA-SHA256',
      Buffer.from(`${h}.${p}`),
      createPublicKey({ key, format: 'jwk' }),
      Buffer.from(sig, 'base64url'),
    );
    if (!valid) throw new OidcError('bad signature');
    const claims = decodeJwt(token);
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== options.issuer) throw new OidcError('wrong issuer');
    if (!audience.includes(options.clientId)) throw new OidcError('wrong audience');
    if (typeof claims.exp !== 'number' || claims.exp < Math.floor(now() / 1000) - 30)
      throw new OidcError('expired');
    if (nonce !== undefined && claims.nonce !== nonce) throw new OidcError('nonce mismatch');
    if (typeof claims.sub !== 'string' || !claims.sub) throw new OidcError('no subject');
    return claims;
  };

  const tokenRequest = async (form: Record<string, string>, nonce: string | undefined) => {
    const basic = Buffer.from(
      `${encodeURIComponent(options.clientId)}:${encodeURIComponent(options.clientSecret)}`,
    ).toString('base64');
    const res = await send((await discover()).token_endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Basic ${basic}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form),
    });
    if (!res.ok) throw new OidcError(`token request failed with HTTP ${res.status}`);
    const body = (await res.json()) as {
      access_token?: string;
      id_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!body.access_token) throw new OidcError('no access token');
    const id = body.id_token ? await verifyIdToken(body.id_token, nonce) : {};
    const access = decodeJwt(body.access_token);
    const expiresAt =
      typeof access.exp === 'number'
        ? access.exp * 1000
        : now() + Math.max(0, body.expires_in ?? 120) * 1000;
    const tokens: Tokens = { accessToken: body.access_token, expiresAt, id, access };
    if (body.refresh_token) tokens.refreshToken = body.refresh_token;
    if (body.id_token) tokens.idToken = body.id_token;
    return tokens;
  };

  return {
    discover,

    authorizeUrl: async (p: { state: string; nonce: string; challenge: string }) => {
      const url = new URL((await discover()).authorization_endpoint);
      const params: Record<string, string> = {
        response_type: 'code',
        client_id: options.clientId,
        redirect_uri: options.redirectUri,
        scope: 'openid profile',
        state: p.state,
        nonce: p.nonce,
        code_challenge: p.challenge,
        code_challenge_method: 'S256',
        resource: options.audience,
        ui_locales: 'nb',
        authorization_details: JSON.stringify([
          { type: ALTINN_RESOURCE_DETAIL, resource: options.altinnResource },
        ]),
      };
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      return url.toString();
    },

    exchange: async (code: string, verifier: string, nonce: string) => {
      const tokens = await tokenRequest(
        {
          grant_type: 'authorization_code',
          code,
          code_verifier: verifier,
          redirect_uri: options.redirectUri,
        },
        nonce,
      );
      if (!tokens.idToken) throw new OidcError('no id token');
      return tokens;
    },

    refresh: (refreshToken: string) =>
      tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken }, undefined),

    /** `undefined` when the issuer has no end_session_endpoint. */
    endSessionUrl: async (idToken: string, postLogoutRedirectUri: string) => {
      const end = (await discover()).end_session_endpoint;
      if (!end) return undefined;
      const url = new URL(end);
      url.searchParams.set('id_token_hint', idToken);
      url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
      url.searchParams.set('state', randomToken());
      return url.toString();
    },
  };
}

export type OidcClient = ReturnType<typeof createOidcClient>;
