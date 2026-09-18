import type { Context } from 'hono';
import { config } from './config.ts';
import { domainAllowed, type User } from './auth.ts';

const SEND_LIMIT_MS = 60_000;
const sent = new Map<string, number>();

export function throttled(email: string, now = Date.now()): boolean {
  const last = sent.get(email);
  return Boolean(last && now - last < SEND_LIMIT_MS);
}

function api(path: string): string {
  return `${config.auth.supabaseUrl.replace(/\/$/, '')}/auth/v1${path}`;
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: config.auth.supabasePublishableKey,
    Authorization: `Bearer ${config.auth.supabasePublishableKey}`,
  };
}

export async function sendLink(email: string, redirectTo: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(api('/otp'), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, create_user: true, email_redirect_to: redirectTo }),
    });
  } catch {
    return false;
  }
  if (res.ok) sent.set(email, Date.now());
  else console.error('supabase otp', res.status, (await res.text()).slice(0, 200));
  return res.ok;
}

/** Supabase rejects a type that does not match how the token was minted. */
const VERIFY_TYPES = ['email', 'signup', 'magiclink', 'recovery', 'invite', 'email_change'];

export const verifyType = (raw: string | undefined): string =>
  raw && VERIFY_TYPES.includes(raw) ? raw : 'email';

async function verifyOnce(tokenHash: string, type: string): Promise<Response | null> {
  try {
    return await fetch(api('/verify'), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ type, token_hash: tokenHash }),
    });
  } catch {
    return null;
  }
}

export async function verifyCode(email: string, token: string): Promise<User | null> {
  let res: Response;
  try {
    res = await fetch(api('/verify'), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ type: 'email', email, token }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as {
    user?: { id?: string; email?: string };
  };
  const e = body.user?.email?.toLowerCase();
  const id = body.user?.id;
  if (!e || !id || !domainAllowed({ email: e })) return null;
  return { id: `sb:${id}`, name: e.split('@')[0] ?? '', email: e };
}

export async function verifyLink(tokenHash: string, type = 'email'): Promise<User | null> {
  const order = [type, ...VERIFY_TYPES.filter((t) => t !== type)];
  let res: Response | null = null;
  for (const t of order) {
    res = await verifyOnce(tokenHash, t);
    if (res?.ok) break;
  }
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => ({}))) as {
    user?: { id?: string; email?: string };
  };
  const email = body.user?.email?.toLowerCase();
  const id = body.user?.id;
  if (!email || !id) return null;
  if (!domainAllowed({ email })) return null;
  return { id: `sb:${id}`, name: email.split('@')[0] ?? '', email };
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function page(body: string): string {
  return `<!doctype html>
<html lang="nb"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Logg inn</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f5f5f5; margin: 0;
         display: grid; place-items: center; min-height: 100vh; }
  .card { background: #fff; padding: 2rem; border-radius: 8px; width: min(23rem, 90vw);
          box-shadow: 0 1px 3px rgb(0 0 0 / 0.15); }
  h1 { font-size: 1.15rem; margin: 0 0 1.25rem; }
  label { display: block; font-size: .85rem; margin: 0 0 .25rem; }
  input { width: 100%; padding: .55rem; margin: 0 0 1rem; border: 1px solid #bbb;
          border-radius: 4px; font-size: 1rem; box-sizing: border-box; }
  button { width: 100%; padding: .6rem; border: 0; border-radius: 4px;
           background: #0062ba; color: #fff; font-size: 1rem; cursor: pointer; }
  .err { color: #b3261e; font-size: .9rem; }
  .note { color: #666; font-size: .8rem; margin: 1rem 0 0; }
</style></head>
<body><div class="card">${body}</div></body></html>`;
}

/** The stock template returns the session in the URL fragment. */
function fragmentHandoff(next: string): string {
  return page(`<h1>Logger inn…</h1>
  <p class="note">Et øyeblikk.</p>
  <script>
    (function () {
      var h = new URLSearchParams(location.hash.slice(1));
      var t = h.get('access_token');
      if (!t) { location.replace('/auth/login'); return; }
      fetch('/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: t }),
      }).then(function (r) {
        location.replace(r.ok ? ${JSON.stringify(next)} : '/auth/login');
      }).catch(function () { location.replace('/auth/login'); });
    })();
  </script>`);
}

