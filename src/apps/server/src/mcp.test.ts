import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, describe, test, type TestContext } from 'node:test';
import { format } from 'node:util';

// config.ts exits on a missing key at import time, hence the dynamic import.
process.env.DIGDIR_API_KEY ??= 'test-key';
process.env.KUDOS_BASE = 'https://kudos.example';

let mcp: typeof import('./mcp.ts');
before(async () => {
  mcp = await import('./mcp.ts');
});

const noExcerpts = async () => new Map<string, string>();

describe('takeFrames', () => {
  test('splits on the blank line and drops the separator', () => {
    const { frames, rest } = mcp.takeFrames('data: a\n\ndata: b\n\n');
    assert.deepEqual(frames, ['data: a', 'data: b']);
    assert.equal(rest, '');
  });

  test('holds back a frame that has not finished arriving', () => {
    const { frames, rest } = mcp.takeFrames('data: a\n\ndata: par');
    assert.deepEqual(frames, ['data: a']);
    assert.equal(rest, 'data: par');
  });

  test('keeps a multi-line frame whole — the split is a blank line, not any newline', () => {
    const { frames } = mcp.takeFrames('event: message\ndata: {"a":1}\n\n');
    assert.deepEqual(frames, ['event: message\ndata: {"a":1}']);
  });

  test('parses the captured backend stream into its 16 frames', () => {
    const raw = readFileSync(
      new URL('../fixtures/mcp-stream-raw.sse', import.meta.url),
      'utf8',
    );
    const { frames } = mcp.takeFrames(raw);
    const messages = frames.map(mcp.frameData).filter(Boolean);
    assert.equal(messages.length, 16);
    assert.equal(messages.filter((m) => m!.result).length, 1, 'exactly one final result frame');
  });

  test('a frame split across two reads parses once, whole', () => {
    const first = mcp.takeFrames('data: {"id":');
    assert.deepEqual(first.frames, []);
    const second = mcp.takeFrames(first.rest + '1}\n\n');
    assert.deepEqual(second.frames, ['data: {"id":1}']);
    assert.equal(mcp.frameData(second.frames[0]!)?.id, 1);
  });
});

describe('frameData', () => {
  test('reads the data line past any event line', () => {
    assert.deepEqual(mcp.frameData('event: message\ndata: {"a":1}'), { a: 1 });
  });

  test('returns null rather than throwing on a comment or malformed JSON', () => {
    assert.equal(mcp.frameData(': keep-alive'), null);
    assert.equal(mcp.frameData('data: {oops'), null);
  });
});

