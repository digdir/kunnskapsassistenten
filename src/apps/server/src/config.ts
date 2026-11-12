import { parseDataset, parseFilterFields } from './datasetConfig.ts';

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(
      [
        `Mangler ${name}.`,
        '',
        '  cp apps/server/.env.example apps/server/.env',
        '  # fyll inn DIGDIR_API_KEY og DIGDIR_API_BASE',
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
    console.error(`AUTH_MODE må være entra, ansattporten eller off. Fikk "${asked}".`);
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
      'AUTH_MODE=ansattporten krever ANSATTPORTEN_ISSUER, ANSATTPORTEN_CLIENT_ID, ANSATTPORTEN_CLIENT_SECRET og ANSATTPORTEN_ALTINN_RESOURCE.',
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
      'AUTH_MODE=entra krever AZURE_TENANT_ID, AZURE_CLIENT_ID og AZURE_CLIENT_SECRET.',
    );
    process.exit(1);
  }
  if (!enabled && !origin.startsWith('http://localhost')) {
    console.error(
      `Innlogging er av, men APP_ORIGIN er ${origin}. AUTH_MODE=off er bare for localhost.`,
    );
    process.exit(1);
  }
  if (enabled && sessionSecret.length < 32) {
    console.error('SESSION_SECRET må være minst 32 tegn når innlogging er slått på.');
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

const datasetConfigKey = process.env.DIGDIR_DATASET_CONFIG_KEY ?? 'default';

/** `1`, `true`, `on` or `yes`, in any case. Anything else, or nothing, is off. */
const switchedOn = (raw: string | undefined) => /^(1|true|on|yes)$/i.test((raw ?? '').trim());

const NEXT_MODEL = 'kunnskapsassistenten__default';

/**
 * The next client, apps/web-next, beside apps/web on the same host (decisions/0013). Off unless
 * `KA_NEXT` turns it on: then `/api/next/*` is mounted, and a person who chose it gets its page.
 * `model` is the genki service and variant it asks, `<service>__<variant>`.
 *
 * A malformed `KA_NEXT_MODEL` stops the server only when `KA_NEXT` is on. While it is off the
 * model is not used, so a mistake in it is warned about and must not take apps/web down.
 */
export function nextConfig(env: NodeJS.ProcessEnv = process.env) {
  const enabled = switchedOn(env.KA_NEXT);
  let model = (env.KA_NEXT_MODEL ?? '').trim() || NEXT_MODEL;
  if (!/^[a-z0-9][a-z0-9-]*(__[a-z0-9][a-z0-9-]*)?$/i.test(model)) {
    if (enabled) {
      console.error(`KA_NEXT_MODEL must be <service>__<variant>. Got "${model}".`);
      process.exit(1);
    }
    console.warn(
      `KA_NEXT_MODEL must be <service>__<variant>. Got "${model}"; ignored while KA_NEXT is off.`,
    );
    model = NEXT_MODEL;
  }
  return {
    enabled,
    model,
    service: model.split('__')[0] ?? '',
    tenant: (env.KA_NEXT_TENANT ?? '').trim() || 'digdir',
    /** The build of apps/web-next. */
    webRoot: env.WEB_NEXT_ROOT ?? '',
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

/** The genki environment the excerpt trial asks for (`KA_EXCERPT_ENVIRONMENT`); unset, no trial. */
export function excerptEnvironmentConfig(env: NodeJS.ProcessEnv = process.env) {
  const environment = (env.KA_EXCERPT_ENVIRONMENT ?? '').trim();
  if (!environment) return undefined;
  if (!ENVIRONMENT_NAME.test(environment)) {
    console.error(
      `KA_EXCERPT_ENVIRONMENT must be a genki environment name. Got "${environment}".`,
    );
    process.exit(1);
  }
  return environment;
}

const auth = authConfig();

export const config = {
  port: Number(process.env.PORT ?? 8787),
  apiBase: (process.env.DIGDIR_API_BASE ?? 'http://localhost:8099').replace(/\/$/, ''),
  /** With Ansattporten the person's token is sent instead, and the key only probes. */
  apiKey:
    auth.mode === 'ansattporten'
      ? (process.env.DIGDIR_API_KEY ?? '')
      : required('DIGDIR_API_KEY'),

  /** Default only: the browser may name another that the key already grants. */
  tool: process.env.DIGDIR_TOOL ?? 'builtin.agent-rag-agent__agent-rag-graph-bundled',
  tenant: process.env.DIGDIR_TENANT ?? 'public-sector-knowledge',
  agentId: process.env.DIGDIR_AGENT_ID ?? 'builtin/agent-rag-agent',
  datasetConfigKey,
  /** No fields configured means no filter panel, not a guessed field name. */
  filterFields: parseFilterFields(process.env.KA_FILTER_FIELDS, datasetConfigKey),
  dataset: parseDataset(process.env.KA_DATASETS, datasetConfigKey),

  kudosBase: (process.env.KUDOS_BASE ?? 'https://kudos.dfo.no').replace(/\/$/, ''),

  typesenseHost: process.env.TYPESENSE_API_HOST ?? '',
  typesenseKey: process.env.TYPESENSE_API_KEY_ADMIN ?? '',
  docsCollection: process.env.KUDOS_DOCS_COLLECTION ?? '',

  maxQueryLength: 4000,

  /** The build of apps/web. */
  webRoot: process.env.WEB_ROOT ?? '',

  next: nextConfig(),

  testers: testersConfig(),

  excerptEnvironment: excerptEnvironmentConfig(),

  auth,
} as const;

export const typesenseConfigured = Boolean(
  config.typesenseHost && config.typesenseKey && config.docsCollection,
);
