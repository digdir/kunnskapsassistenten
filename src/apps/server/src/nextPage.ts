/**
 * The client's page and files (decisions/0019): apps/web-next's build, for every page address.
 * Its files are under `/next-assets/*`, and the page is its `index.html`, which routes by the
 * address: the assistant, «Innstillinger», «Endringslogg», «Om prosjektet», or «Siden finnes ikke».
 */
import { serveStatic } from '@hono/node-server/serve-static';
import type { MiddlewareHandler } from 'hono';

/** A thread id in an address, as nextApi.ts takes one. */
const THREAD_ID = /^[A-Za-z0-9_-][A-Za-z0-9_.:-]{0,199}$/;

/** The previous client's addresses for a thread: `/threads/:id`, and `/chat/:id` from before it. */
const PREVIOUS_THREAD = /^\/(?:threads|chat)\/([^/]+)$/;

/**
 * Where an address of the previous client for a thread is now: `/?t=:id`, the thread in the
 * query, as the client keeps it. Bookmarks and shared links have the old form.
 */
export const threadLinkFor = (path: string) => {
  const id = PREVIOUS_THREAD.exec(path)?.[1];
  return id && THREAD_ID.test(id) ? `/?t=${id}` : undefined;
};

/** The page and the files of the build in `root`. */
export function clientPage(root: string) {
  const threadLinks: MiddlewareHandler = async (c, next) => {
    const to = threadLinkFor(c.req.path);
    return to ? c.redirect(to, 302) : next();
  };
  return {
    files: serveStatic({ root }),
    threadLinks,
    page: serveStatic({ root, path: 'index.html' }),
  };
}
