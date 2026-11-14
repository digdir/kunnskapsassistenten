import type { StreamEvent } from '@genai/client';
import { HttpError, type AssistantApi } from '@genai/ui-assembly';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { genkiApi, withSignIn } from './api';
import { drawingFor } from './App';
import type { Me } from './session';

const failing = (status: number): AssistantApi => {
  const fail = async () => {
    throw new HttpError(status, `${status}`);
  };
  return {
    loadModels: fail,
    loadThreads: fail,
    loadThread: fail,
    loadCorpora: fail,
    loadFields: fail,
    loadFacets: fail,
    loadAbout: fail,
    ask: async function* () {
      yield* [];
      throw new HttpError(status, `${status}`);
    },
  };
};

describe('a call refused with 401', () => {
  it('goes to the sign-in when the session is gone', async () => {
    const signIn = vi.fn();
    const api = withSignIn(failing(401), signIn, async () => true);
    await expect(api.loadThreads()).rejects.toThrow('401');
    expect(signIn).toHaveBeenCalledOnce();
  });

  it('also from a question', async () => {
    const signIn = vi.fn();
    const api = withSignIn(failing(401), signIn, async () => true);
    const asking = api.ask({
      question: 'x',
      model: 'kunnskapsassistenten__default',
      steps: false,
      signal: new AbortController().signal,
    });
    await expect(asking.next()).rejects.toThrow('401');
    expect(signIn).toHaveBeenCalledOnce();
  });

  it("stays, with genki's refusal shown, while the session holds", async () => {
    const signIn = vi.fn();
    const api = withSignIn(failing(401), signIn, async () => false);
    await expect(api.loadModels()).rejects.toThrow('401');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('another failure never leads to the sign-in', async () => {
    const signIn = vi.fn();
    const gone = vi.fn(async () => true);
    await expect(withSignIn(failing(502), signIn, gone).loadCorpora()).rejects.toThrow('502');
    expect(gone).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });
});

// KA's service cites by document, so its answers carry no excerpt markers and read as before.
describe('an answer from a service that cites documents', () => {
  const json = (body: unknown) => Response.json(body);
  const stream = (...frames: unknown[]) =>
    new Response(
      frames.map((f) => `data: ${typeof f === 'string' ? f : JSON.stringify(f)}\n\n`).join(''),
      { headers: { 'content-type': 'text/event-stream', 'genai-task': 'task-1' } },
    );
  const byDocument = { index: 1, title: 'Årsrapport 2023', document_id: '42' };

  afterEach(() => vi.unstubAllGlobals());

  it('has no excerpt markers, its sources by document, and its run', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/api/conversations')
          ? json({ conversation: { id: 't1' } })
          : stream(
              { id: 'a1', choices: [{ delta: { content: 'Ventetiden gikk ned [1].' } }] },
              { id: 'a1', sources: [byDocument], citations: [] },
              '[DONE]',
            ),
      ),
    );
    const events: StreamEvent[] = [];
    for await (const event of genkiApi('digdir', {}).ask({
      question: 'Ventetid?',
      model: 'kunnskapsassistenten__default',
      steps: false,
      signal: new AbortController().signal,
    }))
      events.push(event);
    const done = events.find((e) => e.type === 'done');
    expect(done?.type).toBe('done');
    if (done?.type !== 'done') return;
    expect(done.answer.text).toBe('Ventetiden gikk ned [1].');
    expect(done.answer.markers).toBeUndefined();
    expect(done.answer.sources.map((s) => s.title)).toEqual(['Årsrapport 2023']);
    const sources = events.find((e) => e.type === 'sources');
    expect(sources?.type === 'sources' && sources.markers).toBeFalsy();
  });

  it('opened again, it has no excerpt markers either', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          conversation: { id: 't1', topic: 'Ventetid', tags: [], created: 1 },
          messages: [
            { id: 'q', role: 'user', text: 'Ventetid?', created: 1, chunks: [] },
            {
              id: 'a',
              role: 'assistant',
              text: 'Ventetiden gikk ned [1].',
              created: 2,
              chunks: [],
              sources: [byDocument],
              task: 'task-1',
            },
          ],
        }),
      ),
    );
    const { turns } = await genkiApi('digdir', {}).loadThread('t1');
    expect(turns[0]?.answer?.markers).toBeUndefined();
    expect(turns[0]?.answer?.sources?.map((s) => s.title)).toEqual(['Årsrapport 2023']);
    expect(turns[0]?.answer?.runId).toBe('task-1');
  });
});

// A thread asked in apps/web names no collection: KA's profile describes only Kudos, so its
// documents link there.
describe('a stored thread that names no collection', () => {
  const me: Me = {
    name: 'Testperson',
    signOut: '/auth/logout',
    model: 'kunnskapsassistenten__default',
    service: 'kunnskapsassistenten',
    tenant: 'digdir',
    writes: false,
  };
  const thread = (tags: string[]) =>
    Response.json({
      conversation: { id: 't1', topic: 'Ventetid', tags, created: 1 },
      messages: [
        { id: 'q', role: 'user', text: 'Ventetid?', created: 1, chunks: [] },
        {
          id: 'a',
          role: 'assistant',
          text: 'Ventetiden gikk ned [1].',
          created: 2,
          chunks: [],
          sources: [
            { index: 1, title: 'Årsrapport 2023', document_id: '42' },
            {
              index: 2,
              title: 'Tildelingsbrev 2024',
              document_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
            },
          ],
          task: 'task-1',
        },
      ],
    });
  const linksOf = async (tags: string[]) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => thread(tags)),
    );
    // The profile the page gives genki's calls.
    const { turns } = await genkiApi(me.tenant, drawingFor(me, undefined).profile).loadThread(
      't1',
    );
    return turns[0]?.answer?.sources?.map((source) => source.url);
  };

  afterEach(() => vi.unstubAllGlobals());

  it('links its documents to Kudos, as a thread that names Kudos does', async () => {
    const kudos = [
      'https://kudos.dfo.no/documents/42',
      'https://kudos.dfo.no/dokument/0f8fad5b-d9cb-469f-a165-70867728950e',
    ];
    expect(await linksOf([])).toEqual(kudos);
    expect(await linksOf(['corpus:kudos'])).toEqual(kudos);
  });

  it('links nothing in a collection KA does not describe', async () => {
    expect(await linksOf(['corpus:annen'])).toEqual([undefined, undefined]);
  });
});
