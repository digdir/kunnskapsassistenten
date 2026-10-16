import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AskParams, ChatClient } from '../../api';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { FilterContext } from '../../layout/filterContext';
import { MainScrollContext } from '../../layout/scrollContext';
import { ThreadContext } from '../../layout/threadContext';
import { emptyFilterSelection, threadFromQuestion, type StreamEvent } from '../../model';
import { ChatView } from './ChatView';
import { SLOW_ANSWER_NOTICE } from './text';
import { SLOW_ANSWER_MS, STALLED_ANSWER_MS } from './useChat';

/**
 * What a reader sees while a turn goes quiet: the calm line after the first
 * limit, and the alert at the second. The hook's own clock is tested in
 * `stalledAnswer.test.ts`; this is about what reaches the page.
 */

// Designsystemet's Skeleton asks document.getAnimations, which jsdom has not.
if (typeof document.getAnimations !== 'function') {
  document.getAnimations = () => [];
}
Element.prototype.scrollIntoView ??= () => {};

/** A stream that yields what it is given and then waits for ever. */
function clientYielding(events: StreamEvent[]): ChatClient {
  return {
    async *ask({ signal }: AskParams): AsyncIterable<StreamEvent> {
      for (const event of events) {
        if (signal?.aborted) return;
        yield event;
      }
      await new Promise<void>((resolve) => {
        signal?.addEventListener('abort', () => resolve(), { once: true });
      });
      if (signal?.aborted) yield { type: 'error', error: { code: 'aborted' } };
    },
    listThreads: async () => [],
    getThread: async () => null,
    listFacets: async () => [],
  };
}

/** The pieces of the shell the chat view reads. */
function Shell({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return (
    <MemoryRouter>
      <MainScrollContext value={scrollRef}>
        <CitationContext value={{ activeCitation: undefined, showCitation: () => {} }}>
          <AnswerSourcesContext value={inertAnswerSources}>
            <ThreadContext value={{ startThread: (question) => threadFromQuestion(question) }}>
              <FilterContext value={{ selection: emptyFilterSelection, setSelection: () => {} }}>
                {children}
              </FilterContext>
            </ThreadContext>
          </AnswerSourcesContext>
        </CitationContext>
      </MainScrollContext>
    </MemoryRouter>
  );
}

function ask(question: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' }), {
    target: { value: question },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send spørsmålet' }));
}

/** Lets the stream run to its next await, without moving the clock. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const step: StreamEvent = {
  type: 'thinking-step',
  step: { id: 's1', kind: 'search', label: 'Jeg søker i dokumentene.', durationMs: 900 },
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a turn that goes quiet, on the page', () => {
  it('says nothing before the first limit is reached', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding([step])} />
      </Shell>,
    );

    ask('Hva sier årsrapportene om måloppnåelse?');
    await settle();
    await wait(SLOW_ANSWER_MS - 1000);

    expect(screen.queryByText(SLOW_ANSWER_NOTICE)).toBeNull();
  });

  it('puts a calm line by the field, with «Avbryt» still there', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding([step])} />
      </Shell>,
    );

    ask('Hva sier årsrapportene om måloppnåelse?');
    await settle();
    await wait(SLOW_ANSWER_MS);

    // Twice: shown in the column, and said once through the polite region
    // the view already keeps in the page.
    const said = screen.getAllByText(SLOW_ANSWER_NOTICE);
    expect(said.filter((node) => node.classList.contains('ka-slow-notice'))).toHaveLength(1);
    expect(said.filter((node) => node.classList.contains('ds-sr-only'))).toHaveLength(1);

    // Not an alert: nothing has gone wrong yet, and the way out is the
    // button that was there all along.
    expect(screen.queryByRole('alert')?.textContent ?? '').not.toContain(SLOW_ANSWER_NOTICE);
    expect(screen.getByRole('button', { name: 'Avbryt genereringen' })).toBeTruthy();
  });

  it('ends the turn at the limit, and says the wait ran out', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding([step])} />
      </Shell>,
    );

    ask('Hva sier årsrapportene om måloppnåelse?');
    await settle();
    await wait(STALLED_ANSWER_MS);
    await settle();

    expect(screen.getByRole('heading', { name: 'Svaret tok for lang tid' })).toBeTruthy();
    // The line steps aside for the alert: one of them at a time.
    expect(screen.queryByText(SLOW_ANSWER_NOTICE)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Avbryt genereringen' })).toBeNull();
  });

  it('leaves an answer that arrives in good time alone', async () => {
    const events: StreamEvent[] = [
      step,
      { type: 'token', text: 'Måloppnåelsen er omtalt i alle tre.' },
      { type: 'done', messageId: 'm1', conversationId: 'c1' },
    ];
    render(
      <Shell>
        <ChatView client={clientYielding(events)} />
      </Shell>,
    );

    ask('Hva sier årsrapportene om måloppnåelse?');
    await settle();
    await wait(STALLED_ANSWER_MS * 2);

    expect(screen.queryByText(SLOW_ANSWER_NOTICE)).toBeNull();
    expect(screen.queryByRole('alert')?.textContent ?? '').toBe('');
    expect(screen.getByText('Måloppnåelsen er omtalt i alle tre.')).toBeTruthy();
  });
});

describe('a stream that closes with nothing in it, on the page', () => {
  it('says the answer did not arrive, instead of drawing a finished turn', async () => {
    const client: ChatClient = {
      async *ask(): AsyncIterable<StreamEvent> {
        yield step;
      },
      listThreads: async () => [],
      getThread: async () => null,
      listFacets: async () => [],
    };
    render(
      <Shell>
        <ChatView client={client} />
      </Shell>,
    );

    ask('Hva sier årsrapportene om måloppnåelse?');
    await settle();

    expect(screen.getByRole('heading', { name: 'Svaret kom ikke fram' })).toBeTruthy();
  });
});
