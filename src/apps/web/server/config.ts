/**
 * Everything the server reads from its environment, in one place.
 *
 * The split that matters here is which values may reach the browser. The API
 * key may not, and that is not a preference: it is the only credential in the
 * system, and a built SPA has no proxy in front of it the way the Vite dev
 * server does (`vite.config.ts`). So the key is read here, used on the server
 * when it forwards a call, and never written into anything the client can
 * fetch. `clientConfig` below is the list of what the client DOES get, by
 * name, so adding a secret to it has to be a deliberate act. The Typesense
 * key for the facets and the excerpts (`facets` and `excerpts`, read in
 * facets.ts and excerpts.ts) and the shared secret in front of everything
 * (`accessSecret`, access.ts) are kept the same way.
 */

import { accessSecretFrom } from './access.ts';
import { excerptConfigFrom, type ExcerptConfig } from './excerpts.ts';
import { facetConfigFrom, type FacetConfig } from './facets.ts';
import { userIdSourceFrom, type UserIdSource } from './identity.ts';

/** Which backend the client talks to: fixtures, or the real thing. */
export type KaMode = 'mock' | 'live';

/**
 * The variables the client reads at runtime, under the names it already uses.
 *
 * `VITE_`-prefixed because they are the same variables `vite build` bakes in
 * during development — one vocabulary, whether the value arrives at build
 * time or from a container's environment. None of them is a credential:
 * dataset keys and a mode are names, and the client cannot do anything with
 * them the server has not already allowed.
 */
export type ClientConfig = {
  VITE_API_MODE?: KaMode;
  VITE_KA_TENANT?: string;
  VITE_KA_DATASET_CONFIG_KEY?: string;
  VITE_KA_DATASETS?: string;
  VITE_KA_FILTER_FIELDS?: string;
  VITE_KA_DOCUMENT_URLS?: string;
  VITE_MOCK_SPEED?: string;
};

export type ServerConfig = {
  port: number;
  /** Where `/api/*` is forwarded. No trailing slash. */
  apiBase: string;
  /** The credential. Undefined is allowed and means «forward without one». */
  apiKey: string | undefined;
  mode: KaMode;
  /** Whose `X-User-Id` reaches the backend. See identity.ts. */
  userIdFrom: UserIdSource;
  /** The shared secret in front of everything, or undefined for none. See access.ts. */
  accessSecret: string | undefined;
  /** The built client. Absolute, so the static handler can refuse to escape it. */
  distDir: string;
  /**
   * The largest request body forwarded, in bytes.
   *
   * A constant with a home rather than an environment variable: nobody has
   * needed a different number, and a limit that can be raised from outside is
   * a limit somebody raises instead of asking why a request is 200 MB. It
   * sits here so a test can measure the behaviour without sending 25 MB
   * through a socket to do it.
   */
  maxBodyBytes: number;
  clientConfig: ClientConfig;
  /** Typesense and the collections, for `/api/facets`. See facets.ts. */
  facets: FacetConfig;
  /** Typesense and the chunks collections, for `/api/excerpts`. See excerpts.ts. */
  excerpts: ExcerptConfig;
};

/** Blank is missing. An empty variable is a variable somebody forgot to fill. */
function value(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * `live` only when it says so.
 *
 * Anything else is mock, including a typo. A misspelt `KA_MODE=liv` that fell
 * back to live would send real questions to a real backend because somebody
 * dropped a letter; falling back to fixtures is the direction where a mistake
 * costs nothing.
 */
export function modeFrom(raw: string | undefined): KaMode {
  return value(raw) === 'live' ? 'live' : 'mock';
}

export function readConfig(
  env: NodeJS.ProcessEnv = process.env,
  distDir = new URL('../dist/', import.meta.url).pathname,
): ServerConfig {
  const mode = modeFrom(env.KA_MODE);

  return {
    port: Number.parseInt(value(env.PORT) ?? '8787', 10) || 8787,
    apiBase: (value(env.DIGDIR_API_BASE) ?? 'http://localhost:8080').replace(/\/+$/, ''),
    apiKey: value(env.DIGDIR_API_KEY),
    mode,
    userIdFrom: userIdSourceFrom(env.KA_USER_ID_FROM),
    accessSecret: accessSecretFrom(env.KA_ACCESS_SECRET),
    distDir,
    // 25 MB. A question is a few hundred bytes; the only thing near this is a
    // reader's own uploaded document, and the client caps those at 20 MB
    // (`MAX_UPLOAD_BYTES`). The margin is the multipart wrapper around one.
    maxBodyBytes: 25 * 1024 * 1024,
    clientConfig: {
      VITE_API_MODE: mode,
      VITE_KA_TENANT: value(env.VITE_KA_TENANT),
      VITE_KA_DATASET_CONFIG_KEY: value(env.VITE_KA_DATASET_CONFIG_KEY),
      VITE_KA_DATASETS: value(env.VITE_KA_DATASETS),
      VITE_KA_FILTER_FIELDS: value(env.VITE_KA_FILTER_FIELDS),
      VITE_KA_DOCUMENT_URLS: value(env.VITE_KA_DOCUMENT_URLS),
      VITE_MOCK_SPEED: value(env.VITE_MOCK_SPEED),
    },
    facets: facetConfigFrom(env),
    excerpts: excerptConfigFrom(env),
  };
}

/**
 * The runtime config as the one script the client loads before the bundle.
 *
 * `JSON.stringify` and not a template of fields: the values come from a
 * container's environment and end up inside a `<script>`, so a corpus label
 * with a quote in it would otherwise break the line it is written on.
 *
 * The one escape on top is the one JSON does not do. A JSON string may hold
 * `<` unescaped, and a browser's HTML parser ends the script at `</script`
 * wherever it appears — inside a string as much as outside one. `\u003c` is
 * the same character to a JavaScript parser and not a `<` to an HTML one.
 *
 * Nothing filters out the variables that are not set, because
 * `JSON.stringify` already drops a key whose value is `undefined`. A filter
 * here looked like it was doing that job and was measured doing nothing.
 */
export function configScript(config: ClientConfig): string {
  const json = JSON.stringify(config).replace(/</g, '\\u003c');
  return `window.__KA_CONFIG__ = ${json};\n`;
}
