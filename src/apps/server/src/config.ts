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

function allowedDomainsOf(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? '')
    .split(/[,\s]+/)
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

function authMode(entraReady: boolean, supabaseReady: boolean): 'entra' | 'supabase' | 'off' {
  const asked = (process.env.AUTH_MODE ?? '').trim().toLowerCase();
  if (asked === 'entra' || asked === 'supabase' || asked === 'off') return asked;
  if (asked) {
    console.error(`AUTH_MODE må være entra, supabase eller off. Fikk "${asked}".`);
    process.exit(1);
  }
  return entraReady ? 'entra' : supabaseReady ? 'supabase' : 'off';
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
  const supabaseUrl = process.env.SUPABASE_URL ?? '';
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
  const entraReady = Boolean(tenantId && clientId && clientSecret);
  const supabaseReady = Boolean(supabaseUrl && supabasePublishableKey);
  const mode = authMode(entraReady, supabaseReady);
  const enabled = mode !== 'off';
  if (mode === 'entra' && !entraReady) {
    console.error(
      'AUTH_MODE=entra krever AZURE_TENANT_ID, AZURE_CLIENT_ID og AZURE_CLIENT_SECRET.',
    );
    process.exit(1);
  }
  if (mode === 'supabase' && !supabaseReady) {
    console.error('AUTH_MODE=supabase krever SUPABASE_URL og SUPABASE_PUBLISHABLE_KEY.');
    process.exit(1);
  }
  if (mode === 'supabase' && allowedDomainsOf().length === 0) {
    console.error('AUTH_MODE=supabase krever ALLOWED_EMAIL_DOMAINS.');
    process.exit(1);
  }
  if (enabled && sessionSecret.length < 32) {
    console.error('SESSION_SECRET må være minst 32 tegn når innlogging er slått på.');
    process.exit(1);
  }
  const allowedDomains = allowedDomainsOf();
  return {
    enabled,
    mode,
    supabaseUrl,
    supabasePublishableKey,
    tenantId,
    clientId,
    clientSecret,
    redirectUri,
    origin,
    sessionSecret,
    allowedDomains,
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
