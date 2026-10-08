/*
 * The stored colour scheme, applied before the first paint so the page never
 * flashes the wrong one. The API is window.ka.colorScheme in colorScheme.ts,
 * which owns the same two strings.
 *
 * A file of its own and not a script inside index.html, because the BFF's
 * Content-Security-Policy is `script-src 'self'`: an inline script is refused,
 * a same-origin file is not. vite.config.ts emits it under /assets/ with a
 * hash in the name, which is the one path the BFF serves files from, and
 * links it as an ordinary blocking script at the top of <head>.
 */
(() => {
  try {
    const scheme = localStorage.getItem('ka.color-scheme');
    if (scheme === 'light' || scheme === 'dark' || scheme === 'auto') {
      document.documentElement.setAttribute('data-color-scheme', scheme);
    }
  } catch {
    // Storage can throw when site data is blocked. Keep the default.
  }
})();
