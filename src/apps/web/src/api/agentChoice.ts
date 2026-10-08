/**
 * Which agent this browser has chosen, kept for the next visit.
 *
 * Per browser and not per user, like the answer store (`ka.sources.v1`), and
 * emptied with it at «Logg ut» (`beforeLogout` in session.ts): the next reader
 * in this browser starts on the default, not on the last one's choice.
 *
 * Only a choice away from the default is kept. A reader on the default then
 * follows whatever the BFF says the default is, also after it changes.
 *
 * Never throws. Storage is not readable in a private window or with site data
 * blocked, and then the choice lasts as long as the page does.
 */
export const AGENT_STORAGE_KEY = 'ka.agent.v1';

export function storedAgentId(): string | undefined {
  try {
    return window.localStorage.getItem(AGENT_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function storeAgentId(id: string | undefined): void {
  try {
    if (id === undefined) window.localStorage.removeItem(AGENT_STORAGE_KEY);
    else window.localStorage.setItem(AGENT_STORAGE_KEY, id);
  } catch {
    // Not writable. The choice holds for this page.
  }
}

export function forgetAgentChoice(): void {
  storeAgentId(undefined);
}
