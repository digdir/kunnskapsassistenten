import { serve } from '@hono/node-server';
import { app } from './app.ts';
import { probe } from './capabilities.ts';
import { config, typesenseConfigured } from './config.ts';
import { facets } from './facets.ts';

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`BFF på http://localhost:${info.port}  →  ${config.apiBase}`);
  console.log(`verktøy: ${config.tool}`);
  console.log(`datasett: ${config.tenant}/${config.datasetConfigKey}`);
  console.log(
    config.auth.mode === 'entra'
      ? `innlogging: Entra ID, tenant ${config.auth.tenantId}`
      : 'innlogging: AV. Usignert utviklings-id, ikke bruk dette utenfor egen maskin.',
  );
  if (!typesenseConfigured) {
    console.log('Typesense er ikke satt opp: ingen filtre og ingen utdrag i kildepanelet.');
  }
  // Warm, so the first question after a restart is answered from the cache.
  void facets().catch(() => {});
  void probe().then((caps) => {
    const on = Object.entries(caps)
      .map(([k, v]) => `${v ? '+' : '-'}${k}`)
      .join(' ');
    console.log(`backend kan: ${on}`);
  });
});
