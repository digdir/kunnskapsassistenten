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

  auth,
} as const;

export const typesenseConfigured = Boolean(
  config.typesenseHost && config.typesenseKey && config.docsCollection,
);
