/** Designsystemet's `data-color-scheme` values; `auto` follows the system until a choice. */
export const colorSchemes = ['light', 'dark', 'auto'] as const;

export type ColorScheme = (typeof colorSchemes)[number];

/** For a host reading a stored choice: anything else is no choice, so the scheme stays `auto`. */
export const isColorScheme = (value: unknown): value is ColorScheme =>
  colorSchemes.some((scheme) => scheme === value);
