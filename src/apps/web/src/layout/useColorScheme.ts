import { useSyncExternalStore } from 'react';
import { getColorScheme, subscribeToColorScheme, type ColorScheme } from './colorScheme';

/**
 * The colour scheme the reader has chosen, `auto` until they choose.
 *
 * `useSyncExternalStore` for the reason the viewport hooks give: the choice
 * lives outside React — in storage and on `<html>` — and this form reads it
 * during render, so the control is right on the first paint.
 */
export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribeToColorScheme, getColorScheme);
}
