import { serve } from '@hono/node-server';
import { app, startUp } from './app.ts';
import { config, typesenseConfigured } from './config.ts';

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
  startUp();
});
