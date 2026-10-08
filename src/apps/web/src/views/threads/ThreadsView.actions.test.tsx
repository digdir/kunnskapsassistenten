import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { ThreadActions } from '../../api/threadActions';
import { OpenThreadContext } from '../../layout/openThreadContext';
import { newThreadCount } from '../../layout/useNewThread';
import type { Thread } from '../../model';
import { ThreadsView } from './ThreadsView';

/**
 * «Endre navn» and «Slett» in the thread list.
 *
 * The list is given and the actions are given, so what is asserted is the
 * view's half: what the reader sees at once, what it looks like when the
 * backend says no, and where focus goes. The calls themselves are
 * threadActions.test.ts.
 *
 * Its own file because the client is replaced with one that never lists
 * anything, as in ThreadsView.test.tsx, and the thread list here comes from
 * the `threads` override instead.
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

/** Actions that answer the way a test says, and remember what was asked. */
function actionsThat(outcome: 'succeed' | 'fail') {
  const settle = () =>
    outcome === 'succeed' ? Promise.resolve() : Promise.reject(new Error('502'));
  return {
    rename: vi.fn<ThreadActions['rename']>(settle),
    remove: vi.fn<ThreadActions['remove']>(settle),
  };
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

/**
 * `at` is the router's address, which is the thread's own unless the thread
 * was started on `/`: its address is then written with `history.replaceState`,
 * which the router never sees.
 */
function renderView(
  actions: ThreadActions | null,
  openThreadId?: string,
  at = openThreadId ? `/threads/${openThreadId}` : '/',
) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <OpenThreadContext value={{ openThreadId, setOpenThreadId: () => {} }}>
        <ThreadsView
          siblingViews={['threads']}
          onShowView={() => {}}
          threads={threads}
          actions={actions}
        />
      </OpenThreadContext>
      <Where />
    </MemoryRouter>,
  );
}

function menu(title: string) {
  return screen.getByRole('button', { name: `Flere valg for ${title}` });
}

/**
 * Open a row's menu and press one of its two buttons. The list is drawn in
 * the row, beside its trigger, so it is looked for there and not page-wide:
 * every row has an «Endre navn».
 */
function choose(title: string, action: 'Endre navn' | 'Slett') {
  const trigger = menu(title);
  fireEvent.click(trigger);
  const row = trigger.closest('li');
  if (!row) throw new Error(`Fant ikke raden til ${title}`);
  fireEvent.click(within(row).getByRole('button', { name: action, hidden: true }));
}

function liveRegion(container: HTMLElement) {
  return container.querySelector('.threads-view > output.ds-sr-only')?.textContent;
}

describe('the thread menu', () => {
  it('has one per row, named after the thread', () => {
    renderView(actionsThat('succeed'));

    expect(menu('Måloppnåelse i Nkom')).toBeTruthy();
    expect(menu('Årsrapport for Digdir')).toBeTruthy();
  });

  it('is not there when the deployment cannot rename or delete', () => {
    renderView(null);

    expect(screen.queryByRole('button', { name: /^Flere valg for/ })).toBeNull();
  });
});

