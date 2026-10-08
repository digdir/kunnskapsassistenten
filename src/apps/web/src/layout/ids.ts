/**
 * DOM ids two owners have to agree on.
 *
 * A skip link and its target are written in different places — the link is
 * the first focusable thing in the document and belongs to the shell, the
 * target is inside whichever view happens to hold it — and a string typed out
 * twice is a link that silently goes nowhere the day one of them is renamed.
 *
 * They live here rather than in the view for the reason the conductor gave on
 * 2026-09-15: the shell must not import from a view to build its own chrome.
 */

/** The compose field, target of «Hopp til skrivefeltet» and of the `/` key. */
export const COMPOSER_ID = 'composer-field';
