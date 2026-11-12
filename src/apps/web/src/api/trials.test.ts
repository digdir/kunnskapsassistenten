import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFlags, setFlag } from '../flags/flags';
import type { Thread } from '../model';
import { BffChatClient, resetBffClient } from './bff/BffChatClient';
import askStream from './bff/fixtures/ask.sse?raw';
import capabilities from './bff/fixtures/capabilities.json';
import conversations from './bff/fixtures/conversations.json';
import facets from './bff/fixtures/facets.json';
import { bffThreadActions, resetThreadActions } from './threadActions';
import { EXCERPT_TRIAL_HEADER, fetchOfferedTrials } from './trials';

const now = new Date().toISOString();
const thread: Thread = {
  id: 'c1',
  conversationId: 'c1',
  title: 'Nkom',
  createdAt: now,
  updatedAt: now,
};

const ROUTES: Record<string, () => Response> = {
  '/api/v2/ask': () =>
    new Response(askStream, { headers: { 'Content-Type': 'text/event-stream' } }),
  '/api/v2/capabilities': () => Response.json(capabilities),
  '/api/v2/facets': () => Response.json(facets),
  '/api/v2/conversations': () => Response.json(conversations),
};

/** A BFF on `fetch` that answers every call. */
function fakeBff() {
  const fetchMock = vi.fn<typeof fetch>(async (url) =>
    (ROUTES[String(url)] ?? (() => Response.json({ ok: true })))(),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Asks, lists, renames and deletes, and gives the trial header of every call. */
async function everyCall(): Promise<Array<string | null>> {
  const fetchMock = fakeBff();
  const client = new BffChatClient({ settleDelaysMs: [0] });
  for await (const event of client.ask({ query: 'Hva skriver DFØ?' })) void event;
  await client.listThreads();
  await bffThreadActions().rename(thread, 'Nkom 2024');
  await bffThreadActions().remove(thread);
  expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(
    expect.arrayContaining(['/api/v2/ask', '/api/v2/conversations', '/api/v2/conversations/c1']),
  );
  return fetchMock.mock.calls.map(([, init]) =>
    new Headers(init?.headers).get(EXCERPT_TRIAL_HEADER),
  );
}

beforeEach(() => {
  localStorage.clear();
  forgetFlags();
  resetBffClient();
  resetThreadActions();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('the excerpt trial on the wire', () => {
  it('sends KA-Trial-Excerpt-Citations: 1 with every call to the BFF while the flag is on, and nothing once it is off', async () => {
    setFlag('excerpt-citations', true);
    const on = await everyCall();
    expect(on.length).toBeGreaterThan(3);
    expect(on.filter((value) => value !== '1')).toEqual([]);

    setFlag('excerpt-citations', false);
    resetBffClient();
    expect((await everyCall()).filter((value) => value !== null)).toEqual([]);
  });

  it('never names a genki environment, only that the trial is on', async () => {
    setFlag('excerpt-citations', true);
    const fetchMock = fakeBff();
    await new BffChatClient().listThreads();

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.has('GenAI-Environment')).toBe(false);
    expect(headers.get(EXCERPT_TRIAL_HEADER)).toBe('1');
  });
});

describe('fetchOfferedTrials', () => {
  beforeEach(() => vi.stubEnv('VITE_API_MODE', 'bff'));

  it('offers the excerpt trial when /api/me says the server has it', async () => {
    const me = vi.fn<typeof fetch>(async () => Response.json({ excerptTrial: true }));
    vi.stubGlobal('fetch', me);

    expect(await fetchOfferedTrials()).toEqual(['excerpt-citations']);
    expect(me.mock.calls[0]?.[0]).toBe('/api/v2/me');
  });

  it('offers nothing when /api/me does not say so, or fails', async () => {
    const me = vi.fn<typeof fetch>(async () => Response.json({ authEnabled: true }));
    vi.stubGlobal('fetch', me);
    expect(await fetchOfferedTrials()).toEqual([]);

    me.mockImplementation(async () => Response.json({ excerptTrial: 'test' }));
    expect(await fetchOfferedTrials()).toEqual([]);

    me.mockImplementation(async () => new Response('', { status: 502 }));
    expect(await fetchOfferedTrials()).toEqual([]);

    me.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await fetchOfferedTrials()).toEqual([]);
  });

  it('does not ask anywhere but behind the BFF', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock');
    const me = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', me);

    expect(await fetchOfferedTrials()).toEqual([]);
    expect(me).not.toHaveBeenCalled();
  });
});
