import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ServerConfig } from './config.ts';
import { platformUserId } from './identity.ts';

/**
 * The client's headers that are forwarded, and nothing else.
 *
 * An allowlist rather than «everything except a few», because this server
 * stands between a browser and a credentialled backend: a header nobody
 * thought about should not travel by default. The four that do are the ones
 * the protocol needs — `Mcp-Method`, `Mcp-Name` and `MCP-Protocol-Version`
 * must agree with the body or the server answers 400 with -32020 — plus
 * `X-User-Id`, which is how `/api/conversations` knows whose threads these
 * are. Behind the login the browser's `X-User-Id` is replaced, see identity.ts.
 *
 * `Authorization` is deliberately absent. Nothing in this app sends one, and
 * a proxy that passes one along is a proxy that can be used to try somebody
 * else's credential against the backend.
 */
const FORWARDED = /^(content-type|accept|x-user-id|mcp-.*)$/i;

/** Response headers worth keeping. Length and encoding are ours to decide. */
const RETURNED = /^(content-type|cache-control)$/i;

/**
 * `userId` is the platform's signed-in user, or undefined when the browser's
 * own `X-User-Id` is the one that goes (`KA_USER_ID_FROM=browser`).
 */
function forwardedHeaders(
  request: IncomingMessage,
  config: ServerConfig,
  userId: string | undefined,
): Headers {
  const headers = new Headers();

  for (const [name, raw] of Object.entries(request.headers)) {
    if (!FORWARDED.test(name) || raw === undefined) continue;
    headers.set(name, Array.isArray(raw) ? raw.join(', ') : raw);
  }

  // Replaces whatever the browser sent, on every call. See identity.ts.
  if (userId !== undefined) headers.set('X-User-Id', userId);

  // The credential, added here and only here. See config.ts.
  if (config.apiKey) headers.set('X-API-Key', config.apiKey);

  /*
   * No compression on the streaming route. A gzip stream buffers, and then
   * the whole answer arrives at once at the end — which is the difference
   * between watching an answer build for 30–90 seconds and staring at nothing
   * for 30–90 seconds. Same line, same reason, as `vite.config.ts` has in
   * development.
   */
  headers.set('Accept-Encoding', 'identity');
  return headers;
}

/**
 * Where the call is actually going, or undefined when that is outside `/api/`.
 *
 * The prefix has to be checked on the address the fetch will use, not on the
 * string the browser sent, and those are not the same string. The URL parser
 * removes dot segments — `/api/../console-api/x` becomes `/console-api/x`,
 * and `%2e%2e` counts as `..` to it — so a `startsWith('/api/')` on the raw
 * request passed happily while the call landed on the console API with this
 * server's key attached. Found by KA CC on #151.
 *
 * Built by concatenating rather than resolving against a base, so a backend
 * address that carries a path of its own keeps it: `new URL('/api/mcp',
 * 'https://host/rag')` throws the `/rag` away, and the string does not.
 *
 * The checks after it are all one idea: a path whose meaning depends on how
 * the BACKEND decodes it is a path this server does not get to reason about,
 * so it refuses it. Measured shapes, all of which survive normalisation here
 * and may or may not escape `/api/` over there (KA CC on #151):
 *
 * | sendt | etter parsing | hva backend kan gjøre av det |
 * | --- | --- | --- |
 * | `/api/..%2fauth` | `/api/..%2fauth` | dekoder `%2f` → `/api/../auth` |
 * | `/api/..;/auth` | `/api/..;/auth` | stryker `;`-parameter → `/api/../auth` |
 * | `/api/%252e%252e/auth` | `/api/%252e%252e/auth` | dekoder to ganger → `/api/../auth` |
 * | `/api/....//auth` | `/api/....//auth` | stryker `../` én gang → `/api/../auth` |
 *
 * This is a blocklist, and a blocklist is the weaker kind. An allowlist on the
 * segment alphabet would be stronger and is not available: the ids in these
 * paths are the backend's — `5G7i1YoIdX432vrCDLrwk` today — and we do not get
 * to decide what characters it may mint tomorrow. What is refused here is
 * therefore the shapes, and none of them is a shape a real path has: no
 * address we call carries a semicolon, a double-encoded escape, a segment of
 * nothing but dots, or an empty segment in the middle.
 */
