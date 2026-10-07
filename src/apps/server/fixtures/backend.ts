/**
 * headless-rag and Typesense behind `globalThis.fetch`, for the contract tests
 * of `/api/*` and `/api/v2/*`. One turn, the same every time: the agent thinks,
 * runs a search, and answers from three chunks, two of them from one document.
 */

const frame = (msg: object) => `data: ${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n\n`;
const progress = (meta: object) =>
  frame({ method: 'notifications/progress', params: { _meta: meta } });

export const CHUNKS = [
  { chunk_id: 'a', doc_num: '1', title: 'Årsrapport 2024' },
  { chunk_id: 'b', doc_num: '1', title: 'Årsrapport 2024' },
  { chunk_id: 'c', doc_num: '2', title: 'Tildelingsbrev 2024' },
];

export const PASSAGES: Record<string, string> = {
  a: 'Første avsnitt.',
  b: 'Andre avsnitt.',
  c: 'Tredje avsnitt.',
};

const STREAM =
  progress({ event: 'agent/iteration-started', iteration: 1, 'max-iterations': 10 }) +
  progress({ event: 'agent/thinking', iteration: 1, reasoning: 'Jeg søker i årsrapportene.' }) +
  progress({
    event: 'agent/turn-completed',
    iteration: 1,
    'tool-calls': [
      {
        tool: 'search',
        'duration-ms': 12,
        'result-summary': 'Search pass 1: found 3 chunks.',
        args: { queries: ['årsrapport 2024'] },
      },
    ],
  }) +
  progress({ event: 'agent/finalized', iteration: 2 }) +
  frame({
    id: 1,
    result: {
      content: [{ type: 'text', text: 'Svaret [1], [2] og [3].' }],
      structuredContent: { conversation_id: 'c1', chunks: CHUNKS },
    },
  });

const FACETS = {
  facet_counts: [
    { field_name: 'type', counts: [{ value: 'Årsrapport', count: 3 }] },
    { field_name: 'orgs_long', counts: [{ value: 'Digitaliseringsdirektoratet', count: 2 }] },
    { field_name: 'concerned_years', counts: [{ value: '2024', count: 5 }] },
  ],
};

export interface Backend {
  /** The body of every `tools/call` sent to `/api/mcp`. */
  mcp: Array<Record<string, any>>;
  restore(): void;
}

export function fakeBackend(): Backend {
  const original = globalThis.fetch;
  const mcp: Array<Record<string, any>> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === 'typesense.test') {
      if (url.searchParams.has('facet_by')) return Response.json(FACETS);
      return Response.json({
        hits: CHUNKS.map((c) => ({
          document: { chunk_id: c.chunk_id, content_markdown: PASSAGES[c.chunk_id] },
        })),
      });
    }
    const conversation = { id: 'c1', topic: 'Hva sier årsrapportene?', created: 1 };
    if (url.pathname === '/api/conversations') {
      return init?.method === 'POST'
        ? Response.json({ conversation })
        : Response.json({ conversations: [conversation] });
    }
    if (url.pathname === '/api/conversations/c1') {
      return Response.json({ conversation, messages: [] });
    }
    if (url.pathname === '/api/mcp') {
      mcp.push(JSON.parse(String(init?.body)));
      return new Response(STREAM, { headers: { 'Content-Type': 'text/event-stream' } });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  return {
    mcp,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

/** The `data:` events of an SSE body, parsed. */
export async function events(res: Response): Promise<Array<Record<string, any>>> {
  return (await res.text())
    .split('\n\n')
    .filter((f) => f.startsWith('data: '))
    .map((f) => JSON.parse(f.slice(6)));
}

/** The environment both contract tests run in: Kudos's fields, and a Typesense. */
export function setEnvironment(): void {
  process.env.DIGDIR_API_KEY ??= 'test-key';
  process.env.DIGDIR_API_BASE = 'http://backend.test';
  process.env.KUDOS_BASE = 'https://kudos.example';
  process.env.KA_FILTER_FIELDS =
    'default=documentType:type|organisation:orgs_long|year:concerned_years:integer';
  process.env.KA_DATASETS = 'default=Kudos|Tre dokumenter';
  process.env.TYPESENSE_API_HOST = 'typesense.test';
  process.env.TYPESENSE_API_KEY_ADMIN = 'test-typesense-key';
  process.env.KUDOS_DOCS_COLLECTION = 'kudos_documents_test';
}
