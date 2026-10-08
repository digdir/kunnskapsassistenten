// `#feature-flags` opens the menu; `?flagg=a,b` turns flags on, never off, so a
// link cannot undo someone's trial. The parameter is then swapped for the hash,
// so the reader sees the switch and the address they share is without it.

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { isFlagId, setFlag, type FlagId } from './flags';

export const FEATURE_FLAGS_HASH = '#feature-flags';

export const FLAG_LINK_PARAM = 'flagg';

/** Turns on every known flag named; `?flagg=a&flagg=b` works like `?flagg=a,b`. */
export function turnOnFromLink(values: readonly string[]): FlagId[] {
  const ids = values
    .flatMap((value) => value.split(','))
    .map((id) => id.trim())
    .filter(isFlagId);
  for (const id of ids) setFlag(id, true);
  return ids;
}

/** Reads `?flagg=` once it is in the address, and swaps it for the menu. */
export function useFlagLink(): void {
  const { search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (!params.has(FLAG_LINK_PARAM)) return;
    turnOnFromLink(params.getAll(FLAG_LINK_PARAM));
    params.delete(FLAG_LINK_PARAM);
    const rest = params.toString();
    // `replace`, so Back does not walk into the link and turn the flag on again.
    navigate({ search: rest ? `?${rest}` : '', hash: FEATURE_FLAGS_HASH }, { replace: true });
  }, [search, navigate]);
}
