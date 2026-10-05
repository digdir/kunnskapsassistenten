import { createServer } from 'node:http';
import { createHandler } from './app.ts';
import { readConfig } from './config.ts';

/**
 * The test environment's whole server: the built client and a proxy that
 * holds the API key, on one origin.
 *
 * One origin is not cosmetic. The backend answers a CORS preflight with 401
 * and sends no CORS headers at all, so a browser cannot call it directly even
 * with a key — and the key must not be in the browser to begin with. In
 * development the Vite dev server does this job (`vite.config.ts`); a built
 * client has no dev server, which is what this file is for.
 *
 * Run with `node server/index.ts`: Node executes TypeScript by stripping the
 * types, and the repo already forbids the syntax that cannot be stripped
 * (`erasableSyntaxOnly` in tsconfig), so there is no build step and no
 * compiled copy to keep in step with the source.
 */
const config = readConfig();
const server = createServer(createHandler(config));

/*
 * A long answer streams for 30–90 seconds, and a turn against a slow corpus
 * has gone past two minutes. Node's own defaults are above that — 300 s for
 * a request, no socket timeout at all — and these two lines say so out loud
 * rather than leaving the next reader to look it up. `headersTimeout` stays
 * short: waiting for headers is not waiting for an answer.
 */
server.requestTimeout = 300_000;
server.keepAliveTimeout = 65_000;

server.listen(config.port, () => {
  console.log(
    '[ka] serverer %s på :%d i %s-modus, backend %s, nøkkel %s, bruker-id fra %s',
    config.distDir,
    config.port,
    config.mode,
    config.apiBase,
    config.apiKey ? 'satt' : 'IKKE SATT',
    config.userIdFrom === 'platform' ? 'plattformens innlogging' : 'nettleseren',
  );
  console.log(
    '[ka] delt hemmelighet: %s',
    config.accessSecret ? 'på, alt unntatt /healthz krever lenken' : 'av',
  );
  if (config.mode === 'live' && !config.apiKey) {
    console.warn('[ka] KA_MODE=live uten DIGDIR_API_KEY. Spørringer vil gi 401.');
  }
  const { typesenseUrl, typesenseKey, collections } = config.facets;
  console.log(
    '[ka] fasetter fra Typesense: %s',
    typesenseUrl && typesenseKey && collections.size > 0
      ? [...collections.keys()].join(', ')
      : 'av (TYPESENSE_URL, TYPESENSE_API_KEY og KA_FACET_COLLECTIONS er ikke alle satt)',
  );
});
