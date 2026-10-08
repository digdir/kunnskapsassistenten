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

/** Two values in each field, so one of them chosen is a filter and not «all». */
const FACETS = {
  facet_counts: [
    {
      field_name: 'type',
      counts: [
        { value: 'Årsrapport', count: 3 },
        { value: 'Tildelingsbrev', count: 1 },
      ],
    },
    {
      field_name: 'orgs_long',
      counts: [
        { value: 'Digitaliseringsdirektoratet', count: 2 },
        { value: 'Statens vegvesen', count: 1 },
      ],
    },
    {
      field_name: 'concerned_years',
      counts: [
        { value: '2024', count: 5 },
        { value: '2023', count: 2 },
      ],
    },
  ],
};

export interface Backend {
  /** The body of every `tools/call` sent to `/api/mcp`. */
  mcp: Array<Record<string, any>>;
  /** Every facet fetch from Typesense. */
  facetFetches: number;
  /** When true, the next turns end in a JSON-RPC error, as for an exception. */
  failing: boolean;
  /** While set, `/api/mcp` waits for it, so a test can act in the middle of a turn. */
  held: Promise<void> | null;
  /** When true, headless-rag cannot be reached; Typesense still answers. */
  down: boolean;
  /** The messages a thread read back has, as headless-rag stores them. */
  messages: Array<{ id: string; role: string; text: string; created: number }>;
  restore(): void;
}

const FAILURE = frame({ id: 1, error: { code: -32603, message: 'Internal error' } });

export function fakeBackend(): Backend {
  const original = globalThis.fetch;
  let created = 0;
  const backend: Backend = {
    mcp: [],
    facetFetches: 0,
    failing: false,
    held: null,
    down: false,
    messages: [],
    restore: () => {
      globalThis.fetch = original;
    },
  };
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === 'typesense.test') {
      if (url.searchParams.has('facet_by')) {
        backend.facetFetches += 1;
        return Response.json(FACETS);
      }
      return Response.json({
        hits: CHUNKS.map((c) => ({
          document: { chunk_id: c.chunk_id, content_markdown: PASSAGES[c.chunk_id] },
        })),
      });
    }
    if (backend.down) throw new TypeError('fetch failed');
    const conversation = (id: string) => ({ id, topic: 'Hva sier årsrapportene?', created: 1 });
    if (url.pathname === '/api/conversations') {
      // c1, c2, …: a new thread for every question that has none.
      return init?.method === 'POST'
        ? Response.json({ conversation: conversation(`c${++created}`) })
        : Response.json({ conversations: [conversation('c1')] });
    }
    const thread = /^\/api\/conversations\/([^/]+)$/.exec(url.pathname);
    if (thread) {
      return Response.json({
        conversation: conversation(thread[1]!),
        messages: backend.messages,
      });
    }
    if (url.pathname === '/api/mcp') {
      backend.mcp.push(JSON.parse(String(init?.body)));
      if (backend.held) await backend.held;
      return new Response(backend.failing ? FAILURE : STREAM, {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  return backend;
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
