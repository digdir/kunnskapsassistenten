import { Hono } from 'hono';
import type { TurnEvent } from '@ka/contract';
import { askRoute } from './apiAsk.ts';
import { rememberedThread, shared, type Env } from './apiShared.ts';
import { capabilities, probeComplete } from './capabilities.ts';
import { config } from './config.ts';
import { capabilitiesResponse } from './datasetConfig.ts';
import { facets } from './facets.ts';

/**
 * `/api/v2`: the API for the client in apps/web (decisions/0009). The turn's
 * events as the core gives them, with the agent's steps and tool calls, one
 * source per chunk, and the dataset's fields and name.
 */
export const v2 = new Hono<Env>();

v2.route('/', shared);

v2.post(
  '/ask',
  askRoute((events: AsyncIterable<TurnEvent>) => events),
);

v2.get('/facets', async (c) => {
  try {
    return c.json({ facets: await facets() });
  } catch {
    return c.json({ facets: [] });
  }
});

v2.get('/capabilities', (c) =>
  c.json(capabilitiesResponse(capabilities(), probeComplete(), config.dataset)),
);

v2.get('/conversations/:id', async (c) => {
  try {
    return c.json(await rememberedThread(c.get('userId'), c.req.param('id')));
  } catch {
    return c.json({ error: 'Fant ikke samtalen.' }, 404);
  }
});
