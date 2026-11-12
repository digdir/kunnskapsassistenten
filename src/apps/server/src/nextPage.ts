/**
 * Which client's page a browser gets, while the next client is on (decisions/0013): apps/web by
 * default, apps/web-next when the person chose it (`POST /api/next/ui`). The two builds keep their
 * files apart, `/assets/*` and `/next-assets/*`, so only the page depends on the choice.
 */
import { serveStatic } from '@hono/node-server/serve-static';
import type { MiddlewareHandler } from 'hono';
import { config } from './config.ts';
import { nextOffered, uiOf } from './nextApi.ts';

/** A thread id in an address, as nextApi.ts takes one. */
const THREAD_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/;

/** apps/web's addresses for a thread: `/threads/:id`, and `/chat/:id` from before it. */
const CLASSIC_THREAD = /^\/(?:threads|chat)\/([^/]+)$/;

/**
 * A link to a thread opens in the client this browser chose. apps/web has the thread in the path,
 * `/threads/:id`; apps/web-next in the query, `/?t=:id`. Each is sent to the other's form.
 */
export const threadLinkFor = (ui: 'next' | 'classic', path: string, query: URLSearchParams) => {
  if (ui === 'next') {
    const id = CLASSIC_THREAD.exec(path)?.[1];
    return id && THREAD_ID.test(id) ? `/?t=${id}` : undefined;
  }
  const id = query.get('t');
  return path === '/' && id && THREAD_ID.test(id) ? `/threads/${id}` : undefined;
};

export function nextPage(classicRoot: string) {
  const root = config.next.webRoot;
  if (!config.next.enabled) return undefined;
  if (!nextOffered()) {
    console.error(
      `KA_NEXT is on, but WEB_NEXT_ROOT has no index.html: the next client is not offered.`,
    );
    return undefined;
  }
  const nextIndex = serveStatic({ root, path: 'index.html' });
  const classicIndex = serveStatic({ root: classicRoot, path: 'index.html' });

  const threadLinks: MiddlewareHandler = async (c, next) => {
    const to = threadLinkFor(uiOf(c), c.req.path, new URL(c.req.url).searchParams);
    return to ? c.redirect(to, 302) : next();
  };

  const page: MiddlewareHandler = async (c, next) => {
    const res = await (uiOf(c) === 'next' ? nextIndex : classicIndex)(c, next);
    // So a cache keeps the two clients' pages apart.
    (res ?? c.res).headers.append('Vary', 'Cookie');
    return res;
  };

  return { files: serveStatic({ root }), threadLinks, page };
}