export function targetFor(apiBase: string, requestUrl: string): URL | undefined {
  let target: URL;
  let prefix: URL;
  try {
    target = new URL(`${apiBase}${requestUrl}`);
    prefix = new URL(`${apiBase}/api/`);
  } catch {
    return undefined;
  }

  /*
   * The path, and only the path. The origin is not checked because it cannot
   * differ: both strings start with `apiBase`, and a request path always
   * begins with `/`, so the authority is settled before the appended part
   * begins. A check there would compare a value with itself — measured, by a
   * mutation that stayed green with it removed.
   */
  if (!target.pathname.startsWith(prefix.pathname)) return undefined;

  // Semicolon: a path parameter to some servers, invisible to this one.
  // `%25`: an escaped escape, so what arrives here is not what the backend
  // will read. Both are checked before decoding, on what was actually sent.
  if (target.pathname.includes(';')) return undefined;
  if (/%25/i.test(target.pathname)) return undefined;

  let decoded: string;
  try {
    decoded = decodeURIComponent(target.pathname);
  } catch {
    // A malformed escape is not a path we forward.
    return undefined;
  }

  const segments = decoded.split('/');
  for (const [index, segment] of segments.entries()) {
    // `.`, `..`, `...`, `....` — a segment of nothing but dots is either a
    // traversal or a filter's bypass, and never an address.
    if (/^\.+$/.test(segment)) return undefined;
    // An empty segment is `//` in the middle. The first is the leading slash
    // and the last is a trailing one; both of those are ordinary.
    if (segment === '' && index !== 0 && index !== segments.length - 1) return undefined;
  }

  return target;
}

/**
 * The whole request body, up to a limit.
 *
 * Buffered because it is small — a question is a few hundred bytes of JSON —
 * and the limit is what makes «small» true rather than hoped for: without it
 * a client could stream gigabytes into this process's memory, and the only
 * thing standing between that and the container's memory cap would be the
 * client's own restraint.
 *
 * Returns undefined for a body over the limit; the caller answers 413.
 */
async function readBody(
  request: IncomingMessage,
  limit: number,
): Promise<Buffer | undefined | 'too-large'> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    // Stop reading rather than finish and then complain: the point of a limit
    // is the bytes that never arrive.
    if (size > limit) return 'too-large';
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * Forwards one `/api/*` call, with the key attached and the answer streamed.
 *
 * The REQUEST is buffered and the RESPONSE is streamed, and the asymmetry is
 * the point. A question is a few hundred bytes of JSON that arrives at once;
 * an answer is a server-sent event stream that takes 30–90 seconds and has to
 * reach the browser frame by frame. Buffering the request costs nothing and
 * saves the half-duplex dance that streaming it would need.
 *
 * No timeout is set here. Node's own `requestTimeout` is 300 s and the fetch
 * client's body timeout is 300 s, both above the 240 s a long answer may
 * need; a timeout of ours would only be a shorter one.
 */
export async function proxy(
  request: IncomingMessage,
  response: ServerResponse,
  config: ServerConfig,
): Promise<void> {
  /*
   * In mock nothing goes to the backend, key or no key. The client in mock
   * answers from its fixtures and never calls here, so a call that does is
   * somebody else's, and a key left set from a spell in live would otherwise
   * be put on it (KA CC on #169). The mode now means what docs/deploy.md
   * says it means.
   */
  if (config.mode === 'mock') {
    response.writeHead(404, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify({ error: 'Ingen backend i mock-modus.' }));
    return;
  }

  /*
   * Behind the login, a call without the platform's user is refused rather
   * than sent on as nobody or as whoever the browser claims to be. The login
   * in front means this should not happen; if it does, the login is not in
   * front, and 401 is the answer that says so. First, before the path is
   * looked at: a caller nobody knows learns nothing about what is here.
   */
  const userId = config.userIdFrom === 'platform' ? platformUserId(request) : undefined;
  if (config.userIdFrom === 'platform' && userId === undefined) {
    response.writeHead(401, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify({ error: 'Ikke innlogget.' }));
    return;
  }

  const target = targetFor(config.apiBase, request.url ?? '');
  if (target === undefined) {
    /*
      Outside `/api/`, so it is not this server's to forward. 404 and not 403:
      there is nothing here, and saying «forbidden» would confirm that
      something is there to be forbidden.
    */
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Ukjent endepunkt.' }));
    return;
  }

  const body = await readBody(request, config.maxBodyBytes);
  if (body === 'too-large') {
    response.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Forespørselen er for stor.' }));
    return;
  }

  /*
   * The reader pressing stop closes this socket, and the backend should hear
   * about it: an abandoned answer that keeps generating costs tokens and
   * holds a connection nobody is reading.
   */
  const controller = new AbortController();
  response.on('close', () => controller.abort());

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: forwardedHeaders(request, config, userId),
      body,
      signal: controller.signal,
    });
  } catch (error) {
    // The reader left; there is nobody to tell and nothing to log about.
    if (controller.signal.aborted) return;
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Fikk ikke kontakt med backend.' }));
    console.error('[ka] proxy mot %s feilet: %s', target.href, String(error));
    return;
  }

  const headers: Record<string, string> = {};
  upstream.headers.forEach((entry, name) => {
    if (RETURNED.test(name)) headers[name] = entry;
  });
  // Tells any intermediate proxy not to buffer the event stream. Azure
  // Container Apps' ingress is one such intermediate.
  headers['x-accel-buffering'] = 'no';

  response.writeHead(upstream.status, headers);

  if (!upstream.body) {
    response.end();
    return;
  }

  try {
    await pipeline(Readable.fromWeb(upstream.body), response);
  } catch {
    // A stream that broke mid-answer. The status line is long gone, so there
    // is nothing left to say in HTTP; closing is the whole of it.
    response.destroy();
  }
}
