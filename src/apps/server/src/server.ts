import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import type { AskRequest } from '@ka/contract';
import { mountAuth, readUser, requireAuth } from './auth.ts';
import { capabilities, probe, probeComplete } from './capabilities.ts';
import { config, typesenseConfigured } from './config.ts';
import { ask, setAllowedTools } from './mcp.ts';
import * as convos from './conversations.ts';
import { facets, toFilterBy } from './facets.ts';
import { sessionMiddleware, type SessionVars } from './session.ts';
import * as sourceStore from './sourceStore.ts';

const app = new Hono<{ Variables: SessionVars }>();

app.use('*', sessionMiddleware);
mountAuth(app);
app.use('/api/*', async (c, next) =>
  c.req.path === '/api/health' ? next() : requireAuth(c, next),
);

app.get('/api/health', (c) => c.json({ ok: true, backend: config.apiBase, tool: config.tool }));

app.get('/api/me', (c) =>
  c.json({
    userId: c.get('userId'),
    user: c.get('user'),
    authenticated: !config.auth.enabled || Boolean(c.get('user')),
    authEnabled: config.auth.enabled,
  }),
);

app.get('/api/capabilities', (c) =>
  c.json({ capabilities: capabilities(), settled: probeComplete() }),
);

app.get('/api/models', async (c) => {
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
    return c.json({
      models: (body.data ?? []).map((m) => {
        const agent = (
          (m._agent_id ?? m.id.split('__')[0] ?? '').split(/[/.]/).pop() ?? m.id
        ).replace(/-agent$/, '');
        const mode = (m._mode ?? m.id.split('__')[1] ?? '').replace(/^agent-rag-graph-/, '');
        // `description` is "<agent> — <mode>: <internals>".
        const description = (m.description ?? '').split(/\s+—\s+/)[0]?.trim();
        return {
          id: m.id,
          label: mode && mode !== agent ? `${agent} (${mode})` : agent,
          isDefault: Boolean(m._default),
          ...(description ? { description } : {}),
        };
      }),
    });
  } catch {
    return c.json({ models: [] });
  }
});

app.get('/api/facets', async (c) => {
  try {
    return c.json({ facets: await facets() });
  } catch {
    return c.json({ facets: [] });
  }
});

app.get('/api/conversations', async (c) => {
  try {
    return c.json({ conversations: await convos.list(c.get('userId')) });
  } catch {
    return c.json({ error: 'Kunne ikke hente samtaler.' }, 502);
  }
});

app.get('/api/conversations/:id', async (c) => {
  try {
    const detail = await convos.detail(c.get('userId'), c.req.param('id'));
    return c.json({ ...detail, sources: sourceStore.recall(c.req.param('id')) });
  } catch {
    return c.json({ error: 'Fant ikke samtalen.' }, 404);
  }
});

app.put('/api/conversations/:id', async (c) => {
  const { title } = (await c.req.json().catch(() => ({}))) as { title?: string };
  if (!title?.trim()) return c.json({ error: 'Tittel kan ikke være tom.' }, 400);
  try {
    await convos.rename(c.get('userId'), c.req.param('id'), title.trim());
    return c.json({ ok: true });
  } catch {
    return c.json({ error: 'Kunne ikke endre navn.' }, 502);
  }
});

app.delete('/api/conversations/:id', async (c) => {
  try {
    await convos.remove(c.get('userId'), c.req.param('id'));
    sourceStore.forget(c.req.param('id'));
    return c.json({ ok: true });
  } catch {
    return c.json({ error: 'Kunne ikke slette samtalen.' }, 502);
  }
});

app.post('/api/ask', async (c) => {
  let body: AskRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Ugyldig JSON.' }, 400);
  }

  const query = (body.query ?? '').trim();
  if (!query) return c.json({ error: 'Spørsmålet kan ikke være tomt.' }, 400);
  if (query.length > config.maxQueryLength) {
    return c.json(
      { error: `Spørsmålet er for langt (maks ${config.maxQueryLength} tegn).` },
      400,
    );
  }

  const filterBy = toFilterBy((body as { filter?: Record<string, string[]> }).filter);
  const model =
    typeof (body as { model?: unknown }).model === 'string'
      ? (body as { model: string }).model
      : undefined;
  const userId = c.get('userId');
  let conversationId =
    typeof body.conversationId === 'string' ? body.conversationId : undefined;

  let created: { id: string; topic: string } | null = null;
  if (!conversationId) {
    try {
      const conv = await convos.create(userId, convos.topicFrom(query));
      conversationId = conv.id;
      created = { id: conv.id, topic: conv.topic };
    } catch {
      return c.json({ error: 'Kunne ikke opprette samtale.' }, 502);
    }
  }

  // Accumulating, compressing or dropping X-Accel-Buffering re-buffers the stream.
  const encoder = new TextEncoder();
  const upstreamAbort = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        if (created) send({ type: 'conversation', ...created });
        for await (const event of ask(
          query,
          conversationId,
          upstreamAbort.signal,
          model,
          filterBy,
        )) {
          if (event.type === 'sources' && conversationId) {
            sourceStore.remember(conversationId, event.sources);
          }
          send(event);
        }
      } catch (err) {
        const message =
          err instanceof Error && err.name === 'AbortError'
            ? 'Avbrutt.'
            : 'Uventet feil mot backend.';
        if (!(err instanceof Error && err.name === 'AbortError')) console.error(err);
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
    cancel() {
      upstreamAbort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});

if (config.webRoot) {
  app.use('/assets/*', serveStatic({ root: config.webRoot }));
  app.get('/favicon.ico', serveStatic({ root: config.webRoot, path: 'favicon.ico' }));
  app.get('*', async (c, next) => {
    if (config.auth.enabled && !(await readUser(c))) {
      return c.redirect(`/auth/login?next=${encodeURIComponent(c.req.path)}`);
    }
    return next();
  });
  app.get('*', serveStatic({ root: config.webRoot, path: 'index.html' }));
}

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`BFF på http://localhost:${info.port}  →  ${config.apiBase}`);
  console.log(`verktøy: ${config.tool}`);
  console.log(`datasett: ${config.tenant}/${config.datasetConfigKey}`);
  console.log(
    config.auth.mode === 'entra'
      ? `innlogging: Entra ID, tenant ${config.auth.tenantId}`
      : config.auth.mode === 'supabase'
        ? `innlogging: engangslenke på e-post, midlertidig. Domener: ${config.auth.allowedDomains.join(', ')}`
        : 'innlogging: AV. Usignert utviklings-id, ikke bruk dette utenfor egen maskin.',
  );
  if (!typesenseConfigured) {
    console.log('Typesense er ikke satt opp: ingen filtre og ingen utdrag i kildepanelet.');
  }
  void probe().then((caps) => {
    const on = Object.entries(caps)
      .map(([k, v]) => `${v ? '+' : '-'}${k}`)
      .join(' ');
    console.log(`backend kan: ${on}`);
  });
});
