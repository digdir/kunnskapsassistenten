import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Thread } from '../model';
import { mockThreadDetail, mockThreadList, resetMockThreads } from './mock/sessionThreads';
import { provideDraft, resetDraftSources } from './session';
import {
  bffThreadActions,
  createThreadActions,
  renamedThreads,
  resetThreadActions,
  resetThreadRenames,
  subscribeToThreadRenames,
} from './threadActions';

const now = new Date().toISOString();
const thread: Thread = {
  id: 'conv-1',
  conversationId: 'conv-1',
  title: 'Måloppnåelse i Nkom',
  createdAt: now,
  updatedAt: now,
};

describe('the BFF’s rename and delete', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    resetThreadActions();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renames with PUT and the title in the body', async () => {
    await bffThreadActions().rename(thread, 'Nkom 2024');

    const [path, init] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe('/api/conversations/conv-1');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ title: 'Nkom 2024' });
  });

  it('deletes with DELETE', async () => {
    await bffThreadActions().remove(thread);

    const [path, init] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe('/api/conversations/conv-1');
    expect(init?.method).toBe('DELETE');
  });

  it('names the conversation safely in the path', async () => {
    await bffThreadActions().remove({ ...thread, conversationId: 'a/b?c' });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/conversations/a%2Fb%3Fc');
  });

  it('fails when the BFF says no, so the list can take the change back', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":"Kunne ikke endre navn."}', { status: 502 }),
    );

    await expect(bffThreadActions().rename(thread, 'Nkom 2024')).rejects.toThrow('502');
  });

  it('goes to the sign-in when the session has run out', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      pathname: '/threads/conv-1',
      search: '',
      assign,
    });
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));

    await expect(bffThreadActions().remove(thread)).rejects.toThrow('401');
    expect(assign).toHaveBeenCalledWith('/auth/login?next=%2Fthreads%2Fconv-1');
  });

  it('keeps what is in the compose field before it goes to the sign-in', async () => {
    sessionStorage.clear();
    resetDraftSources();
    let atRedirect: string | null = null;
    vi.stubGlobal('location', {
      ...window.location,
      pathname: '/threads/conv-1',
      search: '',
      assign: () => {
        atRedirect = sessionStorage.getItem('ka.draft.v1');
      },
    });
    const gone = provideDraft(() => 'Et spørsmål under arbeid');
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));

    await expect(bffThreadActions().rename(thread, 'Nkom 2024')).rejects.toThrow('401');
    gone();

    expect(JSON.parse(atRedirect ?? 'null')).toEqual({
      text: 'Et spørsmål under arbeid',
      path: '/threads/conv-1',
    });
  });
});

describe('the mock’s rename and delete', () => {
  beforeEach(() => {
    resetMockThreads();
    vi.stubEnv('VITE_API_MODE', 'mock');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps a new name for a thread it did not make, in the list and when opened', async () => {
    await createThreadActions()?.rename(thread, 'Nkom 2024');

    expect(mockThreadList([thread]).map((row) => row.title)).toEqual(['Nkom 2024']);
    expect(mockThreadDetail(thread.id, { ...thread, messages: [] })?.title).toBe('Nkom 2024');
  });

  it('forgets a deleted thread, in the list and when opened', async () => {
    const other = { ...thread, id: 'conv-2', conversationId: 'conv-2', title: 'Årsrapport' };
    await createThreadActions()?.remove(thread);

    expect(mockThreadList([thread, other]).map((row) => row.id)).toEqual(['conv-2']);
    expect(mockThreadDetail(thread.id, { ...thread, messages: [] })).toBeNull();
  });
});

describe('which actions a deployment has', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('has none in live, whose backend has no call for either', () => {
    vi.stubEnv('VITE_API_MODE', 'live');

    expect(createThreadActions()).toBeUndefined();
  });

  it('has both in bff and in mock', () => {
    vi.stubEnv('VITE_API_MODE', 'bff');
    expect(createThreadActions()).toBeDefined();

    vi.stubEnv('VITE_API_MODE', 'mock');
    expect(createThreadActions()).toBeDefined();
  });
});

/**
 * Renaming the open thread left the heading in the main column on the old name
 * until the next load, because it is drawn off the thread `ChatSlotView` read
 * and the list only updates its own rows. Measured 2026-09-29 in mock.
 */
describe('a new name is published to whoever is listening', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    resetThreadActions();
    resetThreadRenames();
    resetMockThreads();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('gir det nye navnet til lytterne, med tråd-id-en', async () => {
    const heard = vi.fn();
    const off = subscribeToThreadRenames(heard);

    await createThreadActions()!.rename(thread, 'Nkom 2024');

    expect(heard).toHaveBeenCalled();
    expect(renamedThreads().get('conv-1')).toEqual({
      title: 'Nkom 2024',
      titleFromQuestion: false,
    });
    off();
  });

  it('publiserer før backenden er spurt, slik lista også gjør', async () => {
    vi.stubEnv('VITE_API_MODE', 'bff');
    let underveis: string | undefined;
    fetchMock.mockImplementation(async () => {
      // Midt i kallet: lista har alt satt det nye navnet på raden sin.
      underveis = renamedThreads().get('conv-1')?.title;
      return new Response('{"ok":true}', { status: 200 });
    });

    await createThreadActions()!.rename(thread, 'Nkom 2024');

    expect(underveis).toBe('Nkom 2024');
  });

  it('legger det gamle navnet tilbake når backenden sier nei', async () => {
    vi.stubEnv('VITE_API_MODE', 'bff');
    fetchMock.mockResolvedValue(new Response('nei', { status: 500 }));
    const heard = vi.fn();
    const off = subscribeToThreadRenames(heard);

    await expect(createThreadActions()!.rename(thread, 'Nkom 2024')).rejects.toThrow();

    expect(renamedThreads().get('conv-1')).toEqual({
      title: 'Måloppnåelse i Nkom',
      titleFromQuestion: false,
    });
    // Én gang for det nye navnet, én gang for det gamle tilbake.
    expect(heard).toHaveBeenCalledTimes(2);
    off();
  });

  it('does not go back to the oldest name when a rename fails after a newer one', async () => {
    // A to B, then B to C before the first has answered; C lands, then B fails.
    // The name on screen is C's, and B's failure says nothing about it
    // (KA CC, kan 2 on #180).
    vi.stubEnv('VITE_API_MODE', 'bff');
    let failFirst: (response: Response) => void = () => {};
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            failFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    const actions = createThreadActions()!;

    const first = actions.rename(thread, 'Nkom B');
    await actions.rename({ ...thread, title: 'Nkom B' }, 'Nkom C');
    failFirst(new Response('nei', { status: 502 }));
    await expect(first).rejects.toThrow();

    expect(renamedThreads().get('conv-1')?.title).toBe('Nkom C');
  });

  it('gir en ny Map hver gang, så useSyncExternalStore ser endringen', async () => {
    const før = renamedThreads();
    await createThreadActions()!.rename(thread, 'Nkom 2024');
    expect(renamedThreads()).not.toBe(før);
  });

  it('slutter å høre etter avmelding', async () => {
    const heard = vi.fn();
    subscribeToThreadRenames(heard)();
    await createThreadActions()!.rename(thread, 'Nkom 2024');
    expect(heard).not.toHaveBeenCalled();
  });
});