describe('toSources', () => {
  test('one source per chunk, so a document that gave two keeps both excerpts', async () => {
    const sources = await mcp.toSources(
      [
        { chunk_id: 'a', doc_num: '1', title: 'Rapport' },
        { chunk_id: 'b', doc_num: '1', title: 'Rapport' },
        { chunk_id: 'c', doc_num: '2', title: 'Annen' },
      ],
      noExcerpts,
    );
    assert.deepEqual(
      sources.map((s) => [s.chunkId, s.docNum]),
      [
        ['a', '1'],
        ['b', '1'],
        ['c', '2'],
      ],
    );
  });

  test("keeps genki's order, which is the order it numbered the documents in", async () => {
    const sources = await mcp.toSources(
      [
        { chunk_id: 'x', doc_num: '9', title: 'Ni' },
        { chunk_id: 'y', doc_num: '4', title: 'Fire' },
        { chunk_id: 'z', doc_num: '9', title: 'Ni' },
      ],
      noExcerpts,
    );
    assert.deepEqual(
      sources.map((s) => s.chunkId),
      ['x', 'y', 'z'],
    );
  });

  test("a chunk's place in the list is not a footnote: no source claims an [n] by position", async () => {
    const sources = await mcp.toSources(
      [
        { chunk_id: 'a', doc_num: '1' },
        { chunk_id: 'b', doc_num: '1' },
      ],
      noExcerpts,
    );
    for (const source of sources) {
      assert.equal('marker' in source, false);
      assert.equal('markers' in source, false);
    }
  });

  test('builds a Kudos url when the backend leaves url null', async () => {
    const [source] = await mcp.toSources([{ doc_num: '413482' }], noExcerpts);
    assert.equal(source?.url, 'https://kudos.example/documents/413482');
  });

  test('keeps a url the backend did supply', async () => {
    const [source] = await mcp.toSources(
      [{ doc_num: '1', url: 'https://elsewhere.example/doc' }],
      noExcerpts,
    );
    assert.equal(source?.url, 'https://elsewhere.example/doc');
  });

  test('falls back to a title when the chunk has none', async () => {
    const [source] = await mcp.toSources([{ doc_num: '77' }], noExcerpts);
    assert.equal(source?.title, 'Dokument 77');
  });

  test("each chunk carries its own passage, never the document's glued together", async () => {
    const sources = await mcp.toSources(
      [
        { chunk_id: 'a', doc_num: '1' },
        { chunk_id: 'b', doc_num: '1' },
      ],
      async () =>
        new Map([
          ['a', 'first'],
          ['b', 'second'],
        ]),
    );
    assert.deepEqual(
      sources.map((s) => s.excerpt),
      ['first', 'second'],
    );
  });

  test('omits excerpt entirely when no passage was found', async () => {
    const [source] = await mcp.toSources([{ chunk_id: 'a', doc_num: '1' }], noExcerpts);
    assert.equal('excerpt' in source!, false);
  });

  test('a failed excerpt lookup costs the passage, not the turn', async () => {
    const sources = await mcp.toSources(
      [{ chunk_id: 'a', doc_num: '1', title: 'T' }],
      async () => {
        throw new Error('typesense down');
      },
    );
    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.excerpt, undefined);
  });

  test('a chunk with neither doc_num nor url keeps its place', async () => {
    const sources = await mcp.toSources(
      [{ chunk_id: 'orphan' }, { chunk_id: 'b', doc_num: '2', title: 'To' }],
      noExcerpts,
    );
    assert.deepEqual(
      sources.map((s) => [s.chunkId, s.docNum, s.url]),
      [
        ['orphan', '', ''],
        ['b', '2', 'https://kudos.example/documents/2'],
      ],
    );
  });

  test('no chunks means no sources', async () => {
    assert.deepEqual(await mcp.toSources(undefined, noExcerpts), []);
    assert.deepEqual(await mcp.toSources([], noExcerpts), []);
  });

  test("gives each source its own chunk's section path, top level first, joined by ›", async () => {
    const sources = await mcp.toSources(
      [
        {
          chunk_id: 'a',
          doc_num: '1',
          metadata: { 'Header 2': 'Digitalt utenforskap', 'Header 1': 'Samlet vurdering' },
        },
        {
          chunk_id: 'b',
          doc_num: '1',
          metadata: { 'Header 1': 'Vurdering av framtidsutsikter' },
        },
      ],
      noExcerpts,
    );
    assert.deepEqual(
      sources.map((s) => s.heading),
      ['Samlet vurdering › Digitalt utenforskap', 'Vurdering av framtidsutsikter'],
    );
  });

  test('leaves the heading out when the chunk has no section headings', async () => {
    const sources = await mcp.toSources(
      [
        { chunk_id: 'a', doc_num: '1' },
        { chunk_id: 'b', doc_num: '1', metadata: null },
        { chunk_id: 'c', doc_num: '1', metadata: {} },
        { chunk_id: 'd', doc_num: '1', metadata: { 'Header 1': '  ', 'Header 2': 7 } },
        { chunk_id: 'e', doc_num: '1', metadata: '{"Header 1" "Mål"}' },
      ],
      noExcerpts,
    );
    for (const source of sources) assert.equal('heading' in source, false, source.chunkId);
  });

  test('reads only the Header levels, so no other metadata reaches the heading', async () => {
    const [source] = await mcp.toSources(
      [
        {
          chunk_id: 'a',
          doc_num: '1',
          metadata: { url: 'https://kudos.example/x', 'Header 1': 'Mål', title: 'Rapport' },
        },
      ],
      noExcerpts,
    );
    assert.equal(source?.heading, 'Mål');
  });
});

