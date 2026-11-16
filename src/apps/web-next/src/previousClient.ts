// What the previous client kept in this browser (decisions/0019). Its «Logg ut» cleared most of it,
// and nothing does now that it is gone: the sources of its answers, the agent, filter and corpus
// chosen, its trials and its layout. Forgotten on the first load of this client, by exact key, so
// nothing of this client's own (`ka-next.`) is touched. The colour scheme chosen there is kept, as
// this client's, until the person picks one here.
import { COLOR_SCHEME_KEY } from './App';

const PREVIOUS_COLOR_SCHEME = 'ka.color-scheme';

export const PREVIOUS_KEYS = [
  'ka.agent.v1',
  'ka.corpus.v1',
  'ka.filter.v1',
  'ka.flags.v1',
  'ka.footer-mode',
  'ka.layout.v1',
  'ka.sources.v1',
  'ka.user.v1',
  PREVIOUS_COLOR_SCHEME,
] as const;

/** The previous client's draft, kept per tab. */
const PREVIOUS_SESSION_KEYS = ['ka.draft.v1'] as const;

const SCHEMES: ReadonlySet<string> = new Set(['light', 'dark', 'auto']);

export function forgetPreviousClient(
  local: Storage | undefined = globalThis.localStorage,
  session: Storage | undefined = globalThis.sessionStorage,
): void {
  try {
    if (local) {
      const scheme = local.getItem(PREVIOUS_COLOR_SCHEME);
      if (scheme && SCHEMES.has(scheme) && local.getItem(COLOR_SCHEME_KEY) === null)
        local.setItem(COLOR_SCHEME_KEY, scheme);
      for (const key of PREVIOUS_KEYS) local.removeItem(key);
    }
    if (session) for (const key of PREVIOUS_SESSION_KEYS) session.removeItem(key);
  } catch {
    // Storage can throw when site data is blocked. Then there is nothing kept to forget either.
  }
}
