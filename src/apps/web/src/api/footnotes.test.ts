import { afterEach, describe, expect, it, vi } from 'vitest';
import { citationTargets, excerptDomId, type SourceDocument, type StreamEvent } from '../model';
import type { BffSource } from './bff/contract';
import { BffTurnState, threadDetailFromBff } from './bff/mapping';
import { citeAnswer } from './excerptCitations';
import genkiResult from './fixtures/genki-mcp-cite-by-document.json';
import storedThread from './fixtures/genki-stored-thread-cite-by-document.json';
import { threadDetailFrom } from './live/conversations';
import { LiveChatClient } from './live/LiveChatClient';
import { toSourceDocuments, type McpChunk } from './live/mcp';

/*
 * Issue 235: footnotes pointed at the wrong excerpt.
 *
 * The fixtures are one answer from genki-test (12 November 2026, «Hvordan har Nkom brukt
 * ressursene sine i årene 2020–2023?»), trimmed to the fields the client reads: the MCP result
 * and the same answer read back from the conversation store. The service cites by document,
 * genki's default: `[1]` is the 2020 report, `[2]` the 2022 report and `[3]` the 2023 report,
 * and the result has no `markers`. Read as «the n-th chunk», `[2]` showed an excerpt from the
 * 2020 report under a sentence about 2022.
 */
const answerText = genkiResult.result.content[0]!.text;
const chunks = genkiResult.result.structuredContent.chunks as McpChunk[];

const REPORT_2020 = '8652';
const REPORT_2022 = '33189';
const REPORT_2023 = '88648';
const TITLE = 'Årsrapport Nasjonal kommunikasjonsmyndighet';

/** The chunks as the BFF sends them: one source per chunk, in genki's order. */
const bffSources: BffSource[] = chunks.map((chunk) => ({
  docNum: chunk.doc_num ?? '',
  title: chunk.title ?? '',
  url: chunk.url ?? '',
  chunkId: chunk.chunk_id,
}));

/** What each `[n]` in the answer leads to, without the parts that differ between paths. */
function footnotes(documents: SourceDocument[]) {
  return citationTargets(documents).map(({ number, targetId, label, documentId }) => ({
    number,
    targetId,
    label,
    documentId,
  }));
}

/** The footnotes a service citing by document must give for this answer. */
const byDocument = [
  [1, REPORT_2020, `Kilde 1: ${TITLE} 2020`],
  [2, REPORT_2022, `Kilde 2: ${TITLE} 2022`],
  [3, REPORT_2023, `Kilde 3: ${TITLE} 2023`],
  [4, '370449', `Kilde 4: ${TITLE} 2024`],
].map(([number, documentId, label]) => ({
  number,
  targetId: `kilde-dokument-${documentId}-tittel`,
  label,
  documentId,
}));

function bffLive(text: string, sources: BffSource[]) {
  const state = new BffTurnState();
  state.read({ type: 'delta', text });
  state.read({ type: 'sources', sources });
  const events = state.read({ type: 'done', conversationId: 'c1', insufficient: false });
  const event = events.find((e) => e.type === 'sources');
  if (event?.type !== 'sources') throw new Error('no sources event');
  return event;
}

function bffReload(text: string, sources: BffSource[]) {
  const thread = threadDetailFromBff({
    conversation: { id: 'c1', topic: 'Nkom', created: 1 },
    messages: [
      { id: 'm1', role: 'user', text: 'Nkom', created: 1 },
      { id: 'm2', role: 'assistant', text, created: 2 },
    ],
    sources,
  });
  return thread.messages[1]!;
}

async function liveAnswer(result: unknown): Promise<StreamEvent[]> {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(`data: ${JSON.stringify(result)}\n\n`, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    ),
  );
  const events: StreamEvent[] = [];
  for await (const event of new LiveChatClient().ask({ query: 'Nkom' })) events.push(event);
  return events;
}

