import { serve } from '@hono/node-server';
import { app } from './app.ts';
import { config, retiredSettingsIn } from './config.ts';
import { listenHost } from './listen.ts';

const hostname = listenHost(config.auth.enabled);

serve({ fetch: app.fetch, port: config.port, hostname }, (info) => {
  console.log(
    `KA on http://localhost:${info.port}, listening on ${hostname ?? 'every interface'}  →  ${config.apiBase}`,
  );
  console.log(`model: ${config.next.model}, tenant ${config.next.tenant}`);
  console.log(
    config.auth.mode === 'entra'
      ? `sign-in: Entra ID, tenant ${config.auth.tenantId}`
      : config.auth.mode === 'ansattporten'
        ? `sign-in: Ansattporten, ${config.auth.ansattporten.issuer}, the person's token to the backend`
        : 'sign-in: OFF. Unsigned development id, do not use this outside your own machine.',
  );
  console.log(
    config.next.webRoot
      ? `client: ${config.next.webRoot}${config.next.layout ? ', drawn from the layout in KA_NEXT_LAYOUT' : ''}`
      : 'client: none (WEB_NEXT_ROOT is unset), so only the API is served',
  );
  const retired = retiredSettingsIn();
  if (retired.length > 0) {
    console.log(`no longer read, and safe to remove: ${retired.join(', ')}`);
  }
});
