import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { csrf } from 'hono/csrf';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './apiShared.ts';
import { v2 } from './apiV2.ts';
import { mountAnsattporten, requireAnsattporten } from './ansattporten.ts';
import { mountAuth, readUser, requireAuth } from './auth.ts';
import { EXCERPT_TRIAL_HEADER, withExcerptTrial } from './backend.ts';
import { probe } from './capabilities.ts';
import { config } from './config.ts';
import { facets } from './facets.ts';
import { nextPage } from './nextPage.ts';
import { nextRoutes } from './nextApi.ts';
import { sessionMiddleware } from './session.ts';

/** The BFF: sign-in, the API and the client. server.ts serves it. */
export const app = new Hono<Env>();

app.use('*', sessionMiddleware);

const CDN = 'https://altinncdn.no';

app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      baseUri: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", CDN],
      fontSrc: ["'self'", 'data:', CDN],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
    strictTransportSecurity: config.auth.origin.startsWith('https://')
      ? 'max-age=31536000; includeSubDomains'
      : false,
    xFrameOptions: 'DENY',
  }),
);

// Only form-encoded posts are checked, so the JSON API keeps working.
app.use('*', csrf({ origin: config.auth.origin }));

const ansattporten = config.auth.mode === 'ansattporten';
if (ansattporten) mountAnsattporten(app);
else mountAuth(app);
app.use(
  '/api/*',
  bodyLimit({
    maxSize: 64 * 1024,
    onError: (c) => c.json({ error: 'Forespørselen er for stor.' }, 413),
  }),
);

const HEALTH = new Set(['/api/health', '/api/v2/health']);
app.use('/api/*', async (c, next) => {
  if (HEALTH.has(c.req.path)) return next();
  return ansattporten ? requireAnsattporten(c, next) : requireAuth(c, next);
});
// After sign-in has set the caller, so every call to genki for them follows the trial.
app.use('/api/*', async (c, next) => {
  c.set('caller', withExcerptTrial(c.get('caller'), c.req.header(EXCERPT_TRIAL_HEADER)));
  return next();
});

/*
 * The API is `/api/v2` (decisions/0009). `/api/health` stays beside it for
 * the readiness probe and the image's health check (decisions/0012).
 */
app.get('/api/health', (c) => c.json({ ok: true }));
// apps/web's API, left out where only the next client is served (`KA_NEXT_ONLY`, decisions/0017).
if (!config.next.only) app.route('/api/v2', v2);
// The next client's API, only while it is switched on (decisions/0013).
if (config.next.enabled) app.route('/api/next', nextRoutes());

// Before the SPA fallback, or a mistyped endpoint answers 200 with index.html.
app.all('/api/*', (c) => c.json({ error: 'Ukjent endepunkt.' }, 404));

/** After `next()`: serveStatic's `onFound` runs when the response is already built. */
const cacheFor =
  (value: string): MiddlewareHandler =>
  async (c, next) => {
    await next();
    if (c.res.ok) c.res.headers.set('Cache-Control', value);
  };

/** The build of apps/web. Left out, the BFF serves only the API, or only the next client. */
const root = config.webRoot;

if (root || config.next.only) {
  // apps/web's files, none of them where only the next client is served (`KA_NEXT_ONLY`).
  if (!config.next.only) {
    // Vite puts a content hash in every name under /assets/.
    app.use('/assets/*', cacheFor('public, max-age=31536000, immutable'));
    app.use('/assets/*', serveStatic({ root }));
    app.get('/favicon.ico', serveStatic({ root, path: 'favicon.ico' }));
  }
  // A name from an older build is gone, and must not become index.html cached for a year.
  app.all('/assets/*', (c) => c.text('Fant ikke fila.', 404));
  // The next client's page and files, when it is on and built (decisions/0013).
  const nextClient = nextPage(root);
  if (nextClient) {
    app.use('/next-assets/*', cacheFor('public, max-age=31536000, immutable'));
    app.use('/next-assets/*', nextClient.files);
    app.all('/next-assets/*', (c) => c.text('Fant ikke fila.', 404));
    app.get('*', nextClient.threadLinks);
  }
  app.get('*', async (c, next) => {
    if (config.auth.enabled && !(await readUser(c))) {
      // With the next client the thread is in the query (`?t=`), and must survive the sign-in.
      const back = nextClient ? `${c.req.path}${new URL(c.req.url).search}` : c.req.path;
      return c.redirect(`/auth/login?next=${encodeURIComponent(back)}`);
    }
    return next();
  });
  // index.html names the hashed files, so it is asked for again on every load.
  app.get(
    '*',
    cacheFor('no-cache'),
    nextClient ? nextClient.page : serveStatic({ root, path: 'index.html' }),
  );
}

/**
 * What the server does once it listens: the facets fetched, so the first
 * question after a restart is answered from the cache, and the capability
 * probe started.
 */
export function startUp(): void {
  void facets().catch(() => {});
  void probe().then((caps) => {
    const on = Object.entries(caps)
      .map(([k, v]) => `${v ? '+' : '-'}${k}`)
      .join(' ');
    console.log(`backend kan: ${on}`);
  });
}
