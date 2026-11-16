import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { localOrigin } from './localOrigin.ts';
import { nextLayout } from './nextLayout.ts';

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(
      [
        `${name} is missing.`,
        '',
        '  cp apps/server/.env.example apps/server/.env',
        '  # fill in DIGDIR_API_KEY and DIGDIR_API_BASE',
        '  npm run doctor',
      ].join('\n'),
    );
    process.exit(1);
  }
  return v;
}

export type AuthMode = 'entra' | 'ansattporten' | 'off';

function authMode(entraReady: boolean): AuthMode {
  const asked = (process.env.AUTH_MODE ?? '').trim().toLowerCase();
  if (asked === 'entra' || asked === 'ansattporten' || asked === 'off') return asked;
  if (asked) {
    console.error(`AUTH_MODE must be entra, ansattporten or off. Got "${asked}".`);
    process.exit(1);
  }
  return entraReady ? 'entra' : 'off';
}

function ansattportenConfig(mode: AuthMode) {
  const ap = {
    issuer: (process.env.ANSATTPORTEN_ISSUER ?? '').replace(/\/$/, ''),
    clientId: process.env.ANSATTPORTEN_CLIENT_ID ?? '',
    clientSecret: process.env.ANSATTPORTEN_CLIENT_SECRET ?? '',
    redirectUri:
      process.env.ANSATTPORTEN_REDIRECT_URI ??
      `http://localhost:${process.env.PORT ?? 8787}/auth/callback`,
    audience: process.env.ANSATTPORTEN_AUDIENCE ?? 'digdir:genai',
    altinnResource: process.env.ANSATTPORTEN_ALTINN_RESOURCE ?? '',
  };
  if (
    mode === 'ansattporten' &&
    !(ap.issuer && ap.clientId && ap.clientSecret && ap.altinnResource)
  ) {
    console.error(
      'AUTH_MODE=ansattporten needs ANSATTPORTEN_ISSUER, ANSATTPORTEN_CLIENT_ID, ANSATTPORTEN_CLIENT_SECRET and ANSATTPORTEN_ALTINN_RESOURCE.',
    );
    process.exit(1);
  }
  return ap;
}

function authConfig() {
  const tenantId = process.env.AZURE_TENANT_ID ?? '';
  const clientId = process.env.AZURE_CLIENT_ID ?? '';
  const clientSecret = process.env.AZURE_CLIENT_SECRET ?? '';
  const redirectUri =
    process.env.AZURE_REDIRECT_URI ??
    `http://localhost:${process.env.PORT ?? 8787}/auth/callback`;
  const sessionSecret = process.env.SESSION_SECRET ?? '';
  const entraReady = Boolean(tenantId && clientId && clientSecret);
  const mode = authMode(entraReady);
  const ansattporten = ansattportenConfig(mode);
  const origin =
    process.env.APP_ORIGIN?.replace(/\/$/, '') ??
    new URL(mode === 'ansattporten' ? ansattporten.redirectUri : redirectUri).origin;
  const enabled = mode !== 'off';
  if (mode === 'entra' && !entraReady) {
    console.error(
      'AUTH_MODE=entra needs AZURE_TENANT_ID, AZURE_CLIENT_ID and AZURE_CLIENT_SECRET.',
    );
    process.exit(1);
  }
  if (!enabled && !localOrigin(origin)) {
    console.error(
      `Sign-in is off, but APP_ORIGIN is ${origin}. AUTH_MODE=off is only for localhost, 127.0.0.1 or [::1].`,
    );
    process.exit(1);
  }
  if (enabled && sessionSecret.length < 32) {
    console.error('SESSION_SECRET must be at least 32 characters when sign-in is on.');
    process.exit(1);
  }
  return {
    enabled,
    mode,
    tenantId,
    clientId,
    clientSecret,
    redirectUri,
    origin,
    sessionSecret,
    ansattporten,
  };
}

const NEXT_MODEL = 'kunnskapsassistenten__default';

/**
 * The settings of the previous client and of the switch between the two clients, no longer read
 * (decisions/0019). A deployment that still sets them starts as before, and is told so.
 */
