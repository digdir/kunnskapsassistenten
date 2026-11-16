// The addresses this client answers, and what each shows. The server sends the same page for every
// address (decisions/0019), so the page itself tells its own pages from an address that is none.
import type { Me } from '../session';

/** KA's pages, at the addresses the previous client had them, so saved links still land. */
export const CHANGELOG_PATH = '/endringslogg';
export const ABOUT_PATH = '/om-prosjektet';

/** The assistant's own addresses: its front page, with the thread in `?t=`, and «Innstillinger». */
export const ASSISTANT_PATHS: ReadonlySet<string> = new Set(['/', '/innstillinger']);

/** KA's service, whose pages these are: another service drawn from a layout has none of them. */
export const KA_SERVICE = 'kunnskapsassistenten';

export const hasKaPages = (me: Pick<Me, 'service'>) => me.service === KA_SERVICE;

export type Page = 'assistant' | 'changelog' | 'about' | 'not-found';

/** `path` without a trailing slash, which names the same page. */
export const canonicalPath = (path: string) => path.replace(/(.)\/+$/, '$1');

/** What `path` shows. */
export function pageAt(path: string, kaPages: boolean): Page {
  const at = canonicalPath(path);
  if (ASSISTANT_PATHS.has(at)) return 'assistant';
  if (kaPages && at === CHANGELOG_PATH) return 'changelog';
  if (kaPages && at === ABOUT_PATH) return 'about';
  return 'not-found';
}

/** A thread id, as the server takes one in an address (apps/server/src/nextPage.ts). */
const THREAD_ID = /^[A-Za-z0-9_-][A-Za-z0-9_.:-]{0,199}$/;

/** A page of KA's, with the assistant's address the person came from in `fra`, for the way back. */
export const pageFrom = (path: string, here = `${location.pathname}${location.search}`) =>
  `${path}?${new URLSearchParams({ fra: here })}`;

/**
 * The way back from one of KA's pages: the assistant's front page, with the thread the person
 * left in `fra` when there was one. Any other address in `fra` goes to the front page: the
 * parameter is in a link anyone can make.
 */
export function backFrom(search: string): string {
  const from = new URLSearchParams(search).get('fra');
  if (!from?.startsWith('/') || from.startsWith('//')) return '/';
  let url: URL;
  try {
    url = new URL(from, 'http://ka.invalid');
  } catch {
    return '/';
  }
  if (url.origin !== 'http://ka.invalid' || url.pathname !== '/') return '/';
  const thread = url.searchParams.get('t');
  return thread && THREAD_ID.test(thread) ? `/?t=${encodeURIComponent(thread)}` : '/';
}
