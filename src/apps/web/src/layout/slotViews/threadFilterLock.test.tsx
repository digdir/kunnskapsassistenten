import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatClient } from '../../api/chatClient';
import { emptyFilterSelection, type FilterSelection, type Thread } from '../../model';

/**
 * The filter lock, through the whole app: a thread the BFF has locked to a
 * filter shows the lock in the filter panel instead of the fields, its
 * answers carry the lock on their «Avgrenset til» line, and leaving the
 * thread gives the reader their own choice back.
 *
 * The client is the real mock with one thing added: `getThread` says a
 * filter for the threads this file names, the way the BFF's
 * `detail.filter` does once #179 has translated it. The mock itself keeps no
 * filter on a thread, which is also what the second test relies on.
 */
const locks = vi.hoisted(() => ({
  byThread: new Map<string, FilterSelection>(),
  facetsDown: false,
}));

vi.mock('../../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api')>();
  return {
    ...actual,
    createChatClient: (): ChatClient => {
      const inner = actual.createChatClient();
      return {
        ask: (params) => inner.ask(params),
        listThreads: (signal) => inner.listThreads(signal),
        listFacets: (signal, selection) =>
          locks.facetsDown
            ? Promise.reject(new Error('Filtrene svarte 502.'))
            : inner.listFacets(signal, selection),
        openThread: (thread, certainty) => inner.openThread?.(thread, certainty),
        createThread: (thread: Thread) =>
          Promise.resolve({ ...thread, id: 'ny-laast-traad', conversationId: 'ny-laast-traad' }),
        getThread: async (id, signal) => {
          const found = await inner.getThread(id, signal);
          const filter = locks.byThread.get(id);
          return found && filter ? { ...found, filter } : found;
        },
      };
    },
  };
});

const { App } = await import('../../App');
const { FILTER_STORAGE_KEY } = await import('../persistence');
const { setActiveCorpusKey } = await import('../../api');
const { createThreadActions, resetThreadRenames } = await import('../../api/threadActions');

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
document.getAnimations ??= () => [];

const LOCKED = 'nkom-maaloppnaaelse';
const lock: FilterSelection = {
  ...emptyFilterSelection,
  documentType: ['Årsrapport'],
  year: ['2024'],
};
const own: FilterSelection = { ...emptyFilterSelection, documentType: ['Evaluering'] };

/** A dead link, followed from inside the app: the router moves, nothing reloads. */
function DeadLink() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate('/finnes-ikke')}>
      Følg en død lenke
    </button>
  );
}

function renderApp(path: string) {
  window.history.replaceState(null, '', path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <DeadLink />
    </MemoryRouter>,
  );
}

/** The filter panel's own region, by the heading the view gives it. */
async function filterPanel() {
  const heading = await screen.findByRole('heading', { name: 'Filtrering' });
  const view = heading.closest('.sidebar-content');
  if (!(view instanceof HTMLElement)) throw new Error('Fant ikke filterpanelet');
  return view;
}

beforeEach(() => {
  vi.stubEnv('VITE_MOCK_SPEED', 'fast');
  setActiveCorpusKey('mock');
  locks.byThread.clear();
  locks.facetsDown = false;
  resetThreadRenames();
  sessionStorage.clear();
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(own));
});

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe('a thread locked to a filter', () => {
  it('shows the lock in the panel, and not the fields', async () => {
    locks.byThread.set(LOCKED, lock);
    renderApp(`/threads/${LOCKED}`);

    const panel = await filterPanel();
    const locked = await within(panel).findByRole('region', { name: 'Avgrenset til' });
    expect(
      within(locked)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Årsrapport', '2024']);
    expect(within(locked).getByRole('link', { name: 'Ny tråd' }).getAttribute('href')).toBe('/');
    expect(within(panel).queryByLabelText('Dokumenttyper')).toBeNull();
  });

  it('puts the lock on the line over the answers it read back', async () => {
    locks.byThread.set(LOCKED, lock);
    renderApp(`/threads/${LOCKED}`);

    expect(
      (await screen.findAllByText('Avgrenset til: Årsrapport · 2024', undefined, { timeout: 5000 }))
        .length,
    ).toBeGreaterThan(0);
  });

  it('asks a follow-up with the lock, and says so over its answer', async () => {
    locks.byThread.set(LOCKED, lock);
    renderApp(`/threads/${LOCKED}`);

    const line = 'Avgrenset til: Årsrapport · 2024';
    const before = (await screen.findAllByText(line, undefined, { timeout: 5000 })).length;

    const field = screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' });
    fireEvent.change(field, { target: { value: 'Og i 2023?' } });
    act(() => screen.getByRole('button', { name: 'Send spørsmålet' }).click());

    // The reader's own choice is «Evaluering», and it is not what was asked with.
    await waitFor(() => expect(screen.getAllByText(line).length).toBe(before + 1), {
      timeout: 5000,
    });
    expect(screen.queryByText(/Avgrenset til: Evaluering/)).toBeNull();
  });

  it('keeps the reader’s own choice, and gives it back on leaving', async () => {
    locks.byThread.set(LOCKED, lock);
    renderApp(`/threads/${LOCKED}`);

    const panel = await filterPanel();
    const locked = await within(panel).findByRole('region', { name: 'Avgrenset til' });
    // The lock is never written over what the reader chose.
    expect(JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) ?? '{}')).toEqual(own);

    act(() => within(locked).getByRole('link', { name: 'Ny tråd' }).click());

    await waitFor(() =>
      expect(within(panel).queryByRole('region', { name: 'Avgrenset til' })).toBeNull(),
    );
    expect(await within(panel).findByText('Evaluering', undefined, { timeout: 5000 })).toBeTruthy();
  });
});

