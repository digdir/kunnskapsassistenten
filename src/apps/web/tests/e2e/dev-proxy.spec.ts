import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

/*
 * The live dev proxy speaks for the server, not for the browser (vite.config.ts): toward the
 * backend it drops `Origin` and `Referer`, as server/proxy.ts forwards neither. genki-test refuses
 * the key on any call that carries an `Origin` (401, measured 2026-10-19), so a proxy that let it
 * through would break every question in development. Toward the BFF both stay, because the BFF
 * checks `Origin` against cross-site requests.
 *
 * No browser here: a real dev server from this app's config, in front of a stand-in that records
 * what reaches it. The request is sent from Node, because a browser decides for itself when a
 * request carries an `Origin`.
 */

const WEB_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PAGE = { origin: 'http://localhost:5173', referer: 'http://localhost:5173/threads/abc' };

type Seen = { url: string | undefined; headers: http.IncomingHttpHeaders };

/** A stand-in for the backend or the BFF, on a free port, that records every request. */
async function standIn() {
  const seen: Seen[] = [];
  const server = http.createServer((request, response) => {
    seen.push({ url: request.url, headers: request.headers });
    request.resume();
    request.on('end', () => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end('{}');
    });
  });
  await new Promise<void>((listening) => server.listen(0, '127.0.0.1', listening));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    seen,
    close: () => new Promise<void>((closed) => server.close(() => closed())),
  };
}

/**
 * The dev server as `npm run dev` starts it, with `env` in place while the config is read: the
 * proxy's target and key are fixed then. A value already in `process.env` beats `.env.local`, so a
 * developer's own file does not change the outcome.
 *
 * Each server gets a cache folder of its own. In the shared `node_modules/.vite` two servers
 * starting at once raced on renaming `deps` (ENOTEMPTY, two in 30 runs), and one could disturb a
 * developer's own dev server.
 */
async function devServer(
  env: Record<string, string>,
): Promise<{ server: ViteDevServer; close: () => Promise<void> }> {
  const before = Object.fromEntries(Object.keys(env).map((name) => [name, process.env[name]]));
  const cacheDir = mkdtempSync(join(tmpdir(), 'ka-dev-proxy-'));
  const removeCache = () => rmSync(cacheDir, { recursive: true, force: true });
  Object.assign(process.env, env);
  try {
    const server = await createServer({
      root: WEB_ROOT,
      configFile: `${WEB_ROOT}vite.config.ts`,
      cacheDir,
      logLevel: 'silent',
      server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    await server.listen();
    return {
      server,
      close: async () => {
        await server.close();
        removeCache();
      },
    };
  } catch (error) {
    removeCache();
    throw error;
  } finally {
    for (const [name, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

/** `POST /api/mcp` through the dev server, with the headers the page's own request carries. */
function askFromThePage(server: ViteDevServer): Promise<number> {
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('The dev server has no port.');
  const { port } = address;
  return new Promise((answered, failed) => {
    const request = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/api/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: PAGE.origin,
          Referer: PAGE.referer,
          'X-User-Id': 'ka-guard',
        },
      },
      (response) => {
        response.resume();
        response.on('end', () => answered(response.statusCode ?? 0));
      },
    );
    request.on('error', failed);
    request.end('{}');
  });
}

test.describe('the dev proxy and the page’s Origin', () => {
  test('in live, Origin and Referer stop at the proxy, and the key goes on', async () => {
    const backend = await standIn();
    const { server, close } = await devServer({
      VITE_API_MODE: 'live',
      KA_API_URL: backend.url,
      KA_API_KEY: 'guard-key',
    });
    try {
      expect(await askFromThePage(server)).toBe(200);
      expect(backend.seen.map((request) => request.url)).toEqual(['/api/mcp']);

      const { headers } = backend.seen[0];
      expect(headers.origin).toBeUndefined();
      expect(headers.referer).toBeUndefined();
      expect(headers['x-api-key']).toBe('guard-key');
      // The rest still goes, so it is these two that stop and not every header.
      expect(headers['x-user-id']).toBe('ka-guard');
    } finally {
      await close();
      await backend.close();
    }
  });

  test('in bff, Origin and Referer reach the BFF, and no key is added', async () => {
    const bff = await standIn();
    const { server, close } = await devServer({ VITE_API_MODE: 'bff', KA_BFF_URL: bff.url });
    try {
      expect(await askFromThePage(server)).toBe(200);
      expect(bff.seen.map((request) => request.url)).toEqual(['/api/mcp']);

      const { headers } = bff.seen[0];
      expect(headers.origin).toBe(PAGE.origin);
      expect(headers.referer).toBe(PAGE.referer);
      expect(headers['x-api-key']).toBeUndefined();
    } finally {
      await close();
      await bff.close();
    }
  });
});
