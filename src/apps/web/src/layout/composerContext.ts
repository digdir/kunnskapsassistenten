import { createContext } from 'react';

/**
 * Whether a compose field is on screen right now. The shell draws «Hopp til skrivefeltet», but
 * the field belongs to a view that has states without one («Fant ikke tråden»), so the view
 * reports it and the skip link never points at a missing element.
 */
export type ComposerContextValue = {
  /** True while at least one compose field is mounted. */
  hasComposer: boolean;
  /** A compose field appeared. Always paired with `removeComposer`. */
  addComposer: () => void;
  /** The compose field went away. */
  removeComposer: () => void;
};

/**
 * Inert by default, unlike the shared state contexts that throw: this is a view telling the
 * chrome something, so a view mounted on its own (every view test) needs no provider.
 */
export const ComposerContext = createContext<ComposerContextValue>({
  hasComposer: false,
  addComposer: () => {},
  removeComposer: () => {},
});
