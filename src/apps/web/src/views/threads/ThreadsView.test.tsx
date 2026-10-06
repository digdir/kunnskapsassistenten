import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { Thread } from '../../model';
import { ThreadsView } from './ThreadsView';

/*
 * A client whose fetch never settles, so the loading state can be observed.
 * The mock client resolves within the same act() as the render, which loads
 * the list before an assertion can see it.
 */
/*
 * Skeleton calls document.getAnimations through Designsystemet's
 * useSynchronizedAnimation, and jsdom has no Web Animations. Local to this
 * file: only the loading state renders a Skeleton.
 */
if (typeof document.getAnimations !== 'function') {
  document.getAnimations = () => [];
}

/*
 * Only the client is replaced. `importOriginal` keeps the rest of the module,
 * which the shell's corpus store lives in — a bare factory drops
 * `subscribeToCorpus` and every test in the file fails on an import rather
 * than on what it is about.
 */
vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api')>()),
  createChatClient: () => ({ listThreads: () => new Promise(() => {}) }),
}));

const now = new Date().toISOString();
const threads: Thread[] = [
  { id: 'a', title: 'Måloppnåelse i Nkom', createdAt: now, updatedAt: now },
  { id: 'b', title: 'Årsrapport for Digdir', createdAt: now, updatedAt: now },
];

function renderView(given: Thread[] | undefined, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThreadsView siblingViews={['threads']} onShowView={() => {}} threads={given} />
    </MemoryRouter>,
  );
}

/**
 * The search text itself is not driven here: Designsystemet's Search.Input
 * does not deliver `onInput` under jsdom, measured with a bare probe. What
 * the count says for a given query is verified in the browser instead. These
 * tests cover the part that broke — whether the region exists at all.
 */
describe('ThreadsView', () => {
  it('has the hit count region in the DOM before there is a hit count', () => {
    const { container } = renderView(threads);

    // A live region only announces text that appears inside a region that
    // already existed, so the region may not be mounted with its text.
    const status = container.querySelector('output.threads-view__search-status');
    expect(status).not.toBeNull();
    expect(status?.textContent).toBe('');
  });

  it('keeps the same region node across renders', () => {
    const { container, rerender } = renderView(threads);
    const before = container.querySelector('output.threads-view__search-status');

    rerender(
      <MemoryRouter>
        <ThreadsView siblingViews={['threads']} onShowView={() => {}} threads={[threads[0]]} />
      </MemoryRouter>,
    );

    expect(container.querySelector('output.threads-view__search-status')).toBe(before);
  });

  it('marks the list busy and says so while the threads are loading', () => {
    const { container } = renderView(undefined);

    expect(container.querySelector('.threads-view')?.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('Henter tråder')).toBeTruthy();
  });

  it('keeps the loading region in the DOM once the threads are there', () => {
    const { container } = renderView(threads);

    expect(container.querySelector('.threads-view')?.getAttribute('aria-busy')).toBeNull();
    expect(container.querySelector('output.ds-sr-only')).not.toBeNull();
  });

  it('does not mark «Ny tråd» as the current page', () => {
    renderView(threads, '/');

    // It is an action, not a place. The thread rows are the places.
    expect(screen.getByRole('link', { name: /Ny tråd/ }).getAttribute('aria-current')).toBeNull();
  });
});

/*
 * «Ny tråd» moves into the empty state as «Start din første tråd», and is
 * taken away from above it (the design, 30.09). Only for a list known to be empty:
 * loading or not, the reader can always start a thread.
 */
describe('the way to a new thread', () => {
  it('is the empty list’s only content when there are no threads', () => {
    renderView([]);

    const start = screen.getByRole('link', { name: /Start din første tråd/ });
    expect(start.getAttribute('href')).toBe('/');
    expect(screen.queryByRole('link', { name: /Ny tråd/ })).toBeNull();
    // Alone (issue 82, round 2): no heading and no sentence over it.
    expect(screen.queryByText('Ingen tråder ennå')).toBeNull();
    expect(screen.queryByText('Still et spørsmål, så havner samtalen her.')).toBeNull();
    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'Tidligere tråder',
    ]);
  });

  it('stays above the list while it loads', () => {
    renderView(undefined);

    expect(screen.getByRole('link', { name: /Ny tråd/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Start din første tråd/ })).toBeNull();
  });

  it('stays above the list when there are threads', () => {
    renderView(threads);

    expect(screen.getByRole('link', { name: /Ny tråd/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Start din første tråd/ })).toBeNull();
  });
});

/*
 * The search field goes with «Ny tråd» (KA CC on #197): over a list known to
 * be empty there is nothing to search, and the empty state stands alone.
 */
describe('the search field', () => {
  it('is not drawn over a list known to be empty', () => {
    renderView([]);

    expect(screen.queryByRole('searchbox', { name: 'Søk i tråder' })).toBeNull();
    expect(screen.queryByRole('search')).toBeNull();
  });

  it('stays while the list loads', () => {
    renderView(undefined);

    expect(screen.getByRole('searchbox', { name: 'Søk i tråder' })).toBeTruthy();
  });

  it('stays when there are threads', () => {
    renderView(threads);

    expect(screen.getByRole('searchbox', { name: 'Søk i tråder' })).toBeTruthy();
  });
});

/*
 * A new thread takes the panel to the filters (issue 75, round 2):
 * the reader narrows the corpus there before the first question, and the list
 * has nothing new to show until it is asked.
 */
describe('a new thread and the filter view', () => {
  function renderWithFilters(given: Thread[]) {
    const onShowView = vi.fn();
    render(
      <MemoryRouter>
        <ThreadsView siblingViews={['filters']} onShowView={onShowView} threads={given} />
      </MemoryRouter>,
    );
    return onShowView;
  }

  it('goes to the filters on «Ny tråd»', () => {
    const onShowView = renderWithFilters(threads);

    fireEvent.click(screen.getByRole('link', { name: /Ny tråd/ }));

    expect(onShowView).toHaveBeenCalledExactlyOnceWith('filters');
  });

  it('goes to the filters on «Start din første tråd»', () => {
    const onShowView = renderWithFilters([]);

    fireEvent.click(screen.getByRole('link', { name: /Start din første tråd/ }));

    expect(onShowView).toHaveBeenCalledExactlyOnceWith('filters');
  });

  it('leaves the panel as it is on a click that opens another tab', () => {
    const onShowView = renderWithFilters(threads);
    const link = screen.getByRole('link', { name: /Ny tråd/ });

    fireEvent.click(link, { metaKey: true });
    fireEvent.click(link, { ctrlKey: true });
    fireEvent.click(link, { shiftKey: true });
    fireEvent.click(link, { button: 1 });

    expect(onShowView).not.toHaveBeenCalled();
  });

  it('stays in the list when the slot has no filter view to go to', () => {
    const onShowView = vi.fn();
    render(
      <MemoryRouter>
        <ThreadsView siblingViews={[]} onShowView={onShowView} threads={threads} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: /Ny tråd/ }));

    expect(onShowView).not.toHaveBeenCalled();
  });
});
