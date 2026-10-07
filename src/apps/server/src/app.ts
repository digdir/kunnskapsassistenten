import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { csrf } from 'hono/csrf';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './apiShared.ts';
import { v1 } from './apiV1.ts';
import { v2 } from './apiV2.ts';
import { mountAuth, readUser, requireAuth } from './auth.ts';
import { config } from './config.ts';
import { sessionMiddleware } from './session.ts';

/** The BFF: sign-in, the two API versions and the client. server.ts serves it. */
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

mountAuth(app);
app.use(
  '/api/*',
  bodyLimit({
    maxSize: 64 * 1024,
    onError: (c) => c.json({ error: 'Forespørselen er for stor.' }, 413),
  }),
);

const HEALTH = new Set(['/api/health', '/api/v2/health']);
app.use('/api/*', async (c, next) => (HEALTH.has(c.req.path) ? next() : requireAuth(c, next)));

/*
 * The version is in the path, and each client asks for its own
 * (decisions/0009). `/api/v2` first, so `/api` never sees its paths.
 */
app.route('/api/v2', v2);
app.route('/api', v1);

// Before the SPA fallback, or a mistyped endpoint answers 200 with index.html.
app.all('/api/*', (c) => c.json({ error: 'Ukjent endepunkt.' }, 404));

/** After `next()`: serveStatic's `onFound` runs when the response is already built. */
const cacheFor =
  (value: string): MiddlewareHandler =>
  async (c, next) => {
    await next();
    if (c.res.ok) c.res.headers.set('Cache-Control', value);
  };

if (config.webRoot) {
  // Vite puts a content hash in every name under /assets/.
  app.use('/assets/*', cacheFor('public, max-age=31536000, immutable'));
  app.use('/assets/*', serveStatic({ root: config.webRoot }));
  // A name from an older build is gone, and must not become index.html cached for a year.
  app.all('/assets/*', (c) => c.text('Fant ikke fila.', 404));
  app.get('/favicon.ico', serveStatic({ root: config.webRoot, path: 'favicon.ico' }));
  app.get('*', async (c, next) => {
    if (config.auth.enabled && !(await readUser(c))) {
      return c.redirect(`/auth/login?next=${encodeURIComponent(c.req.path)}`);
    }
    return next();
  });
  // index.html names the hashed files, so it is asked for again on every load.
  app.get('*', cacheFor('no-cache'), serveStatic({ root: config.webRoot, path: 'index.html' }));
}
