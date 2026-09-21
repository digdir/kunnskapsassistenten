import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, describe, test } from 'node:test';

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
  test('collapses many chunks of one document into a single source', async () => {
    const sources = await mcp.toSources(
      [
        { chunk_id: 'a', doc_num: '1', title: 'Rapport' },
        { chunk_id: 'b', doc_num: '1', title: 'Rapport' },
        { chunk_id: 'c', doc_num: '2', title: 'Annen' },
      ],
      noExcerpts,
    );
    assert.equal(sources.length, 2);
    assert.deepEqual(
      sources.map((s) => s.marker),
      [1, 2],
    );
  });

  test('markers are 1-based and follow retrieval order', async () => {
    const sources = await mcp.toSources(
      [
        { doc_num: '9', title: 'Ni' },
        { doc_num: '4', title: 'Fire' },
      ],
      noExcerpts,
    );
    assert.deepEqual(
      sources.map((s) => [s.docNum, s.marker]),
      [
        ['9', 1],
        ['4', 2],
      ],
    );
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

  test('joins every passage of a document, in retrieval order', async () => {
    const [source] = await mcp.toSources(
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
    assert.equal(source?.excerpt, 'first\n\nsecond');
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

  test('skips chunks with neither doc_num nor url', async () => {
    const sources = await mcp.toSources([{ chunk_id: 'orphan' }], noExcerpts);
    assert.deepEqual(sources, []);
  });

  test('no chunks means no sources', async () => {
    assert.deepEqual(await mcp.toSources(undefined, noExcerpts), []);
    assert.deepEqual(await mcp.toSources([], noExcerpts), []);
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

  test('an ordinary https url is kept', async () => {
    const sources = await mcp.toSources(
      [{ chunk_id: 'c1', doc_num: '42', url: 'https://kudos.dfo.no/documents/42' }],
      async () => new Map(),
    );
    assert.equal(sources[0]?.url, 'https://kudos.dfo.no/documents/42');
  });
});
