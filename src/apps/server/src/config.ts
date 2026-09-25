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

function authMode(entraReady: boolean): 'entra' | 'off' {
  const asked = (process.env.AUTH_MODE ?? '').trim().toLowerCase();
  if (asked === 'entra' || asked === 'off') return asked;
  if (asked) {
    console.error(`AUTH_MODE må være entra eller off. Fikk "${asked}".`);
    process.exit(1);
  }
  return entraReady ? 'entra' : 'off';
}

function authConfig() {
  const tenantId = process.env.AZURE_TENANT_ID ?? '';
  const clientId = process.env.AZURE_CLIENT_ID ?? '';
  const clientSecret = process.env.AZURE_CLIENT_SECRET ?? '';
  const redirectUri =
    process.env.AZURE_REDIRECT_URI ??
    `http://localhost:${process.env.PORT ?? 8787}/auth/callback`;
  const origin = process.env.APP_ORIGIN?.replace(/\/$/, '') ?? new URL(redirectUri).origin;
  const sessionSecret = process.env.SESSION_SECRET ?? '';
  const entraReady = Boolean(tenantId && clientId && clientSecret);
  const mode = authMode(entraReady);
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
  };
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  apiBase: (process.env.DIGDIR_API_BASE ?? 'http://localhost:8099').replace(/\/$/, ''),
  apiKey: required('DIGDIR_API_KEY'),

  /** Default only: the browser may name another that the key already grants. */
  tool: process.env.DIGDIR_TOOL ?? 'builtin.agent-rag-agent__agent-rag-graph-bundled',
  tenant: process.env.DIGDIR_TENANT ?? 'public-sector-knowledge',
  agentId: process.env.DIGDIR_AGENT_ID ?? 'builtin/agent-rag-agent',
  datasetConfigKey: process.env.DIGDIR_DATASET_CONFIG_KEY ?? 'default',

  kudosBase: (process.env.KUDOS_BASE ?? 'https://kudos.dfo.no').replace(/\/$/, ''),

  typesenseHost: process.env.TYPESENSE_API_HOST ?? '',
  typesenseKey: process.env.TYPESENSE_API_KEY_ADMIN ?? '',
  docsCollection: process.env.KUDOS_DOCS_COLLECTION ?? '',

  maxQueryLength: 4000,

  webRoot: process.env.WEB_ROOT ?? '',

  auth: authConfig(),
} as const;

export const typesenseConfigured = Boolean(
  config.typesenseHost && config.typesenseKey && config.docsCollection,
);
