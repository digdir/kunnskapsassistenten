import { Hono } from 'hono';
import type { ConversationDetail, Source } from '@ka/contract';
import { config } from './config.ts';
import * as convos from './conversations.ts';
import { setAllowedTools } from './mcp.ts';
import { toAgents } from './models.ts';
import type { SessionVars } from './session.ts';
import * as sourceStore from './sourceStore.ts';
import * as threadFilters from './threadFilters.ts';

export type Env = { Variables: SessionVars };

/**
 * The routes both API versions answer the same way, written once and mounted
 * in each (apiV1.ts, apiV2.ts, decisions/0009).
 */
export const shared = new Hono<Env>();

shared.get('/health', (c) => c.json({ ok: true }));

shared.get('/me', (c) =>
  c.json({
    userId: c.get('userId'),
    user: c.get('user'),
    authenticated: !config.auth.enabled || Boolean(c.get('user')),
    authEnabled: config.auth.enabled,
    backend: config.apiBase,
    tool: config.tool,
  }),
);

shared.get('/models', async (c) => {
  try {
    const res = await fetch(`${config.apiBase}/v1/models`, {
      headers: { 'X-API-Key': config.apiKey },
    });
    if (!res.ok) return c.json({ models: [] });
    const body = (await res.json()) as {
      data?: Array<{
        id: string;
        description?: string;
        _default?: boolean;
        _mode?: string;
        _agent_id?: string;
      }>;
    };
    setAllowedTools((body.data ?? []).map((m) => m.id));
    return c.json({ agents: toAgents(body.data ?? []) });
  } catch {
    return c.json({ agents: [] });
  }
});

shared.get('/conversations', async (c) => {
  try {
    return c.json({ conversations: await convos.list(c.get('userId')) });
  } catch {
    return c.json({ error: 'Kunne ikke hente samtaler.' }, 502);
  }
});

shared.put('/conversations/:id', async (c) => {
  const { title } = (await c.req.json().catch(() => ({}))) as { title?: string };
  if (!title?.trim()) return c.json({ error: 'Tittel kan ikke være tom.' }, 400);
  try {
    await convos.rename(c.get('userId'), c.req.param('id'), title.trim());
    return c.json({ ok: true });
  } catch {
    return c.json({ error: 'Kunne ikke endre navn.' }, 502);
  }
});

shared.delete('/conversations/:id', async (c) => {
  try {
    await convos.remove(c.get('userId'), c.req.param('id'));
    sourceStore.forget(c.req.param('id'));
    threadFilters.forget(c.req.param('id'));
    return c.json({ ok: true });
  } catch {
    return c.json({ error: 'Kunne ikke slette samtalen.' }, 502);
  }
});

/**
 * A thread, with what this BFF remembers of it: the last answer's sources, one
 * per chunk, and the filter it was started with. Each version gives the
 * sources in its own format. Throws when the thread is not the user's.
 */
export async function rememberedThread(
  userId: string,
  id: string,
): Promise<ConversationDetail & { sources: Source[] }> {
  const detail = await convos.detail(userId, id);
  return { ...detail, sources: sourceStore.recall(id), filter: threadFilters.recall(id) };
}
