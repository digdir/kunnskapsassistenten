/**
 * Dark mode from the Digdir theme's tokens; `auto` follows the OS. Also set from the console:
 * `window.ka.colorScheme.set('dark' | 'light' | 'auto')`. colorSchemeBoot.js applies the stored
 * choice before first paint and must agree with this file on STORAGE_KEY and ATTRIBUTE.
 */

export type ColorScheme = 'light' | 'dark' | 'auto';

export const STORAGE_KEY = 'ka.color-scheme';
const ATTRIBUTE = 'data-color-scheme';
const DEFAULT_SCHEME: ColorScheme = 'auto';

function isColorScheme(value: unknown): value is ColorScheme {
  return value === 'light' || value === 'dark' || value === 'auto';
}

/** Storage can throw (Safari in private mode, blocked site data), so every access is guarded. */
function readStored(): ColorScheme | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isColorScheme(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

function writeStored(scheme: ColorScheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, scheme);
  } catch {
    // Ignored on purpose: the scheme still applies for this page load.
  }
}

export function getColorScheme(): ColorScheme {
  return readStored() ?? DEFAULT_SCHEME;
}

/** Whoever draws the choice, told when it changes. See useColorScheme.ts. */
const listeners = new Set<() => void>();

function apply(scheme: ColorScheme): void {
  document.documentElement.setAttribute(ATTRIBUTE, scheme);
  for (const listener of listeners) listener();
}

export function setColorScheme(scheme: ColorScheme): ColorScheme {
  if (!isColorScheme(scheme)) {
    throw new Error(`Ukjent fargemodus: ${String(scheme)}. Bruk 'light', 'dark' eller 'auto'.`);
  }
  writeStored(scheme);
  apply(scheme);
  return scheme;
}

/**
 * Called when the choice changes, also in another tab (the `storage` event fires only in tabs
 * that did NOT write), so open tabs never disagree.
 */
export function subscribeToColorScheme(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

/** One for all listeners, so a change in another tab is applied once. */
function onStorage(event: StorageEvent): void {
  if (event.key === STORAGE_KEY) apply(getColorScheme());
}

declare global {
  interface Window {
    ka?: {
      colorScheme: {
        get(): ColorScheme;
        set(scheme: ColorScheme): ColorScheme;
      };
    };
  }
}

/**
 * Applies the stored scheme and exposes the console API; called from main.tsx before the first
 * render. Applying it again after colorSchemeBoot.js is harmless.
 */
export function initColorScheme(): void {
  document.documentElement.setAttribute(ATTRIBUTE, getColorScheme());
  window.ka = { ...window.ka, colorScheme: { get: getColorScheme, set: setColorScheme } };
}
