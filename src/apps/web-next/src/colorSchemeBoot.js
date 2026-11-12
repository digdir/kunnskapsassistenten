/*
 * The stored colour scheme, applied before the first paint so the page never flashes the wrong
 * one. `ka-next.colorScheme` is this client's own (useStoredColorScheme in App.tsx); without it,
 * the old client's choice (`ka.color-scheme`) carries over, so switching keeps it.
 *
 * A file of its own, not a script inside index.html: the server's Content-Security-Policy is
 * `script-src 'self'`. vite.config.ts emits it under /next-assets/ with a hash in its name.
 */
(() => {
  try {
    const scheme =
      localStorage.getItem('ka-next.colorScheme') ?? localStorage.getItem('ka.color-scheme');
    if (scheme === 'light' || scheme === 'dark' || scheme === 'auto') {
      document.documentElement.setAttribute('data-color-scheme', scheme);
    }
  } catch {
    // Storage can throw when site data is blocked. Keep the default.
  }
})();
