export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function page(body: string): string {
  return `<!doctype html>
<html lang="nb"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Logg inn</title>
<style>
  body { font-family: Inter, system-ui, sans-serif; background: #f3f4f7; margin: 0;
         color: #111827; display: grid; place-items: center; min-height: 100vh; }
  .card { background: #fff; padding: 2.5rem 2.75rem; border-radius: 12px;
          width: min(26rem, calc(100vw - 2rem)); box-sizing: border-box;
          box-shadow: 0 1px 2px rgb(0 0 0 / 0.06); }
  .eyebrow { color: #4b5563; font-size: .9rem; margin: 0 0 .5rem; }
  h1 { font-size: 1.6rem; margin: 0 0 .75rem; }
  .lead { color: #4b5563; font-size: 1.05rem; line-height: 1.5; margin: 0 0 1.75rem; }
  label { display: block; font-size: .9rem; margin: 0 0 .35rem; }
  input { width: 100%; padding: .7rem; margin: 0 0 1.25rem; border: 1px solid #c3c8d0;
          border-radius: 6px; font-size: 1rem; box-sizing: border-box; }
  button, .button { display: flex; align-items: center; justify-content: center; gap: .6rem;
          width: 100%; padding: .75rem; border: 0; border-radius: 6px; box-sizing: border-box;
          background: #111827; color: #fff; font-size: 1rem; font-family: inherit;
          text-decoration: none; cursor: pointer; }
  button:hover, .button:hover { background: #1f2937; }
  .err { color: #b3261e; font-size: .9rem; margin: 0 0 1rem; }
  .note { color: #6b7280; font-size: .8rem; margin: 1rem 0 0; }
</style></head>
<body><div class="card">${body}</div></body></html>`;
}

const AZURE_LOGO = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M5.483 21.3H24L14.025 4.013l-3.038 8.347 5.836 6.938L5.483 21.3zM13.049 2.7L6.105 8.531 0 19.108h5.505v.014L13.049 2.7z"/></svg>`;

export function entraLoginPage(next: string, error?: string): string {
  return page(`<p class="eyebrow">Kunnskapsassistent</p>
  <h1>Velkommen tilbake</h1>
  <p class="lead">Logg inn med Digdir-kontoen din.</p>
  ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
  <a class="button" href="/auth/start?next=${esc(encodeURIComponent(next))}">${AZURE_LOGO}Azure AD</a>`);
}
