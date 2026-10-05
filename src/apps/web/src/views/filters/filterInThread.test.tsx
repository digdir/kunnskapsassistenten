import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatClient } from '../../api/chatClient';
import { emptyFilterSelection, type FilterSelection, type Thread } from '../../model';

/**
 * Changing the filter in a thread that is going on (Simens issue 90).
 *
 * Through the whole app, as threadFilterLock.test.tsx does, with the same
 * client: the real mock, with `createThread` recorded so a test can see what
 * a thread was started with. The mock keeps no filter on a thread, so every
 * thread here is one with no lock — the case the note is for.
 */
const seen = vi.hoisted(() => ({
  created: [] as Thread[],
  locks: new Map<string, FilterSelection>(),
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
        listFacets: (signal, selection) => inner.listFacets(signal, selection),
        openThread: (thread, certainty) => inner.openThread?.(thread, certainty),
        createThread: (thread: Thread) => {
          seen.created.push(thread);
          return Promise.resolve({ ...thread, id: 'ny-traad', conversationId: 'ny-traad' });
        },
        getThread: async (id, signal) => {
          const found = await inner.getThread(id, signal);
          const filter = seen.locks.get(id);
          return found && filter ? { ...found, filter } : found;
        },
      };
    },
  };
});

const { App } = await import('../../App');
const { FILTER_STORAGE_KEY } = await import('../../layout/persistence');
const { setActiveCorpusKey } = await import('../../api');

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
document.getAnimations ??= () => [];

const NOTE = 'Du har endret filteret i en tråd som er i gang.';
const THREAD = '/threads/nkom-maaloppnaaelse';

function renderApp(path: string) {
  window.history.replaceState(null, '', path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

/** The thread on screen, which is when it counts as going on. */
async function threadOnScreen() {
  await screen.findByRole('heading', { name: 'NKOM måloppnåelse' }, { timeout: 5000 });
}

async function filterPanel() {
  const heading = await screen.findByRole('heading', { name: 'Filtrering' });
  const view = heading.closest('.sidebar-content');
  if (!(view instanceof HTMLElement)) throw new Error('Fant ikke filterpanelet');
  return view;
}

/** Every document type ticked, once the field is there. */
async function selectAllTypes(panel: HTMLElement) {
  const button = await within(panel).findByRole(
    'button',
    { name: 'Velg alle dokumenttyper' },
    { timeout: 5000 },
  );
  act(() => button.click());
}

/** The note itself, not the live region that says the same words. */
function noteIn(panel: HTMLElement): HTMLElement | null {
  return panel.querySelector('.filters-view__changed');
}

async function findNote(panel: HTMLElement): Promise<HTMLElement> {
  return waitFor(() => {
    const note = noteIn(panel);
    if (!note) throw new Error('Ingen beskjed');
    return note;
  });
}

function storedFilter(): FilterSelection {
  return JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) ?? '{}') as FilterSelection;
}

beforeEach(() => {
  vi.stubEnv('VITE_MOCK_SPEED', 'fast');
  setActiveCorpusKey('mock');
  seen.created = [];
  seen.locks.clear();
  sessionStorage.clear();
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(emptyFilterSelection));
});

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe('the filter changed in a thread with no lock', () => {
  it('says so, with «Ny tråd», and tells a screen reader', async () => {
    renderApp(THREAD);
    await threadOnScreen();
    const panel = await filterPanel();

    await selectAllTypes(panel);

    const box = await findNote(panel);
    expect(box.textContent).toContain(NOTE);
    expect(within(box).getByRole('link', { name: 'Ny tråd' }).getAttribute('href')).toBe('/');
    // The panel's own live region, so it is said once, as it appears.
    expect(
      [...panel.querySelectorAll('output.ds-sr-only')].some((region) =>
        region.textContent?.startsWith(NOTE),
      ),
    ).toBe(true);
  });

  it('takes the note away when the filter is changed back', async () => {
    renderApp(THREAD);
    await threadOnScreen();
    const panel = await filterPanel();

    await selectAllTypes(panel);
    await findNote(panel);
    act(() => within(panel).getByRole('button', { name: 'Tøm dokumenttyper' }).click());

    await waitFor(() => expect(noteIn(panel)).toBeNull());
  });

  it('starts a new conversation from the note, with the new filter', async () => {
    renderApp(THREAD);
    await threadOnScreen();
    const panel = await filterPanel();

    await selectAllTypes(panel);
    const box = await findNote(panel);
    const chosen = storedFilter().documentType;
    expect(chosen.length).toBeGreaterThan(0);

    act(() => within(box).getByRole('link', { name: 'Ny tråd' }).click());

    // A new conversation: the greeting, and no note about the old thread.
    expect(await screen.findByRole('heading', { name: /Hva lurer du på\?/ })).toBeTruthy();
    expect(noteIn(panel)).toBeNull();
    // And the filter the reader chose, not an empty one.
    expect(storedFilter().documentType).toEqual(chosen);
  });
});

describe('the filter changed where no thread is going on', () => {
  it('says nothing on the front page', async () => {
    renderApp('/');
    const panel = await filterPanel();

    await selectAllTypes(panel);
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));

    expect(noteIn(panel)).toBeNull();
  });
});

describe('a thread started here', () => {
  it('is started with the filter its first question is asked with', async () => {
    const own: FilterSelection = { ...emptyFilterSelection, documentType: ['Evaluering'] };
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(own));
    renderApp('/');

    const field = screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' });
    fireEvent.change(field, { target: { value: 'Hva rapporterer Nkom?' } });
    act(() => screen.getByRole('button', { name: 'Send spørsmålet' }).click());

    // What a client that keeps a filter stores with the conversation (live).
    await waitFor(() => expect(seen.created).toHaveLength(1));
    expect(seen.created[0].filter?.documentType).toEqual(['Evaluering']);
  });
});

/*
 * «Ny tråd» in the lock, for a thread started on this page. The chat slot
 * keys `/` on «Ny tråd» being pressed, so a plain link changed the address
 * and left the conversation and the lock standing (measured in live, 05.10).
 */
describe('«Ny tråd» in the lock of a thread started here', () => {
  it('starts a new conversation, with the reader’s own filter', async () => {
    const own: FilterSelection = { ...emptyFilterSelection, documentType: ['Evaluering'] };
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(own));
    seen.locks.set('ny-traad', own);
    renderApp('/');

    const field = screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' });
    fireEvent.change(field, { target: { value: 'Hva rapporterer Nkom?' } });
    act(() => screen.getByRole('button', { name: 'Send spørsmålet' }).click());

    const panel = await filterPanel();
    const locked = await within(panel).findByRole(
      'region',
      { name: 'Avgrenset til' },
      { timeout: 5000 },
    );
    act(() => within(locked).getByRole('link', { name: 'Ny tråd' }).click());

    expect(await screen.findByRole('heading', { name: /Hva lurer du på\?/ })).toBeTruthy();
    await waitFor(() =>
      expect(within(panel).queryByRole('region', { name: 'Avgrenset til' })).toBeNull(),
    );
    expect(storedFilter().documentType).toEqual(['Evaluering']);
  });
});
