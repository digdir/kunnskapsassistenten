import { Hono } from 'hono';
import type {
  CapabilitiesResponse,
  ConversationDetail,
  Source,
  TurnEvent,
  TurnEventV1,
} from '@ka/contract';
import { askRoute } from './apiAsk.ts';
import { rememberedThread, shared, type Env } from './apiShared.ts';
import { capabilities, probeComplete } from './capabilities.ts';
import { facets } from './facets.ts';

/**
 * `/api`: the format of main 8639267, for the client in apps/web-preact
 * (decisions/0009). The same core as `/api/v2` asks headless-rag (mcp.ts);
 * this lays main's format over it. When that client goes, this module and its
 * mount in app.ts go with it.
 */
export const v1 = new Hono<Env>();

v1.route('/', shared);

v1.post('/ask', askRoute(v1Events));

v1.get('/facets', async (c) => {
  try {
    const found = await facets();
    return c.json({
      facets: found.map(({ field, label, options }) => ({ field, label, options })),
    });
  } catch {
    return c.json({ facets: [] });
  }
});

v1.get('/capabilities', (c) =>
  c.json({
    capabilities: capabilities(),
    settled: probeComplete(),
  } satisfies CapabilitiesResponse),
);

v1.get('/conversations/:id', async (c) => {
  try {
    const thread = await rememberedThread(c.get('userId'), c.req.param('id'));
    return c.json({
      ...thread,
      messages: thread.messages.map(({ failed, ...message }) =>
        failed ? { ...message, text: FAILED_TURN } : message,
      ),
      sources: perDocument(thread.sources),
    } satisfies ConversationDetail);
  } catch {
    return c.json({ error: 'Fant ikke samtalen.' }, 404);
  }
});

/** A failed turn in main's format, which has nothing but the text to say so. */
const FAILED_TURN = 'Svaret kom ikke fram.';

/**
 * The six event types main sent, which is all useTurn.ts in apps/web-preact
 * handles: its `switch` has no `default`, so any other type empties the turn.
 * The agent's steps and tool calls are left out, and the sources are given per
 * document.
 */
export async function* v1Events(events: AsyncIterable<TurnEvent>): AsyncGenerator<TurnEventV1> {
  for await (const event of events) {
    if (event.type === 'thinking' || event.type === 'tool-call') continue;
    if (event.type === 'sources') {
      yield { type: 'sources', sources: perDocument(event.sources) };
      continue;
    }
    yield event;
  }
}

/**
 * One source per document, as main gave them: in the order each document
 * first appears, numbered from 1, with the passages of all its chunks joined.
 * A chunk with neither a document number nor a link is left out.
 */
export function perDocument(sources: Source[]): Source[] {
  const documents = new Map<string, Source[]>();
  for (const source of sources) {
    const key = source.docNum || source.url;
    if (key) documents.set(key, [...(documents.get(key) ?? []), source]);
  }
  return [...documents.values()].map((chunks, i) => {
    const { docNum, title, url } = chunks[0]!;
    const passages = chunks.flatMap((s) => (s.excerpt ? [s.excerpt] : []));
    return {
      docNum,
      title,
      url,
      marker: i + 1,
      ...(passages.length ? { excerpt: passages.join('\n\n') } : {}),
    };
  });
}