export const RETIRED_SETTINGS = [
  'KA_NEXT',
  'KA_NEXT_DEFAULT',
  'KA_NEXT_ONLY',
  'WEB_ROOT',
  'KA_EXCERPT_ENVIRONMENT',
  'KA_CAPABILITIES',
  'KA_FILTER_FIELDS',
  'KA_DATASETS',
  'KUDOS_BASE',
  'TYPESENSE_API_HOST',
  'TYPESENSE_API_KEY_ADMIN',
  'KUDOS_DOCS_COLLECTION',
  'DIGDIR_TOOL',
  'DIGDIR_AGENT_ID',
  'DIGDIR_TENANT',
  'DIGDIR_DATASET_CONFIG_KEY',
] as const;

/** The retired settings this environment still sets, by name only: a value can be a secret. */
export const retiredSettingsIn = (env: NodeJS.ProcessEnv = process.env) =>
  RETIRED_SETTINGS.filter((name) => env[name] !== undefined);

/**
 * The client, apps/web-next (decisions/0013, 0019), and what it asks genki. `model` is the genki
 * service and variant, `<service>__<variant>` (`KA_NEXT_MODEL`), and `tenant` the tenant whose
 * collections it reads (`KA_NEXT_TENANT`). A malformed model stops the server.
 *
 * `webRoot` is the client's build (`WEB_NEXT_ROOT`). Unset, the server serves only the API, as
 * for work on the client with Vite. Set without an `index.html` in it, the server stops: there
 * would be no page to serve, while the readiness probe still answered.
 *
 * `layout` is the layout from genki's builder in `KA_NEXT_LAYOUT`, checked with genki's own rules
 * (decisions/0017, `nextLayout.ts`): a bad one stops the server. Unset, the client draws KA's own.
 */
export function nextConfig(env: NodeJS.ProcessEnv = process.env) {
  const webRoot = env.WEB_NEXT_ROOT ?? '';
  if (webRoot && !existsSync(join(webRoot, 'index.html'))) {
    console.error(`WEB_NEXT_ROOT has no index.html: there is no client to serve.`);
    process.exit(1);
  }
  const model = (env.KA_NEXT_MODEL ?? '').trim() || NEXT_MODEL;
  if (!/^[a-z0-9][a-z0-9-]*(__[a-z0-9][a-z0-9-]*)?$/i.test(model)) {
    console.error(`KA_NEXT_MODEL must be <service>__<variant>. Got "${model}".`);
    process.exit(1);
  }
  return {
    model,
    service: model.split('__')[0] ?? '',
    tenant: (env.KA_NEXT_TENANT ?? '').trim() || 'digdir',
    /** The build of apps/web-next. */
    webRoot,
    layout: nextLayout(env.KA_NEXT_LAYOUT),
  };
}

/** genki's rule for an environment name (genki ADR 0004). */
const ENVIRONMENT_NAME = /^[a-z][a-z0-9-]{0,31}$/;

/** Testers by session user id (`KA_TESTERS`), and the genki environment they get (#237). */
export function testersConfig(env: NodeJS.ProcessEnv = process.env) {
  const ids = new Set((env.KA_TESTERS ?? '').split(/[\s,]+/).filter(Boolean));
  let environment = (env.KA_TEST_ENVIRONMENT ?? '').trim() || 'test';
  if (!ENVIRONMENT_NAME.test(environment)) {
    if (ids.size) {
      console.error(
        `KA_TEST_ENVIRONMENT must be a genki environment name. Got "${environment}".`,
      );
      process.exit(1);
    }
    console.warn(
      `KA_TEST_ENVIRONMENT must be a genki environment name. Got "${environment}"; ignored while KA_TESTERS is empty.`,
    );
    environment = 'test';
  }
  return { ids: ids as ReadonlySet<string>, environment };
}

const auth = authConfig();

export const config = {
  port: Number(process.env.PORT ?? 8787),
  apiBase: (process.env.DIGDIR_API_BASE ?? 'http://localhost:8080').replace(/\/$/, ''),
  /** With Ansattporten the person's token is sent instead, and the key is not used. */
  apiKey:
    auth.mode === 'ansattporten'
      ? (process.env.DIGDIR_API_KEY ?? '')
      : required('DIGDIR_API_KEY'),

  maxQueryLength: 4000,

  next: nextConfig(),

  testers: testersConfig(),

  auth,
} as const;