describe('the facets failing under a lock', () => {
  it('says nothing about them while the thread is locked, since no field is drawn', async () => {
    locks.byThread.set(LOCKED, lock);
    locks.facetsDown = true;
    renderApp(`/threads/${LOCKED}`);

    const panel = await filterPanel();
    await within(panel).findByRole('region', { name: 'Avgrenset til' });
    // Long enough for the failed fetch to have landed.
    await act(() => new Promise((resolve) => setTimeout(resolve, 500)));

    expect(within(panel).queryByText('Klarte ikke å hente filtrene.')).toBeNull();
  });

  it('does say so in a thread with no lock', async () => {
    locks.facetsDown = true;
    renderApp(`/threads/${LOCKED}`);

    const panel = await filterPanel();
    expect(
      await within(panel).findByText('Klarte ikke å hente filtrene.', undefined, { timeout: 5000 }),
    ).toBeTruthy();
  });
});

describe('a dead link from a locked thread', () => {
  it('lets the lock go, since no thread is open on «Siden finnes ikke»', async () => {
    /*
     * The shell is around every route, and the one for an unknown address
     * has no ChatSlotView to say what its thread is locked to (KA CC, kan 2
     * on #183, read in the code and measured here).
     */
    locks.byThread.set(LOCKED, lock);
    renderApp(`/threads/${LOCKED}`);

    const panel = await filterPanel();
    await within(panel).findByRole('region', { name: 'Avgrenset til' });

    act(() => screen.getByRole('button', { name: 'Følg en død lenke' }).click());
    await screen.findByRole('heading', { name: 'Siden finnes ikke' });

    // The panel as it is now, not the one found before the navigation: the
    // shell for this route is another element, and a detached one would
    // still hold the old lock.
    const after = await filterPanel();
    expect(after.isConnected).toBe(true);
    await waitFor(() =>
      expect(within(after).queryByRole('region', { name: 'Avgrenset til' })).toBeNull(),
    );
  });
});

describe('a corpus switch', () => {
  it('lets the lock go with the thread', async () => {
    locks.byThread.set(LOCKED, lock);
    renderApp(`/threads/${LOCKED}`);

    const panel = await filterPanel();
    await within(panel).findByRole('region', { name: 'Avgrenset til' });

    act(() => setActiveCorpusKey('norquad-mock'));

    await waitFor(() =>
      expect(within(panel).queryByRole('region', { name: 'Avgrenset til' })).toBeNull(),
    );
  });
});

describe('a thread with no lock', () => {
  it('draws the fields as before', async () => {
    renderApp(`/threads/${LOCKED}`);

    const panel = await filterPanel();
    expect(
      (await within(panel).findAllByLabelText('Dokumenttyper', undefined, { timeout: 5000 }))
        .length,
    ).toBeGreaterThan(0);
    expect(within(panel).queryByRole('region', { name: 'Avgrenset til' })).toBeNull();
  });
});

describe('a new thread', () => {
  it('keeps its lock when it is renamed', async () => {
    /*
     * A rename is published to the page (#185), which updates the thread it
     * holds from it, and the lock follows that thread. A thread this page
     * started has none read, and its lock came from reading it back: a
     * rename must leave it standing. Green when written — the page's thread
     * starts as null and a rename of nothing leaves it null — and here so it
     * stays that way when either side changes.
     */
    locks.byThread.set('ny-laast-traad', lock);
    renderApp('/');

    const field = screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' });
    fireEvent.change(field, { target: { value: 'Hva rapporterer Nkom?' } });
    act(() => screen.getByRole('button', { name: 'Send spørsmålet' }).click());

    const panel = await filterPanel();
    await within(panel).findByRole('region', { name: 'Avgrenset til' }, { timeout: 5000 });

    await act(async () => {
      await createThreadActions()?.rename(
        {
          id: 'ny-laast-traad',
          conversationId: 'ny-laast-traad',
          title: 'Hva rapporterer Nkom?',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        'Nkom og kundetilfredshet',
      );
    });

    expect(within(panel).getByRole('region', { name: 'Avgrenset til' })).toBeTruthy();
  });

  it('is locked from its first question when the backend says so', async () => {
    locks.byThread.set('ny-laast-traad', lock);
    renderApp('/');

    const field = screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' });
    fireEvent.change(field, { target: { value: 'Hva rapporterer Nkom?' } });
    act(() => screen.getByRole('button', { name: 'Send spørsmålet' }).click());

    const panel = await filterPanel();
    expect(
      await within(panel).findByRole('region', { name: 'Avgrenset til' }, { timeout: 5000 }),
    ).toBeTruthy();
  });
});
