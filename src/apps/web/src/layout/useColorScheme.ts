import { useSyncExternalStore } from 'react';
import { getColorScheme, subscribeToColorScheme, type ColorScheme } from './colorScheme';

/**
 * The colour scheme the reader has chosen, `auto` until they choose. Read during render with
 * `useSyncExternalStore`, because the choice lives outside React, so the control is right on the
 * first paint.
 */
export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribeToColorScheme, getColorScheme);
}