describe('renaming a thread', () => {
  it('opens a field in the row, holding the old name', () => {
    renderView(actionsThat('succeed'));

    choose('Måloppnåelse i Nkom', 'Endre navn');

    const field = screen.getByLabelText('Nytt navn på tråden') as HTMLInputElement;
    expect(field.value).toBe('Måloppnåelse i Nkom');
    expect(document.activeElement).toBe(field);
  });

  it('shows the new name at once, asks the backend, and says so', () => {
    const actions = actionsThat('succeed');
    const { container } = renderView(actions);

    choose('Måloppnåelse i Nkom', 'Endre navn');
    fireEvent.change(screen.getByLabelText('Nytt navn på tråden'), {
      target: { value: '  Nkom 2024  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lagre' }));

    expect(actions.rename).toHaveBeenCalledWith(threads[0], 'Nkom 2024');
    expect(menu('Nkom 2024')).toBeTruthy();
    expect(liveRegion(container)).toBe('Tråden heter nå «Nkom 2024».');
  });

  it('gives focus back to the row’s menu when it is saved', () => {
    renderView(actionsThat('succeed'));

    choose('Måloppnåelse i Nkom', 'Endre navn');
    fireEvent.change(screen.getByLabelText('Nytt navn på tråden'), {
      target: { value: 'Nkom 2024' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lagre' }));

    expect(document.activeElement).toBe(menu('Nkom 2024'));
  });

  it('puts the old name back, and says why, when the backend says no', async () => {
    const actions = actionsThat('fail');
    renderView(actions);

    choose('Måloppnåelse i Nkom', 'Endre navn');
    fireEvent.change(screen.getByLabelText('Nytt navn på tråden'), {
      target: { value: 'Nkom 2024' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Lagre' }));
    });

    expect(menu('Måloppnåelse i Nkom')).toBeTruthy();
    expect(
      screen.getByText('Klarte ikke å endre navnet. Tråden heter fortsatt «Måloppnåelse i Nkom».'),
    ).toBeTruthy();
  });

  it('leaves it as it was on Escape, with focus on the menu', () => {
    const actions = actionsThat('succeed');
    renderView(actions);

    choose('Måloppnåelse i Nkom', 'Endre navn');
    fireEvent.keyDown(screen.getByLabelText('Nytt navn på tråden'), { key: 'Escape' });

    expect(actions.rename).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(menu('Måloppnåelse i Nkom'));
  });

  it('will not save an empty name', () => {
    const actions = actionsThat('succeed');
    renderView(actions);

    choose('Måloppnåelse i Nkom', 'Endre navn');
    fireEvent.change(screen.getByLabelText('Nytt navn på tråden'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lagre' }));

    expect(actions.rename).not.toHaveBeenCalled();
    expect(screen.getByText('Tråden må ha et navn.')).toBeTruthy();
  });

  it('asks nothing when the name did not change', () => {
    const actions = actionsThat('succeed');
    renderView(actions);

    choose('Måloppnåelse i Nkom', 'Endre navn');
    fireEvent.click(screen.getByRole('button', { name: 'Lagre' }));

    expect(actions.rename).not.toHaveBeenCalled();
  });
});

describe('deleting a thread', () => {
  it('asks first, and nothing happens on «Avbryt»', () => {
    const actions = actionsThat('succeed');
    renderView(actions);

    choose('Måloppnåelse i Nkom', 'Slett');
    expect(screen.getByRole('heading', { name: 'Slette tråden?' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Avbryt' }));

    fireEvent.click(screen.getByRole('button', { name: 'Avbryt' }));

    expect(actions.remove).not.toHaveBeenCalled();
    expect(menu('Måloppnåelse i Nkom')).toBeTruthy();
    expect(document.activeElement).toBe(menu('Måloppnåelse i Nkom'));
  });

  it('takes the row away at once, with focus on the next one', () => {
    const actions = actionsThat('succeed');
    const { container } = renderView(actions);

    choose('Måloppnåelse i Nkom', 'Slett');
    fireEvent.click(screen.getByRole('button', { name: 'Slett tråden' }));

    expect(actions.remove).toHaveBeenCalledWith(threads[0]);
    expect(screen.queryByRole('button', { name: 'Flere valg for Måloppnåelse i Nkom' })).toBeNull();
    expect(document.activeElement).toBe(menu('Årsrapport for Digdir'));
    expect(liveRegion(container)).toBe('«Måloppnåelse i Nkom» er slettet.');
  });

  /*
   * Over an empty list «Ny tråd» says «Start din første tråd» instead, and
   * it is the same link in the same place (issue 82, round 2) — so
   * that is where focus goes when the last row does.
   */
  it('puts focus on «Start din første tråd» when the last one is deleted', () => {
    renderView(actionsThat('succeed'));
    const newThread = screen.getByRole('link', { name: /Ny tråd/ });

    choose('Måloppnåelse i Nkom', 'Slett');
    fireEvent.click(screen.getByRole('button', { name: 'Slett tråden' }));
    choose('Årsrapport for Digdir', 'Slett');
    fireEvent.click(screen.getByRole('button', { name: 'Slett tråden' }));

    const start = screen.getByRole('link', { name: /Start din første tråd/ });
    expect(start).toBe(newThread);
    expect(document.activeElement).toBe(start);
  });

  it('puts the row back, and says so, when the backend says no', async () => {
    renderView(actionsThat('fail'));

    choose('Måloppnåelse i Nkom', 'Slett');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Slett tråden' }));
    });

    expect(menu('Måloppnåelse i Nkom')).toBeTruthy();
    expect(
      screen.getByText('Klarte ikke å slette «Måloppnåelse i Nkom». Tråden er fortsatt her.'),
    ).toBeTruthy();
  });

  it('leaves the thread on screen for a new one when that is the one deleted', () => {
    renderView(actionsThat('succeed'), 'a');

    choose('Måloppnåelse i Nkom', 'Slett');
    fireEvent.click(screen.getByRole('button', { name: 'Slett tråden' }));

    expect(screen.getByTestId('where').textContent).toBe('/');
  });

  /*
   * The router still says `/` for a thread started there, so navigating to
   * `/` changes nothing. The chat slot keys `/` on the «Ny tråd» count, and
   * without it the deleted conversation stayed on screen and the next
   * question went to it, which the BFF answered with a 404.
   *
   * The count and nothing else of «Ny tråd»: focus stays on the next row,
   * where the reader is clearing out threads.
   */
  it('gives a new conversation when the one deleted was started on the front page', () => {
    renderView(actionsThat('succeed'), 'a', '/');
    const before = newThreadCount();

    choose('Måloppnåelse i Nkom', 'Slett');
    fireEvent.click(screen.getByRole('button', { name: 'Slett tråden' }));

    expect(newThreadCount()).toBe(before + 1);
    expect(screen.getByTestId('where').textContent).toBe('/');
    expect(document.activeElement).toBe(menu('Årsrapport for Digdir'));
  });

  it('stays on the thread on screen when another one is deleted', () => {
    renderView(actionsThat('succeed'), 'a');

    choose('Årsrapport for Digdir', 'Slett');
    fireEvent.click(screen.getByRole('button', { name: 'Slett tråden' }));

    expect(screen.getByTestId('where').textContent).toBe('/threads/a');
  });
});
