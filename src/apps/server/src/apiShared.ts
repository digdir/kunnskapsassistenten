import { Hono } from 'hono';
import type {
  ConversationDetail,
  ConversationListResponse,
  FeedbackResponse,
  MeResponse,
  Message,
  ModelsResponse,
  Source,
} from '@ka/contract';
import { readSessionId } from './auth.ts';
import { appHeaders, type Caller } from './backend.ts';
import { config } from './config.ts';
import * as convos from './conversations.ts';
import { cleanFeedback, ownsTask, sendFeedback } from './feedback.ts';
import { setAllowedTools } from './mcp.ts';
import { toAgents } from './models.ts';
import type { SessionVars } from './session.ts';
import * as sourceStore from './sourceStore.ts';
import * as threadFilters from './threadFilters.ts';
import { getTokens } from './tokenStore.ts';

export type Env = { Variables: SessionVars };

/**
 * Routes kept apart from the version module and mounted in apiV2.ts. `/api/*`
 * mounted them too, until the client in apps/web-preact was retired
 * (decisions/0009, 0012).
 */
export const shared = new Hono<Env>();

shared.get('/health', (c) => c.json({ ok: true }));

shared.get('/me', async (c) => {
  const tokens =
    config.auth.mode === 'ansattporten' ? getTokens(await readSessionId(c)) : undefined;
  return c.json({
    userId: c.get('userId'),
    user: c.get('user'),
    authenticated: !config.auth.enabled || Boolean(c.get('user')),
    authEnabled: config.auth.enabled,
    backend: config.apiBase,
    tool: config.tool,
    ...(tokens
      ? { organisations: tokens.organisations, actingFor: tokens.actingFor ?? null }
      : {}),
  } satisfies MeResponse);
});

/** Whatever the reason, none is the same empty list, which the client reads. */
const noAgents: ModelsResponse = { agents: [] };

shared.get('/models', async (c) => {
  try {
    const res = await fetch(`${config.apiBase}/v1/models`, {
      headers: appHeaders(c.get('caller')),
    });
    if (!res.ok) return c.json(noAgents);
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
    return c.json({ agents: toAgents(body.data ?? []) } satisfies ModelsResponse);
  } catch {
    return c.json(noAgents);
  }
});

shared.get('/conversations', async (c) => {
  try {
    return c.json({
      conversations: await convos.list(c.get('caller')),
    } satisfies ConversationListResponse);
  } catch (err) {
    return c.json(convos.failure('Kunne ikke hente samtaler.', err), 502);
  }
});

shared.put('/conversations/:id', async (c) => {
  const { title } = (await c.req.json().catch(() => ({}))) as { title?: string };
  if (!title?.trim()) return c.json({ error: 'Tittel kan ikke være tom.' }, 400);
  try {
    await convos.rename(c.get('caller'), c.req.param('id'), title.trim());
    return c.json({ ok: true });
  } catch (err) {
    return c.json(convos.failure('Kunne ikke endre navn.', err), 502);
  }
});

shared.delete('/conversations/:id', async (c) => {
  try {
    await convos.remove(c.get('caller'), c.req.param('id'));
    sourceStore.forget(c.req.param('id'));
    threadFilters.forget(c.req.param('id'));
    return c.json({ ok: true });
  } catch (err) {
    return c.json(convos.failure('Kunne ikke slette samtalen.', err), 502);
  }
});

shared.post('/feedback', async (c) => {
  const feedback = cleanFeedback(await c.req.json().catch(() => undefined));
  if (typeof feedback === 'string') return c.json({ error: feedback }, 400);
  const caller = c.get('caller');
  if (!(await ownsTask(caller, feedback)))
    return c.json({ error: 'Fant ikke svaret i samtalen.' }, 404);
  try {
    return c.json((await sendFeedback(caller, feedback)) satisfies FeedbackResponse);
  } catch (err) {
    return c.json(convos.failure('Kunne ikke sende tilbakemeldingen.', err), 502);
  }
});

/**
 * A thread, with what this BFF remembers of it: the last answer's sources, one
 * per chunk, and the filter it was started with. Throws when the thread is
 * not the user's.
 */
export async function rememberedThread(
  caller: Caller,
  id: string,
): Promise<ConversationDetail & { sources: Source[] }> {
  const detail = await convos.detail(caller, id);
  return {
    ...detail,
    messages: withoutStoredFailures(id, detail.messages),
    sources: sourceStore.recall(id),
    filter: threadFilters.recall(id),
  };
}

/** The agent loop's sentence for a failed turn, which headless-rag stores as the answer. */
const STORED_FAILURE = /^LLM request failed\b/;

/**
 * A failed turn is marked `failed` and its text goes to the log, as for F5:
 * it can name hosts and replies from the model.
 */
function withoutStoredFailures(conversationId: string, messages: Message[]): Message[] {
  return messages.map((message) => {
    if (message.role !== 'assistant' || !STORED_FAILURE.test(message.text)) return message;
    console.error(
      'stored failed turn %s: %s',
      JSON.stringify(conversationId),
      JSON.stringify(message.text),
    );
    return { ...message, text: '', failed: true };
  });
}