describe('documentUrl safety', () => {
  test('a javascript: url from an indexed document never becomes a link', async () => {
    const sources = await mcp.toSources(
      [{ chunk_id: 'c1', doc_num: '42', url: 'javascript:alert(document.cookie)' }],
      async () => new Map(),
    );
    assert.ok(!sources[0]?.url.startsWith('javascript:'));
  });

  test('a data: url is refused too', async () => {
    const sources = await mcp.toSources(
      [{ chunk_id: 'c1', doc_num: '42', url: 'data:text/html,<script>alert(1)</script>' }],
      async () => new Map(),
    );
    assert.ok(!sources[0]?.url.startsWith('data:'));
  });

  test('a UUID goes to /dokument/, where Kudos has it, and a number to /documents/', async () => {
    const uuid = '650630f6-36a8-4119-bd65-5ea0af7b8718';
    const sources = await mcp.toSources(
      [
        { chunk_id: 'c1', doc_num: uuid },
        { chunk_id: 'c2', doc_num: '370449' },
      ],
      async () => new Map(),
    );
    assert.equal(sources[0]?.url, `https://kudos.example/dokument/${uuid}`);
    assert.equal(sources[1]?.url, 'https://kudos.example/documents/370449');
  });

  test('a number in neither shape gets no link, and nothing reaches the path', async () => {
    const sources = await mcp.toSources(
      [
        { chunk_id: 'c1', doc_num: '../admin?x=1' },
        { chunk_id: 'c2', doc_num: 'doc-7' },
      ],
      async () => new Map(),
    );
    assert.deepEqual(
      sources.map((s) => s.url),
      ['', ''],
    );
  });

  test('an ordinary https url is kept', async () => {
    const sources = await mcp.toSources(
      [{ chunk_id: 'c1', doc_num: '42', url: 'https://kudos.dfo.no/documents/42' }],
      async () => new Map(),
    );
    assert.equal(sources[0]?.url, 'https://kudos.dfo.no/documents/42');
  });
});

