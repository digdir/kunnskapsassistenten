/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { EXCERPTS_PATH, excerptConfigFrom, excerptRoute } from './server/excerpts.ts';
import { FACETS_PATH, facetConfigFrom, facetRoute } from './server/facets.ts';

/**
 * The colour-scheme script, linked from `<head>` as a file of its own.
 *
 * It has to run before the first paint, so it is a classic blocking script
 * and not part of the module bundle, which runs after parsing. It used to be
 * inline in index.html; the BFF's `script-src 'self'` refuses that
 * (src/decisions/0005). Vite only bundles module scripts, so this emits the
 * file itself — under /assets/ with a content hash, because /assets/ is the
 * one path the BFF serves files from, and our own server caches it for good
 * there (server/static.ts). In development it is served from src/ as it is.
 */
function colorSchemeScript(): Plugin {
  const path = 'src/layout/colorSchemeBoot.js';
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 8);
  const fileName = `assets/color-scheme-${hash}.js`;
  let serving = false;

  return {
    name: 'ka-color-scheme-script',
    configResolved(config) {
      serving = config.command === 'serve';
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName, source });
    },
    transformIndexHtml: () => [
      {
        tag: 'script',
        attrs: { src: serving ? `/${path}` : `/${fileName}` },
        injectTo: 'head-prepend',
      },
    ],
  };
}

/**
 * `/api/facets` and `/api/excerpts` in development too, answered the way the
 * container's server answers them (server/facets.ts, server/excerpts.ts).
 *
 * The route is ours and not the backend's, so the proxy below would send it
 * to a backend that answers 404, and the filter panel would show an error
 * where it used to say «Filtrering er ikke tilgjengelig ennå». Vite runs a
 * plugin's middleware before its own, so this comes ahead of the proxy.
 *
 * Not in bff mode: the BFF has its own `/api/facets`, and that is the one
 * the panel should get there. It has no `/api/excerpts`, and needs none: its
 * sources carry their text.
 */
function facetsInDevelopment(env: Record<string, string>): Plugin {
  return {
    name: 'ka-facets',
    configureServer(server) {
      const facets = facetRoute(facetConfigFrom(env));
      const excerpts = excerptRoute(excerptConfigFrom(env));
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0];
        if (path === FACETS_PATH) facets(request, response).catch(next);
        else if (path === EXCERPTS_PATH) excerpts(request, response).catch(next);
        else next();
      });
    },
  };
}

/**
 * The dev server is also the proxy that holds the API key.
 *
 * The key never reaches the browser, and that is not a preference: the
 * backend answers a CORS preflight with 401 and sends no CORS headers at
 * all, so a browser could not call it directly even with a key. Production
 * needs a real server doing this same job — with logging, rate limiting and
 * the tool name pinned. See design/eksisterende/api-for-frontend.md.
 *
 * KA_API_URL and KA_API_KEY have no VITE_ prefix on purpose: Vite only
 * exposes VITE_-prefixed variables to client code, so these two cannot end up
 * in the bundle even by accident.
 *
 * In `bff` mode the proxy goes to the BFF in digdir/kunnskapsassistenten
 * instead, and only there: KA_BFF_URL, `:8788` by default, with no key,
 * because the BFF holds its own.
 * KA_API_URL and KA_API_KEY are not read at all in that mode. They sit in
 * `.env.local` for live, and read here they sent a bff-mode page straight to
 * the backend, which answered 401 «Invalid or missing API key» — and the
 * client took the 401 for a lapsed session (KA CC on #168). `/auth` goes
 * along, so a 401 from the BFF itself can lead to its sign-in.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const bff = env.VITE_API_MODE === 'bff';
  const target = bff
    ? env.KA_BFF_URL || 'http://localhost:8788'
    : env.KA_API_URL || 'http://localhost:8080';
  const apiKey = bff ? undefined : env.KA_API_KEY;

  if (env.VITE_API_MODE === 'live' && !apiKey) {
    console.warn('[ka] VITE_API_MODE=live, men KA_API_KEY er ikke satt. Spørringer vil gi 401.');
  }

  return {
    plugins: [react(), colorSchemeScript(), ...(bff ? [] : [facetsInDevelopment(env)])],
    server: {
      proxy: {
        ...(bff ? { '/auth': { target, changeOrigin: true } } : {}),
        '/api': {
          target,
          changeOrigin: true,
          configure(proxy) {
            proxy.on('proxyReq', (proxyRequest) => {
              if (apiKey) proxyRequest.setHeader('X-API-Key', apiKey);
              // No compression on the streaming route. A gzip stream buffers,
              // and then the answer arrives all at once at the end.
              proxyRequest.setHeader('Accept-Encoding', 'identity');
            });
            proxy.on('proxyRes', (proxyResponse) => {
              // Tells any intermediate proxy not to buffer the event stream.
              proxyResponse.headers['x-accel-buffering'] = 'no';
            });
          },
        },
      },
    },
    build: {
      rolldownOptions: {
        treeshake: {
          /*
           * The mock and the live client may be left out of a build that does
           * not use them (src/api/index.ts, `createChatClient`). Their modules
           * run code at the top that the bundler counts as side effects, so
           * without this it kept them, mock corpus and all, even with nothing
           * using them. A build that uses them keeps them whole, side effects
           * included.
           */
          moduleSideEffects: (id: string) =>
            !id.includes('/src/api/mock/') && !id.endsWith('/src/api/live/LiveChatClient.ts'),
        },
      },
    },
    test: {
      /*
       * Klienten og serveren i samme kjøring, men ikke i samme miljø.
       *
       * `src/test/setup.ts` er jsdom fra første linje — den installerer
       * matchMedia, `<dialog>` og CSS.escape på `window` mens den lastes — og
       * `server/` tester en Node-HTTP-server som ikke har noe `window`. Det
       * er ikke et miljø som kan deles, så det deles ikke: to prosjekter,
       * hvert med sitt miljø og sine filer. Alt annet arves fra rota her
       * (`extends`), så antall arbeidere og `restoreMocks` står fortsatt ett
       * sted.
       */
      projects: [
        {
          extends: true,
          test: {
            name: 'klient',
            environment: 'jsdom',
            setupFiles: ['./src/test/setup.ts'],
            include: ['src/**/*.test.{ts,tsx}'],
          },
        },
        {
          extends: true,
          test: {
            name: 'server',
            environment: 'node',
            include: ['server/**/*.test.ts'],
          },
        },
      ],
      restoreMocks: true,
      /*
       * Fire arbeidere lokalt. Vitest tar ellers én per kjerne: målt 15.09 gikk
       * vitest-prosessene fra 1 til 17 på denne maskinen, og tre—fire agenter
       * kjører `npm test` samtidig. Samme grunn og samme skille som i
       * `playwright.config.ts`, som har den lange begrunnelsen.
       */
      maxWorkers: process.env.GITHUB_ACTIONS ? undefined : 4,
    },
  };
});
