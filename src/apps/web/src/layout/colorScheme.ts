/**
 * Dark mode. Lars decided 2026-09-11 that KA ships it, straight from the
 * Digdir theme's tokens — the theme carries 147 light/dark variables, so the
 * cost is verifying screens, not building anything.
 *
 * The visible control is `ColorSchemeToggle`, at the foot of the navigation
 * panel (Simens issue 85). The console command it was until then still works:
 *
 *   window.ka.colorScheme.set('dark' | 'light' | 'auto')
 *   window.ka.colorScheme.get()
 *
 * `auto` follows the operating system and is the default. The choice is
 * stored per browser and read before the first paint by a small script,
 * colorSchemeBoot.js, so the page never flashes the wrong scheme. That
 * script and this module must agree on STORAGE_KEY and ATTRIBUTE; they are
 * the only two strings duplicated between them.
 */

export type ColorScheme = 'light' | 'dark' | 'auto';

export const STORAGE_KEY = 'ka.color-scheme';
const ATTRIBUTE = 'data-color-scheme';
const DEFAULT_SCHEME: ColorScheme = 'auto';

function isColorScheme(value: unknown): value is ColorScheme {
  return value === 'light' || value === 'dark' || value === 'auto';
}

/**
 * Storage can throw, not just return null: Safari in private mode and
 * browsers with site data blocked throw on access. A colour scheme is never
 * worth a blank page, so every access is guarded.
 */
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
 * Called when the choice changes: from the control, from the console, or in
 * another tab of the same app.
 *
 * The other tab is the `storage` event, which fires only in the tabs that did
 * NOT write. Without it a reader with two tabs open would switch one to dark
 * and find the other still light, with its control saying so — two answers
 * to one setting.
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
 * Applies the stored scheme and exposes the console API. Called from
 * main.tsx before the first render; colorSchemeBoot.js has usually
 * applied the same value already, and applying it twice is harmless.
 */
export function initColorScheme(): void {
  document.documentElement.setAttribute(ATTRIBUTE, getColorScheme());
  window.ka = { ...window.ka, colorScheme: { get: getColorScheme, set: setColorScheme } };
}