describe('ask: plan and answer', () => {
  const recorded = readFileSync(
    new URL('../fixtures/mcp-stream-raw.sse', import.meta.url),
    'utf8',
  );

  /** The recorded stream, with the final frame's text swapped for `answer`. */
  function withAnswer(answer: string): string {
    return mcp
      .takeFrames(recorded)
      .frames.map((frame) => {
        const msg = mcp.frameData(frame);
        if (!msg?.result) return frame;
        msg.result.content = [{ type: 'text', text: answer }];
        return `event: message\ndata: ${JSON.stringify(msg)}`;
      })
      .join('\n\n')
      .concat('\n\n');
  }

  /** Every event `ask` yields for one canned upstream body. */
  async function eventsFrom(body: string): Promise<Array<Record<string, unknown>>> {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
    try {
      const out: Array<Record<string, unknown>> = [];
      for await (const e of mcp.ask(
        'q',
        { userId: 'u' },
        undefined,
        new AbortController().signal,
      )) {
        out.push(e as unknown as Record<string, unknown>);
      }
      return out;
    } finally {
      globalThis.fetch = original;
    }
  }

  async function deltas(body: string): Promise<string> {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
    try {
      let text = '';
      for await (const e of mcp.ask(
        'q',
        { userId: 'u' },
        undefined,
        new AbortController().signal,
      )) {
        if (e.type === 'delta') text += e.text;
      }
      return text;
    } finally {
      globalThis.fetch = original;
    }
  }

  test('the plan the agent streams is dropped, and the final frame is the answer', async () => {
    const text = await deltas(withAnswer('Svaret [1].'));
    assert.equal(text, 'Svaret [1].');
  });

  /** Every event `ask` yields for one canned upstream. */
  async function events(
    upstream: () => Promise<Response>,
  ): Promise<Array<Record<string, unknown>>> {
    const original = globalThis.fetch;
    globalThis.fetch = upstream as typeof globalThis.fetch;
    try {
      const out: Array<Record<string, unknown>> = [];
      for await (const e of mcp.ask(
        'q',
        { userId: 'u' },
        undefined,
        new AbortController().signal,
      )) {
        out.push(e as unknown as Record<string, unknown>);
      }
      return out;
    } finally {
      globalThis.fetch = original;
    }
  }

  const sse = (body: string) =>
    new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });

  test('a backend that cannot be reached is named as that, not as a broken stream', async () => {
    const [event] = await events(async () => {
      throw Object.assign(new TypeError('fetch failed'), {
        cause: { code: 'ECONNREFUSED' },
      });
    });
    assert.equal(event?.type, 'error');
    assert.equal(event?.code, 'backend_unreachable');
    assert.match(String(event?.message), /ECONNREFUSED/);
  });

  test('an abort stays an exception, so the route can tell it from a failure', async () => {
    await assert.rejects(
      events(async () => {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      }),
      { name: 'AbortError' },
    );
  });

  test('an HTTP status from the backend carries both the sentence and a code', async () => {
    const [event] = await events(async () => new Response('nope', { status: 503 }));
    assert.equal(event?.code, 'backend_http_503');
    assert.equal(event?.message, 'Backend svarte 503.');
  });

  /** What has been written to console.error since, one line per call. */
  function logged(t: TestContext): () => string[] {
    const error = t.mock.method(console, 'error', () => {});
    return () => error.mock.calls.map((call) => format(...call.arguments));
  }

  test("the backend's own code in _meta reaches the client, and its text only the log", async (t) => {
    // headless-rag's text for a failed tool call is its own `:message`, which
    // can be an exception's, with host names in it (mcp/tools.clj).
    const text = 'Connection refused: typesense.internal:8108\n[ka] alt i orden';
    const frame = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        isError: true,
        content: [{ type: 'text', text }],
        _meta: { code: 'dataset_not_authorized' },
      },
    };
    const lines = logged(t);
    const [event] = await events(async () => sse(`data: ${JSON.stringify(frame)}\n\n`));
    assert.equal(event?.type, 'error');
    assert.equal(event?.code, 'dataset_not_authorized');
    assert.equal(event?.message, 'Backend svarte med en feil.');
    const [line = '', ...more] = lines();
    assert.equal(more.length, 0);
    assert.ok(line.includes(JSON.stringify(text)), line);
    assert.ok(!line.includes('\n'), 'one line in the log, whatever the text holds');
  });

  test('an exception in headless-rag gets a code of ours, and its text only the log', async (t) => {
    // `internal-error` with the exception's own message, and `data` that is
    // `{:tool …}` in tools/call or left out, never `data.code`
    // (mcp/transport.clj).
    const text = 'java.net.UnknownHostException: llm.internal';
    for (const data of [{ tool: 'builtin.agent-rag-agent' }, undefined]) {
      const frame = { jsonrpc: '2.0', id: 1, error: { code: -32603, message: text, data } };
      const lines = logged(t);
      const events_ = await events(async () => sse(`data: ${JSON.stringify(frame)}\n\n`));
      assert.equal(events_.length, 1, 'an error, not a stream that ran out');
      assert.equal(events_[0]?.code, 'backend_jsonrpc_-32603');
      assert.equal(events_[0]?.message, 'Backend svarte med en feil.');
      assert.ok(lines().at(-1)?.includes(JSON.stringify(text)), lines().at(-1));
      t.mock.restoreAll();
    }
  });

  test("a JSON-RPC error with the backend's own code keeps it", async (t) => {
    logged(t);
    const frame = {
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32602, message: 'Unknown tool', data: { code: 'invalid_tool_name' } },
    };
    const [event] = await events(async () => sse(`data: ${JSON.stringify(frame)}\n\n`));
    assert.equal(event?.code, 'invalid_tool_name');
    assert.equal(event?.message, 'Backend svarte med en feil.');
  });

  test('a stream that breaks while it is read is a broken stream too, with a code', async () => {
    // A connection dropped mid-turn makes the read throw (undici: «terminated»),
    // rather than end.
    const frame = `data: ${JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: { _meta: { event: 'agent/iteration-started', iteration: 1 } },
    })}\n\n`;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(frame));
      },
      pull(controller) {
        controller.error(new TypeError('terminated'));
      },
    });
    const sent = await events(async () => new Response(body));
    assert.equal(sent.at(-1)?.type, 'error');
    assert.equal(sent.at(-1)?.code, 'stream_broken');
    assert.equal(sent.at(-1)?.message, 'Forbindelsen til backend ble brutt.');
  });

  test('an abort while the stream is read stays an exception, so the turn is «Avbrutt.»', async () => {
    // The route tells a stopped turn from a failure by the exception.
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      },
    });
    await assert.rejects(
      events(async () => new Response(body)),
      { name: 'AbortError' },
    );
  });

  test('a stream that ends without a result is a broken stream, with a code', async () => {
    const [event] = await events(async () => sse(''));
    assert.equal(event?.type, 'error');
    assert.equal(event?.code, 'stream_broken');
    assert.equal(event?.message, 'Forbindelsen til backend ble brutt.');
  });

  test("the agent's own words are passed on, one event per agent/thinking", async () => {
    const events = await eventsFrom(recorded);
    const thinking = events.filter((e) => e.type === 'thinking');
    assert.ok(thinking.length > 0, 'the recorded stream has agent/thinking frames');
    for (const event of thinking) {
      assert.equal(typeof event.reasoning, 'string');
      assert.ok((event.reasoning as string).length > 0);
    }
  });

  test('every tool call becomes its own event, with what the backend said about it', async () => {
    const frame = {
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: {
        _meta: {
          event: 'agent/turn-completed',
          'tool-calls': [
            {
              tool: 'search',
              'duration-ms': 1897,
              'result-summary': 'Search pass 1: found 95 chunks (95 new).',
              args: { queries: ['nkom måloppnåelse', 'oppfølging av måloppnåelse'] },
            },
            {
              tool: 'read_chunks',
              'duration-ms': 167,
              'result-summary': 'Read 4 chunks (6314 chars this call)',
              args: { chunk_ids: ['a', 'b', 'c', 'd'] },
            },
          ],
        },
      },
    };
    const events = await eventsFrom(`data: ${JSON.stringify(frame)}\n\n`);
    const calls = events.filter((e) => e.type === 'tool-call');

    assert.equal(calls.length, 2, 'one event per call, not one per frame');
    assert.deepEqual(calls[0], {
      type: 'tool-call',
      tool: 'search',
      detail: 'Search pass 1: found 95 chunks (95 new).',
      queries: ['nkom måloppnåelse', 'oppfølging av måloppnåelse'],
      durationMs: 1897,
    });
    assert.deepEqual(calls[1], {
      type: 'tool-call',
      tool: 'read_chunks',
      detail: 'Read 4 chunks (6314 chars this call)',
      durationMs: 167,
      chunkCount: 4,
    });
  });

  test('a call with a single query carries it as a list, as the agent ran it', async () => {
    const frame = {
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: {
        _meta: {
          event: 'agent/turn-completed',
          'tool-calls': [{ tool: 'plan_queries', args: { query: 'Ett spørsmål?' } }],
        },
      },
    };
    const [call] = (await eventsFrom(`data: ${JSON.stringify(frame)}\n\n`)).filter(
      (e) => e.type === 'tool-call',
    );
    assert.deepEqual(call, {
      type: 'tool-call',
      tool: 'plan_queries',
      queries: ['Ett spørsmål?'],
    });
  });

  test('only strings are passed on from a call, whatever shape the backend sends', async () => {
    const frame = {
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: {
        _meta: {
          event: 'agent/turn-completed',
          'tool-calls': [
            { tool: 'search', args: { queries: ['ett', 3, { q: 'to' }, null] } },
            { tool: 'search', args: { queries: 'ikke en liste' } },
            { tool: 'plan_queries', args: { query: { text: 'nei' } } },
            { tool: 'read_chunks', args: { chunk_ids: 'abc' }, 'result-summary': { n: 1 } },
          ],
        },
      },
    };
    const calls = (await eventsFrom(`data: ${JSON.stringify(frame)}\n\n`)).filter(
      (e) => e.type === 'tool-call',
    );
    assert.deepEqual(calls, [
      { type: 'tool-call', tool: 'search', queries: ['ett'] },
      { type: 'tool-call', tool: 'search' },
      { type: 'tool-call', tool: 'plan_queries' },
      { type: 'tool-call', tool: 'read_chunks' },
    ]);
  });

  test('a tool-calls payload that is not a list costs nothing', async () => {
    const frame = {
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: { _meta: { event: 'agent/turn-completed', 'tool-calls': 'noe annet' } },
    };
    const events = await eventsFrom(`data: ${JSON.stringify(frame)}\n\n`);
    assert.equal(events.filter((e) => e.type === 'tool-call').length, 0);
  });

  /*
   * genki-test, 12 November 2026: the MCP result for a question about Nkom 2020–2023, trimmed to
   * the fields this server reads. The service cites by document (`citeBy: document`, genki's
   * default), so `[2]` is the second document, the 2022 report, and the result has no `markers`.
   * Read by position, `[2]` was chunk 2, an excerpt from the 2020 report (issue 235).
   */
  const byDocument = JSON.parse(
    readFileSync(
      new URL('../fixtures/genki-mcp-cite-by-document.json', import.meta.url),
      'utf8',
    ),
  ) as {
    result: {
      content: { text: string }[];
      structuredContent: { chunks: { chunk_id: string; doc_num: string }[] } & {
        markers?: unknown;
      };
    };
  };
  const frameOf = (message: unknown) => `data: ${JSON.stringify(message)}\n\n`;

  test('a service that cites by document: the sources name no excerpt for an [n]', async () => {
    const sources = (await eventsFrom(frameOf(byDocument))).find((e) => e.type === 'sources')
      ?.sources as Array<Record<string, unknown>> | undefined;

    assert.equal(sources?.length, 20);
    for (const source of sources ?? []) {
      assert.equal('marker' in source, false);
      assert.equal('markers' in source, false);
    }
    // In genki's order, so the client can number the documents as genki did: by first appearance.
    assert.deepEqual(
      [...new Set(sources?.map((s) => s.docNum))],
      ['8652', '33189', '88648', '370449'],
    );
  });

  /*
   * The same result as genki sends it when the service cites by excerpt (digdir/genki#273,
   * ADR 0052): `structuredContent.markers`, one `{ marker, chunk_id, document }` per marker, in the
   * shape of genki's own contract test. Each source carries the markers that name its chunk.
   */
  test('a service that cites by excerpt: each source carries the markers that name its chunk', async () => {
    const byExcerpt = structuredClone(byDocument);
    byExcerpt.result.content = [
      { text: 'Bevilgning 2020 [1]. Ansatte 2022 [2]. FM 2023 [3].' },
    ];
    byExcerpt.result.structuredContent.markers = [
      { marker: '1', chunk_id: 'a4e3ac6c71e9', document: '8652' },
      { marker: '2', chunk_id: 'd280bbcbd4cc', document: '33189' },
      { marker: '3', chunk_id: '1d1e3aac6044', document: '88648' },
      // Not one of the chunks in the result, so it names nothing here.
      { marker: '4', chunk_id: 'not-in-the-result', document: '1' },
    ];

    const sources = (await eventsFrom(frameOf(byExcerpt))).find((e) => e.type === 'sources')
      ?.sources as Array<{ chunkId?: string; markers?: string[] }> | undefined;

    assert.deepEqual(
      sources?.filter((s) => s.markers).map((s) => [s.chunkId, s.markers]),
      [
        ['a4e3ac6c71e9', ['1']],
        ['d280bbcbd4cc', ['2']],
        ['1d1e3aac6044', ['3']],
      ],
    );
  });

  test('a marker that is not a marker is skipped, and the rest still name their chunks', async () => {
    const byExcerpt = structuredClone(byDocument);
    byExcerpt.result.structuredContent.markers = [
      'nonsense',
      { marker: 1, chunk_id: 'a4e3ac6c71e9' },
      { marker: '2' },
      { marker: '3', chunk_id: 'ec6a4f5547cb' },
      { marker: '3', chunk_id: 'ec6a4f5547cb' },
    ];

    const sources = (await eventsFrom(frameOf(byExcerpt))).find((e) => e.type === 'sources')
      ?.sources as Array<{ chunkId?: string; markers?: string[] }> | undefined;

    assert.deepEqual(
      sources?.filter((s) => s.markers).map((s) => [s.chunkId, s.markers]),
      [
        ['ec6a4f5547cb', ['3']],
        ['a4e3ac6c71e9', ['1']],
      ],
    );
  });

  test('a delta or a reasoning that is not a string costs nothing, and the answer comes', async () => {
    const frame = (msg: object) => `data: ${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n\n`;
    const progress = (meta: object) =>
      frame({ method: 'notifications/progress', params: { _meta: meta } });
    const body =
      progress({ event: 'agent/thinking', reasoning: { text: 'nei' } }) +
      progress({ event: 'response/chunk', delta: 5 }) +
      progress({ event: 'agent/finalized' }) +
      frame({ id: 1, result: { content: [{ type: 'text', text: 'Svaret.' }] } });
    const sent = await eventsFrom(body);
    assert.deepEqual(
      sent.filter((e) => e.type === 'thinking' || e.type === 'error'),
      [],
    );
    assert.equal(
      sent
        .filter((e) => e.type === 'delta')
        .map((e) => e.text)
        .join(''),
      'Svaret.',
    );
  });

  test('a blank chunk is not an answer, and does not hide the one in the result', async () => {
    // headless-rag sends no agent/thinking for blank content
    // (agent/iteration_bundled.clj), so nothing drops a chunk of "\n\n".
    const frame = (msg: object) => `data: ${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n\n`;
    const progress = (meta: object) =>
      frame({ method: 'notifications/progress', params: { _meta: meta } });
    const body =
      progress({ event: 'response/chunk', delta: '\n\n' }) +
      progress({ event: 'agent/finalized' }) +
      frame({ id: 1, result: { content: [{ type: 'text', text: 'Svaret [1].' }] } });
    assert.equal((await deltas(body)).trim(), 'Svaret [1].');
  });

  test('deltas no agent/thinking claims are answer text, and are not doubled', async () => {
    const streamed = recorded
      .split('\n\n')
      .filter((frame) => !frame.includes('"agent/thinking"'))
      .join('\n\n');
    const plan = mcp
      .takeFrames(recorded)
      .frames.map(mcp.frameData)
      .filter((m) => m?.params?._meta?.event === 'response/chunk')
      .map((m) => m!.params._meta.delta)
      .join('');
    assert.equal(await deltas(streamed), plan);
  });
});
