import { render, screen, waitFor } from '@testing-library/react';
import { useMemo } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { OpenThreadContext } from '../../layout/openThreadContext';
import type { AnswerSources, Thread } from '../../model';
import { ThreadsView } from './ThreadsView';
import { conversationRevision } from './useThreadList';

/*
 * Skeleton reaches for document.getAnimations through Designsystemet's
 * useSynchronizedAnimation, and jsdom has none. The list starts in the
 * loading state in every test here.
 */
if (typeof document.getAnimations !== 'function') {
  document.getAnimations = () => [];
}

/**
 * The backend, as one mutable list plus a call count.
 *
 * It stands in for what the mock client does for real: a thread the chat view
 * starts is written to the session store before the shell is told about it,
 * so the read that follows sees it. Here the test writes the list by hand and
 * then says what the shell would have said.
 */
const backend = vi.hoisted(() => ({ threads: [] as Thread[], reads: 0, down: false }));

// `importOriginal`, so the corpus store the shell reads is still there; see
// ThreadsView.test.tsx.
vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api')>()),
  createChatClient: () => ({
    listThreads: async () => {
      backend.reads += 1;
      if (backend.down) throw new Error('backend nede');
      return backend.threads;
    },
  }),
}));

const DAY_MS = 86_400_000;
const iso = (offsetMs = 0) => new Date(Date.now() - offsetMs).toISOString();

const eldre: Thread = {
  id: 'eldre',
  title: 'Tilskudd til bredbånd',
  createdAt: iso(3 * DAY_MS),
  updatedAt: iso(3 * DAY_MS),
};

function answer(messageId: string, status: AnswerSources['status']): AnswerSources {
  return { messageId, documents: [], status };
}

/** The shell, as far as the thread list can see it. */
function Harness({ openThreadId, answers }: { openThreadId?: string; answers?: AnswerSources[] }) {
  const openThread = useMemo(() => ({ openThreadId, setOpenThreadId: () => {} }), [openThreadId]);
  const sources = useMemo(() => ({ ...inertAnswerSources, answers }), [answers]);

  return (
    <MemoryRouter>
      <OpenThreadContext value={openThread}>
        <AnswerSourcesContext value={sources}>
          <ThreadsView siblingViews={['threads']} onShowView={() => {}} />
        </AnswerSourcesContext>
      </OpenThreadContext>
    </MemoryRouter>
  );
}

beforeEach(() => {
  backend.threads = [eldre];
  backend.reads = 0;
  backend.down = false;
});

describe('conversationRevision', () => {
  it('moves when a conversation is started', () => {
    expect(conversationRevision(undefined, undefined)).not.toBe(
      conversationRevision('ny-traad', undefined),
    );
  });

  it('moves when an answer settles', () => {
    const streaming = conversationRevision('t', [answer('m1', 'streaming')]);

    expect(streaming).toBe(conversationRevision('t', undefined));
    expect(conversationRevision('t', [answer('m1', 'complete')])).not.toBe(streaming);
  });

  it('stands still while an answer streams', () => {
    // Otherwise the list would be read once per token, and the row would be
    // identical every time.
    const before = conversationRevision('t', [answer('m1', 'streaming')]);

    expect(conversationRevision('t', [answer('m1', 'streaming')])).toBe(before);
  });

  it('counts an answer that was stopped or failed as settled', () => {
    // The mock writes a stopped answer down, so `updatedAt` moved.
    const streaming = conversationRevision('t', [answer('m1', 'streaming')]);

    expect(conversationRevision('t', [answer('m1', 'aborted')])).not.toBe(streaming);
    expect(conversationRevision('t', [answer('m1', 'error')])).not.toBe(streaming);
  });
});

describe('trådlista mens en samtale pågår', () => {
  it('viser tråden som nettopp ble laget, uten å bytte visning', async () => {
    const { rerender } = render(<Harness />);
    await screen.findByRole('link', { name: 'Tilskudd til bredbånd' });

    // What the chat view does when the reader asks the first question on «/»:
    // the thread exists in the store, and the shell is told which one is open.
    backend.threads = [
      { id: 'ny', title: 'Hvor mange årsverk bruker Nkom?', createdAt: iso(), updatedAt: iso() },
      eldre,
    ];
    rerender(<Harness openThreadId="ny" />);

    const row = await screen.findByRole('link', { name: 'Hvor mange årsverk bruker Nkom?' });

    // The open thread, and the reader can see it is: #63 marks the row from
    // the same signal that brought it into the list.
    expect(row.getAttribute('aria-current')).toBe('page');
    expect(row.getAttribute('href')).toBe('/threads/ny');
  });

  it('legger den nye raden øverst, under «I dag»', async () => {
    const { rerender } = render(<Harness />);
    await screen.findByRole('link', { name: 'Tilskudd til bredbånd' });

    backend.threads = [
      eldre,
      { id: 'ny', title: 'Hvor mange årsverk bruker Nkom?', createdAt: iso(), updatedAt: iso() },
    ];
    rerender(<Harness openThreadId="ny" />);
    await screen.findByRole('link', { name: 'Hvor mange årsverk bruker Nkom?' });

    // Sorting is the list's own, so the order the backend answered in does
    // not decide anything.
    const groups = screen.getAllByRole('heading', { level: 3 });
    expect(groups[0]?.textContent).toBe('I dag');

    const first = groups[0]?.closest('section');
    expect(first?.textContent).toContain('Hvor mange årsverk bruker Nkom?');
    expect(first?.textContent).not.toContain('Tilskudd til bredbånd');
  });

  it('oppdaterer tidsstempelet når svaret er kommet', async () => {
    backend.threads = [{ ...eldre, updatedAt: iso(3 * DAY_MS) }];
    const { rerender } = render(<Harness openThreadId="eldre" />);
    await screen.findByRole('link', { name: 'Tilskudd til bredbånd' });
    expect(screen.getAllByRole('heading', { level: 3 })[0]?.textContent).toBe('Siste 7 dager');

    // The turn is written down before the answer is reported as finished, so
    // a read that follows the report has the new `updatedAt`.
    backend.threads = [{ ...eldre, updatedAt: iso() }];
    rerender(<Harness openThreadId="eldre" answers={[answer('m1', 'complete')]} />);

    await waitFor(() =>
      expect(screen.getAllByRole('heading', { level: 3 })[0]?.textContent).toBe('I dag'),
    );
  });

  it('leser ikke lista på nytt mens svaret strømmer', async () => {
    const { rerender } = render(<Harness openThreadId="eldre" />);
    await screen.findByRole('link', { name: 'Tilskudd til bredbånd' });
    expect(backend.reads).toBe(1);

    rerender(<Harness openThreadId="eldre" answers={[answer('m1', 'streaming')]} />);
    rerender(<Harness openThreadId="eldre" answers={[answer('m1', 'streaming')]} />);

    expect(backend.reads).toBe(1);
  });

  it('beholder lista når en oppfriskning feiler', async () => {
    const { rerender } = render(<Harness />);
    await screen.findByRole('link', { name: 'Tilskudd til bredbånd' });

    backend.down = true;
    rerender(<Harness openThreadId="ny" answers={[answer('m1', 'complete')]} />);

    // Whatever went wrong, the reader is looking at a list that is still
    // true. An error state here would replace it with something they can do
    // nothing about.
    await waitFor(() => expect(backend.reads).toBe(2));
    expect(screen.getByRole('link', { name: 'Tilskudd til bredbånd' })).toBeTruthy();
    expect(screen.queryByText('Klarte ikke å hente trådene.')).toBeNull();
  });
});
