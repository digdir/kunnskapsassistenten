import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * A shared secret in front of the test environment, until the Entra login
 * is connected (docs/deploy.md, «Delt hemmelighet»).
 *
 * Lars shares one link, `https://<adressen>/?secret=…`. The first visit sets
 * a cookie and sends the reader on to the same address without the secret,
 * so it is not left in the address bar, in the history or in a `Referer`.
 * Without the cookie, everything but `/healthz` answers 401. With
 * `KA_ACCESS_SECRET` unset, none of this happens.
 *
 * The cookie is not the secret. It is an HMAC of a fixed string, keyed with
 * the secret: the same for everybody who has the link, useless for working
 * the secret out, and invalid the moment the secret is changed. No state on
 * the server, so it survives a restart and a second replica.
 */

export const ACCESS_COOKIE = 'ka_access';

/** Where the link carries the secret. */
const SECRET_PARAM = 'secret';

/**
 * What the HMAC is taken of. Versioned, so a change to the cookie's meaning
 * can invalidate every cookie without a new secret.
 */
const COOKIE_SUBJECT = 'ka-access-v1';

/**
 * 30 days. The link is shared by hand, and a tester should not need it again
 * every morning; a lost laptop's cookie should still run out on its own.
 * Changing the secret is the way to shut everybody out at once, and it works
 * at any age.
 */
export const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Shorter than this is refused at startup. `openssl rand -base64 32` gives
 * 43 characters; 24 leaves room for another generator and none for «test».
 */
export const MIN_SECRET_LENGTH = 24;

/** `KA_ACCESS_SECRET`, read strictly: blank is off, and a short one stops the server. */
export function accessSecretFrom(raw: string | undefined): string | undefined {
  const secret = raw?.trim() ?? '';
  if (secret === '') return undefined;
  if (secret.length < MIN_SECRET_LENGTH) {
    // The length and not the value: the value must never reach a log.
    throw new Error(
      `KA_ACCESS_SECRET er ${secret.length} tegn. Den må være minst ${MIN_SECRET_LENGTH}; se «Delt hemmelighet» i docs/deploy.md.`,
    );
  }
  return secret;
}

/** The cookie value the secret gives. */
export function accessToken(secret: string): string {
  return createHmac('sha256', secret).update(COOKIE_SUBJECT).digest('base64url');
}

/**
 * Equal in constant time, whatever the lengths. `timingSafeEqual` throws on
 * buffers of different length, and a length check first would tell the
 * caller the length; hashing both first makes them the same length always.
 */
function sameValue(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** One cookie from the `Cookie` header, or undefined. */
function cookie(request: IncomingMessage, name: string): string | undefined {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const split = part.indexOf('=');
    if (split === -1) continue;
    if (part.slice(0, split).trim() === name) return part.slice(split + 1).trim();
  }
  return undefined;
}

/**
 * `Secure` everywhere except on this machine. The server has no TLS of its
 * own, and not every browser keeps a `Secure` cookie that came over plain
 * `http`, even from localhost. In Azure the ingress does TLS, and the
 * browser sees `https`.
 */
function isLocal(request: IncomingMessage): boolean {
  const host = (request.headers.host ?? '').toLowerCase();
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
}

function denied(response: ServerResponse, path: string): void {
  const headers = {
    'Cache-Control': 'no-store',
    // A scheme of our own, so no browser opens a Basic login dialog.
    'WWW-Authenticate': 'KA-Link realm="Kunnskapsassistenten"',
  };
  if (path.startsWith('/api/') || path === '/api') {
    response.writeHead(401, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Tjenesten krever lenken du har fått.' }));
    return;
  }
  response.writeHead(401, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
  response.end(
    '<!doctype html><html lang="nb"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Krever lenke – Kunnskapsassistenten</title></head><body>' +
      '<main><h1>Tjenesten krever lenken du har fått</h1>' +
      '<p>Kunnskapsassistenten i testmiljøet er bare åpen for dem som har fått lenken. ' +
      'Åpne den på nytt, eller spør den som delte den.</p></main></body></html>\n',
  );
}

/**
 * The gate, for one request. True when the request may go on; otherwise the
 * response has been written, and the caller stops.
 *
 * `/healthz` is the caller's to let past before this, because the rollout
 * checks it without a cookie (deploy.yml).
 */
export function passesGate(
  request: IncomingMessage,
  response: ServerResponse,
  secret: string,
): boolean {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const given = url.searchParams.get(SECRET_PARAM);

  if (given !== null) {
    // A wrong secret is the same 401 as none, whatever cookie came with it.
    if (!sameValue(given, secret)) {
      denied(response, url.pathname);
      return false;
    }

    url.searchParams.delete(SECRET_PARAM);
    const query = url.searchParams.toString();
    /*
     * The same address, on this origin. The leading slashes are collapsed
     * because the URL parser turns `/.//evil.example` into the path
     * `//evil.example`, and a `Location` that starts with `//` is another
     * host to a browser.
     */
    const location = `/${url.pathname.replace(/^\/+/, '')}${query ? `?${query}` : ''}`;
    const attributes = [
      `${ACCESS_COOKIE}=${accessToken(secret)}`,
      'Path=/',
      `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
      'HttpOnly',
      'SameSite=Lax',
      ...(isLocal(request) ? [] : ['Secure']),
    ];
    response.writeHead(303, {
      Location: location,
      'Set-Cookie': attributes.join('; '),
      // The address with the secret in it is not passed on to anybody.
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
    });
    response.end();
    return false;
  }

  const token = cookie(request, ACCESS_COOKIE);
  if (token !== undefined && sameValue(token, accessToken(secret))) return true;

  denied(response, url.pathname);
  return false;
}
