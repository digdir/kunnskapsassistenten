import { once } from 'node:events';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { join, normalize, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';

/**
 * What a browser is told to do with each kind of file.
 *
 * Vite gives every built asset a content hash in its name, so an asset that
 * changed has a different address and one that did not can be kept forever —
 * `immutable` says exactly that, and saves the revalidation request. The
 * entry document is the opposite: its address never changes and its contents
 * do on every deploy, so a cached copy would point at assets that are gone.
 * `no-cache` is «ask me first», not «do not store».
 */
const IMMUTABLE = 'public, max-age=31536000, immutable';
const ENTRY = 'no-cache';

const TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function contentType(path: string): string {
  const dot = path.lastIndexOf('.');
  return (
    (dot === -1 ? undefined : TYPES[path.slice(dot).toLowerCase()]) ?? 'application/octet-stream'
  );
}

/**
 * The file a URL asks for, or undefined when it asks for something outside.
 *
 * `normalize` resolves `..` before the join rather than after, so a request
 * for `/../../etc/passwd` cannot walk out of the built client. The check
 * afterwards is the belt to that braces: whatever the path turned into, it
 * has to still be inside `distDir`.
 */
export function resolveInside(distDir: string, urlPath: string): string | undefined {
  const decoded = (() => {
    try {
      return decodeURIComponent(urlPath);
    } catch {
      // A malformed escape is not a path we have.
      return undefined;
    }
  })();
  if (decoded === undefined || decoded.includes('\0')) return undefined;

  const root = resolve(distDir);
  const candidate = resolve(join(root, normalize(decoded)));
  return candidate === root || candidate.startsWith(root + sep) ? candidate : undefined;
}

async function sendFile(
  response: ServerResponse,
  path: string,
  cacheControl: string,
): Promise<void> {
  const file = createReadStream(path);
  /*
   * Opened before the status line is written. A file that is there but cannot
   * be read then fails while a 500 can still be said, rather than after a 200
   * has promised a body that never comes.
   */
  await once(file, 'open');
  response.writeHead(200, { 'Content-Type': contentType(path), 'Cache-Control': cacheControl });
  await pipeline(file, response);
}

/**
 * Where the runtime config is hung in the entry document.
 *
 * Before the bundle's own `<script type="module">`, because the client reads
 * `window.__KA_CONFIG__` while its modules evaluate — the corpus store
 * resolves its list at import time. A classic script tag runs before any
 * module does, whatever the order on the page, so «before» here is belt and
 * braces rather than the mechanism.
 *
 * Injected instead of written into `index.html` at build time, because that
 * is the whole point: one image, and the mode and corpus decided by the
 * container's environment. It is injected rather than served as a file the
 * page already links to, so nothing has to change in the repo's `index.html`
 * — in development there is no server doing this, and a `<script>` pointing
 * at a file that is not there would log a 404 on every page load.
 */
const CONFIG_TAG = '<script src="/config.js"></script>';

export function injectConfigTag(html: string): string {
  if (html.includes(CONFIG_TAG)) return html;

  const module = html.indexOf('<script type="module"');
  if (module === -1) return html.replace('</head>', `  ${CONFIG_TAG}\n</head>`);
  return `${html.slice(0, module)}${CONFIG_TAG}\n    ${html.slice(module)}`;
}

/**
 * The built client, with the single-page fallback.
 *
 * Anything that is a file is served as one; anything else is `index.html`,
 * because the routes live in the client and `/threads/abc` is a page there
 * and a file nowhere. The fallback is what makes a reload on a deep link work
 * — without it a reader who reloads a thread gets a 404 from their own app.
 *
 * `/api/*` never reaches here: an unknown API path has to answer as an API,
 * or a typo'd endpoint returns HTML and the client fails while parsing it as
 * JSON. See `app.ts`.
 */
export async function serveStatic(
  response: ServerResponse,
  distDir: string,
  urlPath: string,
): Promise<void> {
  const path = resolveInside(distDir, urlPath);

  if (path !== undefined) {
    const found = await stat(path).catch(() => undefined);
    if (found?.isFile()) {
      // Hashed names under /assets/ are the only ones safe to keep forever.
      await sendFile(response, path, urlPath.startsWith('/assets/') ? IMMUTABLE : ENTRY);
      return;
    }
  }

  const entry = join(resolve(distDir), 'index.html');
  const html = await readFile(entry, 'utf8').catch(() => undefined);
  if (html === undefined) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Klienten er ikke bygget. Kjør «npm run build».\n');
    return;
  }

  response.writeHead(200, { 'Content-Type': TYPES['.html'] as string, 'Cache-Control': ENTRY });
  response.end(injectConfigTag(html));
}
