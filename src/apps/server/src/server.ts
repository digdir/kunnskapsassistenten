import { serve } from '@hono/node-server';
import { app, startUp } from './app.ts';
import { config, typesenseConfigured } from './config.ts';
import { listenHost } from './listen.ts';

const hostname = listenHost(config.auth.enabled);

serve({ fetch: app.fetch, port: config.port, hostname }, (info) => {
  console.log(
    `BFF on http://localhost:${info.port}, listening on ${hostname ?? 'every interface'}  →  ${config.apiBase}`,
  );
  console.log(`tool: ${config.tool}`);
  console.log(`dataset: ${config.tenant}/${config.datasetConfigKey}`);
  console.log(
    config.auth.mode === 'entra'
      ? `sign-in: Entra ID, tenant ${config.auth.tenantId}`
      : config.auth.mode === 'ansattporten'
        ? `sign-in: Ansattporten, ${config.auth.ansattporten.issuer}, the person's token to the backend`
        : 'sign-in: OFF. Unsigned development id, do not use this outside your own machine.',
  );
  if (!typesenseConfigured) {
    console.log('Typesense is not set up: no filters and no excerpts in the sources panel.');
  }
  startUp();
});
