import type { IncomingMessage, ServerResponse } from 'node:http';
import { passesGate } from './access.ts';
import { configScript, type ServerConfig } from './config.ts';
import { EXCERPTS_PATH, excerptRoute } from './excerpts.ts';
import { FACETS_PATH, facetRoute } from './facets.ts';
import { proxy } from './proxy.ts';
import { serveStatic } from './static.ts';

/**
 * Everything under this goes to the backend, and nothing else does — except
 * `/api/facets` and `/api/excerpts`, which this server answers itself
 * (facets.ts, excerpts.ts).
 */
const API_PREFIX = '/api/';

/**
 * The error codes a reader who left produces, and nothing else does.
 *
 * Measured, both of them: `ERR_STREAM_PREMATURE_CLOSE` is `pipeline` finding
 * the response closed before the file was sent — a reload while a bundle is
 * loading — and `ECONNRESET` («aborted») is the request closing before its
 * body was read. Neither is a fault of ours, and a log line per reload would
 * bury the ones that are.
 */
const READER_LEFT = new Set(['ERR_STREAM_PREMATURE_CLOSE', 'ECONNRESET']);

function readerLeft(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && READER_LEFT.has(code);
}

/**
 * Where a request's work ends up when it fails, instead of nowhere.
 *
 * Without this the handler's `void` left the promise's rejection unhandled,
 * and Node 24 ends the process on one: the demo on :8799 died of a reader
 * reloading the page on 28.09. In a container that is a restart, and every
 * other reader's streamed answer goes down with it.
 *
 * Caught per request and not with a process-wide `unhandledRejection`: that
 * would swallow the next unknown fault too and keep the process running in a
 * state nobody knows. Here the fault is known to belong to one response, and
 * closing that response is the whole of the damage.
 */
function settle(work: Promise<void>, response: ServerResponse): void {
  work.catch((error: unknown) => {
    if (readerLeft(error)) {
      // Nobody to answer; the socket is already closed or closing.
      response.destroy();
      return;
    }

    console.error('[ka] forespørselen feilet: %s', String(error));
    if (!response.headersSent) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Noe gikk galt på serveren.\n');
    } else {
      // The status line is gone; closing is all that is left to say.
      response.destroy();
    }
  });
}

/**
 * The one request handler: the API forwarded, the client served, and a few
 * small routes of the server's own.
 *
 * Exported apart from the listening socket so a test can mount it on a port
 * of its own choosing — the server is the thing under test, not the port
 * 8787 it happens to use in a container.
 */
export function createHandler(config: ServerConfig) {
  const facets = facetRoute(config.facets);
  const excerpts = excerptRoute(config.excerpts);

  return function handle(request: IncomingMessage, response: ServerResponse): void {
    const path = (request.url ?? '/').split('?')[0] ?? '/';

    if (path === '/healthz') {
      /*
       * `mode` and not just `ok`. A test environment that answers from
       * fixtures looks exactly like one answering from the backend until you
       * ask it a question, and «which of the two is this» is the first thing
       * anybody wants to know about a deployed instance.
       */
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(JSON.stringify({ ok: true, mode: config.mode }));
      return;
    }

    // Everything after /healthz is behind the shared secret, when there is
    // one: the client, /config.js and the API alike. See access.ts.
    if (config.accessSecret && !passesGate(request, response, config.accessSecret)) return;

    if (path === '/config.js') {
      response.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        // Never cached: it is how a redeploy changes the mode, and a cached
        // copy would keep an old one alive in a browser nobody can reach.
        'Cache-Control': 'no-store',
      });
      response.end(configScript(config.clientConfig));
      return;
    }

    // Before the proxy, or it would be forwarded to a backend that has no
    // such route. The exact paths only: `/api/facets/x` is the backend's. In
    // mock it is shut as the rest of /api/ is (proxy.ts): the client in mock
    // never asks, and Typesense should not be asked on its behalf (KA CC on
    // #173).
    if (path === FACETS_PATH || path === EXCERPTS_PATH) {
      if (config.mode === 'mock') {
        response.writeHead(404, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        response.end(JSON.stringify({ error: 'Ingen backend i mock-modus.' }));
        return;
      }
      settle((path === FACETS_PATH ? facets : excerpts)(request, response), response);
      return;
    }

    if (path.startsWith(API_PREFIX)) {
      settle(proxy(request, response, config), response);
      return;
    }

    /*
     * `/api` exactly, with nothing under it, is not the client's either. It
     * falls here rather than into the proxy on purpose — there is nothing at
     * the backend's root worth forwarding a browser to — and it must not
     * become `index.html`, or a mistyped endpoint answers with a page and the
     * client fails while parsing HTML as JSON.
     */
    if (path === '/api') {
      response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Ukjent endepunkt.' }));
      return;
    }

    settle(serveStatic(response, config.distDir, path), response);
  };
}
