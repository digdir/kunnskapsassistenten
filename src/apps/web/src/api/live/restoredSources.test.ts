import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamEvent } from '../../model';
import { LiveChatClient, resetLiveConversation } from './LiveChatClient';
import { SOURCES_STORAGE_KEY, answerFingerprint, recallThread } from './sourceStore';

/**
 * The excerpts' text, and the sources after a reload, in live
 * (docs/arkitektur/0005).
 *
 * A fake backend and a fake /api/excerpts. The answer and its chunks are
 * shaped after a real one from :8080 on 30.09: the chunks carry id, document
 * number, title and headings but no text, and the conversation read back has
 * `chunks: []` on every message.
 */
const ANSWER = 'Nkom rapporterer om måloppnåelse [1] og om ressursbruk [3].';

const CHUNKS = [
  {
    chunk_id: 'c1',
    doc_num: '33189',
    title: 'Årsrapport Nkom 2022',
    metadata: '{"Header 1" "II"}',
  },
  { chunk_id: 'c2', doc_num: '33189', title: 'Årsrapport Nkom 2022' },
  { chunk_id: 'c3', doc_num: '32062', title: 'Tildelingsbrev Digdir 2023' },
];

type Backend = {
  /** `_meta` of each progress frame sent before the final one. */
  progress: Record<string, unknown>[];
  /** What `/api/excerpts` answers with. */
  excerpts: { status: number; body: unknown };
  /** Holds `/api/excerpts` until it settles, when set. */
  excerptsHeld?: Promise<void>;
  /** The assistant message the backend gives back when the thread is read. */
  storedAnswer: { text: string; chunks: unknown[] };
};

let backend: Backend;
let fetchMock: ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  localStorage.clear();
  resetLiveConversation();
  backend = {
    excerpts: {
      status: 200,
      body: { excerpts: { c1: 'Nkom nådde målene.', c3: 'Midlene ble brukt.' } },
    },
    storedAnswer: { text: ANSWER, chunks: [] },
    progress: [],
  };
  fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith('/api/conversations') && init?.method === 'POST') {
      return json({ conversation: { id: 'conv-1' } });
    }
    if (path.endsWith('/api/mcp')) {
      const frame = {
        result: {
          content: [{ type: 'text', text: ANSWER }],
          structuredContent: { chunks: CHUNKS, conversation_id: 'conv-1' },
          _meta: { conversation_id: 'conv-1', status: 'complete' },
        },
      };
      const progress = backend.progress.map((meta) => ({
        method: 'notifications/progress',
        params: { _meta: meta },
      }));
      const body = [...progress, frame].map((item) => `data: ${JSON.stringify(item)}\n\n`).join('');
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }
    if (path.startsWith('/api/excerpts?')) {
      await backend.excerptsHeld;
      return json(backend.excerpts.body, backend.excerpts.status);
    }
    if (path.endsWith('/api/conversations/conv-1')) {
      return json({
        conversation: { id: 'conv-1', topic: 'Nkom', tags: ['corpus:kudos-full'], created: 1 },
        messages: [
          { id: 'm0', role: 'system', text: 'You are a helpful assistant.', chunks: [] },
          { id: 'm1', role: 'user', text: 'Hva sier Nkom om måloppnåelse?', chunks: [] },
          { id: 'm2', role: 'assistant', created: 2, ...backend.storedAnswer },
        ],
      });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const client = () => new LiveChatClient({ tenant: 'kudos', datasetConfigKey: 'kudos-full' });

async function ask(): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of client().ask({ query: 'Hva sier Nkom om måloppnåelse?' })) {
    events.push(event);
  }
  return events;
}

function sourcesOf(events: StreamEvent[]) {
  const frame = events.find((event) => event.type === 'sources');
  if (frame?.type !== 'sources') throw new Error('Ingen kilder i strømmen.');
  return frame.documents;
}

const excerptCalls = () =>
  fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.startsWith('/api/excerpts?'));

describe('teksten i utdragene i et nytt svar', () => {
  it('slår opp teksten til bitene og fyller den inn', async () => {
    const documents = sourcesOf(await ask());

    expect(excerptCalls()).toEqual(['/api/excerpts?dataset=kudos-full&ids=c1%2Cc2%2Cc3']);
    expect(documents.map((document) => document.id)).toEqual(['33189', '32062']);
    expect(documents[0]?.excerpts.map((excerpt) => [excerpt.id, excerpt.text])).toEqual([
      ['c1', 'Nkom nådde målene.'],
      ['c2', ''],
    ]);
    expect(documents[1]?.excerpts[0]?.text).toBe('Midlene ble brukt.');
  });

  it('sier fra om en bit som ikke ble funnet', async () => {
    const [nkom] = sourcesOf(await ask());

    expect(nkom?.excerpts[0]?.textUnavailable).toBeUndefined();
    expect(nkom?.excerpts[1]?.textUnavailable).toBe(true);
  });

  it('gir svaret og kildene også når oppslaget feiler, og sier at teksten mangler', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    backend.excerpts = { status: 502, body: { error: 'Fikk ikke hentet utdragene.' } };

    const events = await ask();

    expect(events.at(-1)?.type).toBe('done');
    const excerpts = sourcesOf(events).flatMap((document) => document.excerpts);
    expect(excerpts.map((excerpt) => excerpt.textUnavailable)).toEqual([true, true, true]);
    // The numbers the answer's markers point at are untouched.
    expect(excerpts.map((excerpt) => excerpt.citationNumber)).toEqual([1, 2, 3]);
  });

  it('sender svarteksten før kildene, så leseren ikke venter på oppslaget', async () => {
    const types = (await ask()).map((event) => event.type);

    expect(types.indexOf('token')).toBeLessThan(types.indexOf('sources'));
  });
});

