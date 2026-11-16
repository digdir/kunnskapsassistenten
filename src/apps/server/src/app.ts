import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { csrf } from 'hono/csrf';
import { secureHeaders } from 'hono/secure-headers';
import { mountAnsattporten, requireAnsattporten } from './ansattporten.ts';
import { mountAuth, readUser, requireAuth } from './auth.ts';
import { config } from './config.ts';
import { clientPage } from './nextPage.ts';
import { nextRoutes } from './nextApi.ts';
import { sessionMiddleware, type Env } from './session.ts';

/** The server: sign-in, the API and the client. server.ts serves it. */
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

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/health') return next();
  return ansattporten ? requireAnsattporten(c, next) : requireAuth(c, next);
});

/*
 * The readiness probe and the image's health check ask `/api/health` (decisions/0012), open
 * without sign-in. The client's API is `/api/next` (decisions/0013).
 */
app.get('/api/health', (c) => c.json({ ok: true }));
app.route('/api/next', nextRoutes());

// Before the page, or a mistyped endpoint answers 200 with index.html.
app.all('/api/*', (c) => c.json({ error: 'Ukjent endepunkt.' }, 404));

/** After `next()`: serveStatic's `onFound` runs when the response is already built. */
const cacheFor =
  (value: string): MiddlewareHandler =>
  async (c, next) => {
    await next();
    if (c.res.ok) c.res.headers.set('Cache-Control', value);
  };

/** The client's build. Left out, the server serves only the API, as for work with Vite. */
const root = config.next.webRoot;

if (root) {
  const client = clientPage(root);
  // Vite puts a content hash in every name under /next-assets/.
  app.use('/next-assets/*', cacheFor('public, max-age=31536000, immutable'));
  app.use('/next-assets/*', client.files);
  // A name from an older build is gone, and must not become index.html cached for a year. So are
  // the previous client's files under /assets/, which a page of it still open may ask for.
  app.all('/next-assets/*', (c) => c.text('Fant ikke fila.', 404));
  app.all('/assets/*', (c) => c.text('Fant ikke fila.', 404));
  // The previous client's addresses for a thread, in bookmarks and shared links.
  app.get('*', client.threadLinks);
  app.get('*', async (c, next) => {
    if (config.auth.enabled && !(await readUser(c))) {
      // The thread is in the query (`?t=`), and must survive the sign-in.
      const back = `${c.req.path}${new URL(c.req.url).search}`;
      return c.redirect(`/auth/login?next=${encodeURIComponent(back)}`);
    }
    return next();
  });
  // index.html names the hashed files, so it is asked for again on every load.
  app.get('*', cacheFor('no-cache'), client.page);
}
