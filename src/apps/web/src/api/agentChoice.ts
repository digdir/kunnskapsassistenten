/**
 * Where the agent choice is kept: per browser, not per user, so «Logg ut» empties
 * it. Only a non-default choice is kept, so the default follows the BFF's. Never
 * throws; without storage the choice lasts as long as the page.
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