describe('kildene etter ny innlasting', () => {
  it('skriver ned bitene under samtalen, uten tekst fra dokumentene', async () => {
    await ask();

    const raw = localStorage.getItem(SOURCES_STORAGE_KEY) ?? '';
    expect(Object.keys(JSON.parse(raw).threads)).toEqual(['conv-1']);
    expect(raw).toContain('"chunk_id":"c3"');
    expect(raw).not.toContain('Nkom nådde målene');
  });

  it('gir tråden kildene tilbake, med teksten slått opp på nytt', async () => {
    await ask();
    fetchMock.mockClear();

    const thread = await client().getThread('conv-1');
    const answer = thread?.messages.find((message) => message.role === 'assistant');

    expect(answer?.sources?.map((document) => document.title)).toEqual([
      'Årsrapport Nkom 2022',
      'Tildelingsbrev Digdir 2023',
    ]);
    expect(answer?.sources?.[0]?.excerpts[0]).toMatchObject({
      id: 'c1',
      text: 'Nkom nådde målene.',
      heading: 'II',
      citationNumber: 1,
    });
    expect(answer?.sources?.[0]?.excerpts[1]?.textUnavailable).toBe(true);
    expect(answer?.citations?.map((citation) => citation.number)).toEqual([1, 2, 3]);
    expect(excerptCalls()).toEqual(['/api/excerpts?dataset=kudos-full&ids=c1%2Cc2%2Cc3']);
  });

  it('gir ingen kilder til et svar med en annen tekst enn den som ble skrevet ned', async () => {
    await ask();
    backend.storedAnswer = { text: 'Et annet svar.', chunks: [] };
    fetchMock.mockClear();

    const thread = await client().getThread('conv-1');

    expect(
      thread?.messages.find((message) => message.role === 'assistant')?.sources,
    ).toBeUndefined();
    expect(excerptCalls()).toEqual([]);
  });

  it('lar backendens egne biter vinne, den dagen den har dem', async () => {
    await ask();
    backend.storedAnswer = {
      text: ANSWER,
      chunks: [{ chunkId: 'b1', docTitle: 'Fra backend', docNum: '1', contentMarkdown: 'Lagret.' }],
    };
    fetchMock.mockClear();

    const thread = await client().getThread('conv-1');
    const answer = thread?.messages.find((message) => message.role === 'assistant');

    expect(answer?.sources?.[0]?.title).toBe('Fra backend');
    expect(answer?.sources?.[0]?.excerpts[0]?.text).toBe('Lagret.');
    expect(excerptCalls()).toEqual([]);
  });

  it('er som før for en tråd denne nettleseren ikke har skrevet ned noe for', async () => {
    const thread = await client().getThread('conv-1');

    expect(
      thread?.messages.find((message) => message.role === 'assistant')?.sources,
    ).toBeUndefined();
    expect(excerptCalls()).toEqual([]);
  });
});

describe('Fremgangsmåte etter ny innlasting', () => {
  it('gir svaret stegene, treffene og tenketiden tilbake', async () => {
    backend.progress = [
      { event: 'agent/thinking', reasoning: 'Jeg leter i årsrapporten til Nkom.' },
      {
        event: 'agent/turn-completed',
        'tool-calls': [
          { tool: 'search', args: { queries: ['Nkom måloppnåelse 2022'] }, 'duration-ms': 41 },
        ],
      },
      { event: 'agent/finalized', iteration: 2 },
    ];
    const shown = (await ask()).flatMap((event) =>
      event.type === 'thinking-step' ? [event.step] : [],
    );

    const thread = await client().getThread('conv-1');
    const answer = thread?.messages.find((message) => message.role === 'assistant');

    expect(shown).toHaveLength(3);
    expect(answer?.thinkingSteps).toEqual(shown);
    expect(answer?.retrieval).toEqual({
      hitCount: 3,
      documentCount: 2,
      keywords: ['Nkom måloppnåelse 2022'],
    });
    expect(answer?.thoughtMs).toBeGreaterThanOrEqual(0);
  });

  it('husker under teksten i siste ramme, ikke den som ble strømmet', async () => {
    // Deltas that nothing proves were the plan are released as the answer, so
    // the streamed text is «Et utkast.» and the final frame's is ANSWER. The
    // backend stores the final frame's (measured 30.09 and on #227).
    backend.progress = [{ event: 'response/chunk', delta: 'Et utkast.' }];

    await ask();

    const remembered = recallThread('conv-1');
    expect(remembered?.has(answerFingerprint(ANSWER))).toBe(true);
    expect(remembered?.has(answerFingerprint('Et utkast.'))).toBe(false);
  });

  it('skriver ned svaret før teksten er hentet, så en ny innlasting midt i oppslaget ikke mister det', async () => {
    let release = () => {};
    backend.excerptsHeld = new Promise<void>((resolve) => {
      release = resolve;
    });

    const asking = ask();
    await vi.waitFor(() => expect(excerptCalls()).toHaveLength(1));

    expect(recallThread('conv-1')?.has(answerFingerprint(ANSWER))).toBe(true);
    release();
    await asking;
  });
});
