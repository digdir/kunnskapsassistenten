import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThreadActions } from '../../api/threadActions';
import { OpenThreadContext } from '../../layout/openThreadContext';
import type { Thread } from '../../model';
import { ThreadsView } from './ThreadsView';

/**
 * Two races in «Endre navn», with the answers held open so the test decides
 * the order they land in (KA CC, kan 1 and kan 2 on #180). The second follows
 * the same rule as the rename store the heading reads (threadActions.ts).
 *
 * The list is read for real here — no `threads` override — from a client
 * whose every read waits until the test answers it.
 */
const reads = vi.hoisted(() => ({ waiting: [] as ((threads: Thread[]) => void)[] }));

vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api')>()),
  createChatClient: () => ({
    listThreads: () =>
      new Promise<Thread[]>((resolve) => {
        reads.waiting.push(resolve);
      }),
  }),
}));

const now = new Date().toISOString();
const nkom: Thread = { id: 'a', title: 'Måloppnåelse i Nkom', createdAt: now, updatedAt: now };

/** A promise the test settles by hand. */
function held() {
  let settle!: { resolve: () => void; reject: (error: Error) => void };
  const promise = new Promise<void>((resolve, reject) => {
    settle = { resolve, reject };
  });
  return { promise, ...settle };
}

/**
 * The shell as far as the list sees it: the open thread can be changed —
 * with the button, which stands in for the shell — and that is one of the
 * things that makes the list read again.
 */
function Harness({ actions }: { actions: ThreadActions }) {
  const [openThreadId, setOpenThreadId] = useState<string | undefined>(undefined);
  return (
    <OpenThreadContext value={{ openThreadId, setOpenThreadId }}>
      <button type="button" onClick={() => setOpenThreadId('a')}>
        Åpne tråd a
      </button>
      <ThreadsView siblingViews={['threads']} onShowView={() => {}} actions={actions} />
    </OpenThreadContext>
  );
}

async function answerRead(threads: Thread[]) {
  const answer = reads.waiting.shift();
  if (!answer) throw new Error('Ingen lesing venter');
  await act(async () => answer(threads));
}

function menu(title: string) {
  return screen.getByRole('button', { name: `Flere valg for ${title}` });
}

function rename(from: string, to: string) {
  const trigger = menu(from);
  fireEvent.click(trigger);
  const row = trigger.closest('li');
  if (!row) throw new Error(`Fant ikke raden til ${from}`);
  fireEvent.click(within(row).getByRole('button', { name: 'Endre navn', hidden: true }));
  fireEvent.change(screen.getByLabelText('Nytt navn på tråden'), { target: { value: to } });
  fireEvent.click(screen.getByRole('button', { name: 'Lagre' }));
}

beforeEach(() => {
  reads.waiting.length = 0;
});

describe('a rename and a read that was already out', () => {
  it('keeps the new name when the read answers with the old one', async () => {
    const actions = {
      rename: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    };
    render(
      <MemoryRouter>
        <Harness actions={actions} />
      </MemoryRouter>,
    );
    await answerRead([nkom]);

    // Something moves the shell, and the list reads again. That read is out.
    fireEvent.click(screen.getByRole('button', { name: 'Åpne tråd a' }));
    expect(reads.waiting).toHaveLength(1);

    rename('Måloppnåelse i Nkom', 'Nkom 2024');

    // The read was asked before the rename reached the backend, and answers
    // with the old title.
    await answerRead([nkom]);

    expect(menu('Nkom 2024')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Flere valg for Måloppnåelse i Nkom' })).toBeNull();
  });
});

describe('two renames of the same thread in quick succession', () => {
  it('does not go back to the oldest name when the first one fails', async () => {
    const first = held();
    const second = held();
    const calls = [first, second];
    const actions = {
      rename: vi.fn(() => calls.shift()?.promise ?? Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    };
    render(
      <MemoryRouter>
        <Harness actions={actions} />
      </MemoryRouter>,
    );
    await answerRead([nkom]);

    rename('Måloppnåelse i Nkom', 'Nkom B');
    rename('Nkom B', 'Nkom C');

    await act(async () => second.resolve());
    await act(async () => first.reject(new Error('502')));

    expect(menu('Nkom C')).toBeTruthy();
    expect(screen.queryByText(/Klarte ikke å endre navnet/)).toBeNull();
  });
});
