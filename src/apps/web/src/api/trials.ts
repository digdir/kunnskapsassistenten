// Trials the BFF carries out: `/api/v2/me` says which it offers, a header says which are on.
import { isFlagOn, type FlagId } from '../flags/flags';
import { BFF_API } from './bff/api';
import { kaEnv } from './runtimeConfig';

/** On a call while the excerpt trial is on; the BFF alone picks the genki environment. */
export const EXCERPT_TRIAL_HEADER = 'KA-Trial-Excerpt-Citations';

/** The headers for every call to the BFF: the trials that are on, as `1`. */
export function trialHeaders(): Record<string, string> {
  return isFlagOn('excerpt-citations') ? { [EXCERPT_TRIAL_HEADER]: '1' } : {};
}

/** The flags `/api/me` offers; none outside the BFF or on any failure. */
export async function fetchOfferedTrials(signal?: AbortSignal): Promise<FlagId[]> {
  if (kaEnv().VITE_API_MODE !== 'bff') return [];
  try {
    const response = await fetch(`${BFF_API}/me`, { credentials: 'same-origin', signal });
    if (!response.ok) return [];
    const { excerptTrial } = (await response.json()) as { excerptTrial?: unknown };
    return excerptTrial === true ? ['excerpt-citations'] : [];
  } catch {
    return [];
  }
}
