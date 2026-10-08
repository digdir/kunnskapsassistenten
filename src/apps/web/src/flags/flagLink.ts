/**
 * Opening the flags menu, and turning a flag on with a link.
 *
 * `#feature-flags` opens the menu, the way `#innstillinger` opens the
 * settings: a hash, so it never reaches the server and never changes which
 * route is showing.
 *
 * A link can turn flags on: `?flagg=mobile-top-row`, or several at once with
 * `?flagg=a,b`. A query and not a hash, because the link is meant to be sent
 * to someone, and the menu's hash is already the place the link lands on.
 * Only on — a link that turned things off could undo a trial someone else had
 * chosen. Ids nobody knows are ignored, so an old link to a flag that has
 * been taken out does nothing.
 *
 * The parameter is read and then taken out of the address, and the address
 * gets `#feature-flags` instead. The reader who opened the link sees what was
 * turned on and has the switch to turn it off right there, and the address
 * they go on to share is the thread's, without the flag in it.
 */

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { isFlagId, setFlag, type FlagId } from './flags';

export const FEATURE_FLAGS_HASH = '#feature-flags';

export const FLAG_LINK_PARAM = 'flagg';

/**
 * Turns on every known flag the link names. Takes each value of the
 * parameter, so `?flagg=a&flagg=b` works as well as `?flagg=a,b`.
 */
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