export async function userFromAccessToken(token: string): Promise<User | null> {
  let res: Response;
  try {
    res = await fetch(api('/user'), {
      headers: { apikey: config.auth.supabasePublishableKey, Authorization: `Bearer ${token}` },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const u = (await res.json().catch(() => ({}))) as { id?: string; email?: string };
  const email = u.email?.toLowerCase();
  if (!u.id || !email) return null;
  if (!domainAllowed({ email })) return null;
  return { id: `sb:${u.id}`, name: email.split('@')[0] ?? '', email };
}

export function loginPage(next: string, error?: string): string {
  return page(`<h1>Kunnskapsassistenten</h1>
  ${error ? `<p class="err">${esc(error)}</p>` : ''}
  <form method="post" action="/auth/login">
    <input type="hidden" name="next" value="${esc(next)}" />
    <label for="email">E-postadressen din</label>
    <input id="email" name="email" type="email" autocomplete="email" required autofocus
           placeholder="navn@digdir.no" />
    <button type="submit">Send engangskode</button>
  </form>
  <p class="note">Du får en engangskode på e-post.</p>`);
}

export function codePage(email: string, next: string, error?: string): string {
  return page(`<h1>Skriv inn koden</h1>
  ${error ? `<p class="err">${esc(error)}</p>` : ''}
  <p class="note" style="margin:0 0 1rem">Sendt til <strong>${esc(email)}</strong>.</p>
  <form method="post" action="/auth/code">
    <input type="hidden" name="next" value="${esc(next)}" />
    <input type="hidden" name="email" value="${esc(email)}" />
    <label for="code">Engangskode</label>
    <input id="code" name="code" inputmode="numeric" pattern="[0-9]{4,12}" maxlength="12"
           autocomplete="one-time-code" required autofocus />
    <button type="submit">Logg inn</button>
  </form>
  <p class="note"><a href="/auth/login">Send på nytt</a></p>`);
}

export function mountSupabaseAuth(
  app: {
    get: (p: string, h: (c: Context) => Promise<Response> | Response) => unknown;
    post: (p: string, h: (c: Context) => Promise<Response> | Response) => unknown;
  },
  deps: {
    writeUser: (c: Context, u: User) => Promise<void>;
    clearUser: (c: Context) => void;
    safeReturnTo: (v: string | undefined) => string;
  },
): void {
  const origin = config.auth.origin;
  const domains = config.auth.allowedDomains.join(', ');

  app.get('/auth/login', (c) => c.html(loginPage(deps.safeReturnTo(c.req.query('next')))));

  app.post('/auth/login', async (c) => {
    const f = await c.req.parseBody();
    const email = String(f.email ?? '')
      .trim()
      .toLowerCase();
    const next = deps.safeReturnTo(String(f.next ?? '/'));

    if (!domainAllowed({ email })) {
      return c.html(loginPage(next, `Bare adresser på ${domains} har tilgang.`), 403);
    }
    if (throttled(email)) {
      return c.html(loginPage(next, 'Lenke er allerede sendt. Vent ett minutt.'), 429);
    }
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
    if (!(await sendLink(email, redirectTo))) {
      return c.html(loginPage(next, 'Klarte ikke sende lenken. Prøv igjen.'), 502);
    }
    return c.html(codePage(email, next));
  });

  app.post('/auth/code', async (c) => {
    const f = await c.req.parseBody();
    const email = String(f.email ?? '')
      .trim()
      .toLowerCase();
    const code = String(f.code ?? '').trim();
    const next = deps.safeReturnTo(String(f.next ?? '/'));

    if (!domainAllowed({ email })) {
      return c.html(loginPage(next, `Bare adresser på ${domains} har tilgang.`), 403);
    }
    const user = await verifyCode(email, code);
    if (!user) return c.html(codePage(email, next, 'Feil eller utløpt kode.'), 401);
    await deps.writeUser(c, user);
    return c.redirect(next);
  });

  app.get('/auth/callback', async (c) => {
    const tokenHash = c.req.query('token_hash');
    const next = deps.safeReturnTo(c.req.query('next'));
    if (!tokenHash) return c.html(fragmentHandoff(next));
    const user = await verifyLink(tokenHash, verifyType(c.req.query('type')));
    if (!user) return c.html(loginPage(next, 'Lenken er brukt opp eller utløpt.'), 401);
    await deps.writeUser(c, user);
    return c.redirect(next);
  });

  app.post('/auth/session', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { access_token?: string };
    if (!body.access_token) return c.json({ error: 'mangler token' }, 400);
    const user = await userFromAccessToken(body.access_token);
    if (!user) return c.json({ error: 'ugyldig token' }, 401);
    await deps.writeUser(c, user);
    return c.json({ ok: true });
  });

  app.get('/auth/logout', (c) => {
    deps.clearUser(c);
    return c.redirect('/');
  });
}