describe('issue 235: a service that cites by document', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('resolves [n] to document n, by first appearance, as genki numbered them', () => {
    const cited = citeAnswer(answerText, toSourceDocuments(chunks), undefined);

    expect(footnotes(cited.documents)).toEqual(byDocument);
    // The answer is not rewritten: its `[n]` already are the documents' numbers.
    expect(cited.content).toBe(answerText);
  });

  it('gives no excerpt a footnote number, since the answer does not say which one it used', () => {
    const cited = citeAnswer(answerText, toSourceDocuments(chunks), undefined);

    expect(cited.documents.flatMap((d) => d.excerpts).map((e) => e.citationNumber)).toEqual(
      new Array(chunks.length).fill(undefined),
    );
    expect(footnotes(cited.documents).some((f) => f.targetId.startsWith('excerpt-'))).toBe(false);
  });

  it('BFF: [2] under the 2022 sentence leads to the 2022 report, not to an excerpt of 2020', () => {
    const event = bffLive(answerText, bffSources);

    expect(footnotes(event.documents)).toEqual(byDocument);
    expect(event.citations.find((c) => c.number === 2)).toMatchObject({
      documentId: REPORT_2022,
    });
  });

  it('BFF: a reloaded answer has the same footnotes as the live one', () => {
    const live = bffLive(answerText, bffSources);
    const reloaded = bffReload(answerText, bffSources);

    expect(reloaded.sources).toEqual(live.documents);
    expect(reloaded.citations).toEqual(live.citations);
    expect(reloaded.content).toBe(answerText);
  });

  it('live MCP: [2] leads to the 2022 report', async () => {
    const events = await liveAnswer(genkiResult);
    const sources = events.find((e) => e.type === 'sources');
    if (sources?.type !== 'sources') throw new Error('no sources event');

    expect(footnotes(sources.documents)).toEqual(byDocument);
  });

  it('live MCP: the stored thread, read back, has the same footnotes as the live answer', async () => {
    const events = await liveAnswer(genkiResult);
    const sources = events.find((e) => e.type === 'sources');
    if (sources?.type !== 'sources') throw new Error('no sources event');

    const thread = threadDetailFrom(storedThread.conversation, storedThread.messages);
    const answer = thread.messages.find((message) => message.role === 'assistant')!;

    expect(footnotes(answer.sources ?? [])).toEqual(footnotes(sources.documents));
    expect(answer.citations).toEqual(sources.citations);
  });
});

/*
 * The same answer as genki sends it when the service cites by excerpt (digdir/genki#273, ADR
 * 0052): every `[n]` is one excerpt, and the result says which in `markers`. The markers here are
 * in the shape of genki's own contract test, on the chunks that hold the facts.
 */
describe('issue 235: a service that cites by excerpt', () => {
  const text = 'Bevilgning 2020 [1]. Ansatte 2022 [2]. FM 2023 [3]. Igjen 2022 [2].';
  const markers = [
    { marker: '1', chunk_id: 'a4e3ac6c71e9', document: REPORT_2020 },
    { marker: '2', chunk_id: 'd280bbcbd4cc', document: REPORT_2022 },
    { marker: '3', chunk_id: '1d1e3aac6044', document: REPORT_2023 },
  ];
  const withMarkers = bffSources.map((source) => {
    const named = markers.filter((m) => m.chunk_id === source.chunkId).map((m) => m.marker);
    return named.length ? { ...source, markers: named } : source;
  });

  /** Footnote number → the chunk its excerpt is. */
  function excerptOf(documents: SourceDocument[]) {
    return Object.fromEntries(
      documents.flatMap((document) =>
        document.excerpts
          .filter((excerpt) => excerpt.citationNumber !== undefined)
          .map((excerpt) => [excerpt.citationNumber, excerpt.id]),
      ),
    );
  }
  const expected = { 1: 'a4e3ac6c71e9', 2: 'd280bbcbd4cc', 3: '1d1e3aac6044' };

  afterEach(() => vi.unstubAllGlobals());

  it('BFF: each [n] resolves to the excerpt the marker names', () => {
    const event = bffLive(text, withMarkers);

    expect(excerptOf(event.documents)).toEqual(expected);
    expect(citationTargets(event.documents).map((t) => t.targetId)).toEqual([
      excerptDomId(1),
      excerptDomId(2),
      excerptDomId(3),
    ]);
    // Only the cited excerpts are shown, as in live mode.
    expect(event.documents.flatMap((d) => d.excerpts)).toHaveLength(3);
  });

  it('BFF: a reloaded answer has the same footnotes and text as the live one', () => {
    const live = bffLive(text, withMarkers);
    const reloaded = bffReload(text, withMarkers);

    expect(reloaded.sources).toEqual(live.documents);
    expect(reloaded.citations).toEqual(live.citations);
    expect(reloaded.content).toBe(live.content ?? text);
  });

  it('BFF: markers are renumbered in the order the answer first cites them, as in live mode', () => {
    const event = bffLive('FM [3] og ansatte [2].', withMarkers);

    expect(event.content).toBe('FM [1] og ansatte [2].');
    expect(excerptOf(event.documents)).toEqual({ 1: '1d1e3aac6044', 2: 'd280bbcbd4cc' });
  });

  it('live MCP: each [n] resolves to the excerpt the marker names', async () => {
    const result = structuredClone(genkiResult) as typeof genkiResult & {
      result: { structuredContent: { markers?: unknown } };
    };
    result.result.content = [{ type: 'text', text }];
    result.result.structuredContent.markers = markers;

    const events = await liveAnswer(result);
    const sources = events.find((e) => e.type === 'sources');
    if (sources?.type !== 'sources') throw new Error('no sources event');

    expect(excerptOf(sources.documents)).toEqual(expected);
  });
});
