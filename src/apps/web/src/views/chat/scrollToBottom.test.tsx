import { fireEvent, render, screen, within } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { ChatClient } from '../../api';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { FilterContext } from '../../layout/filterContext';
import { MainScrollContext } from '../../layout/scrollContext';
import { ThreadContext } from '../../layout/threadContext';
import { emptyFilterSelection, threadFromQuestion, type ThreadDetail } from '../../model';
import { ChatView } from './ChatView';
import { ScrollToBottom } from './ScrollToBottom';

/**
 * «Bla til nederst» as one button for the column (runde 3, ekstra 5).
 *
 * The column is a real element with its three numbers set by hand, since
 * jsdom lays nothing out: 2000 of content in a 500 window, scrolled to the
 * top, so there is something below and the button has a reason to be there.
 */

// jsdom has none; nothing grows here, so one that never fires is enough.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const client: ChatClient = {
  // eslint-disable-next-line require-yield -- no turn is asked here
  async *ask() {},
  listThreads: async () => [],
  getThread: async () => null,
  listFacets: async () => [],
};

const at = '2026-09-30T12:00:00Z';
const thread: ThreadDetail = {
  id: 't1',
  title: 'To svar',
  createdAt: at,
  updatedAt: at,
  messages: [
    {
      id: 'u1',
      role: 'user',
      content: 'Første?',
      createdAt: at,
      citations: [],
      status: 'complete',
    },
    {
      id: 'a1',
      role: 'assistant',
      content: 'Første svar.',
      createdAt: at,
      citations: [],
      status: 'complete',
    },
    { id: 'u2', role: 'user', content: 'Andre?', createdAt: at, citations: [], status: 'complete' },
    {
      id: 'a2',
      role: 'assistant',
      content: 'Andre svar.',
      createdAt: at,
      citations: [],
      status: 'complete',
    },
  ],
};

function tallColumn(): HTMLElement {
  const element = document.createElement('main');
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 2000 });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: 500 });
  element.scrollTo = vi.fn() as unknown as HTMLElement['scrollTo'];
  return element;
}

function Shell({ column, children }: { column: HTMLElement; children: ReactNode }) {
  const scrollRef = useRef<HTMLElement | null>(column);
  return (
    <MemoryRouter>
      <MainScrollContext value={scrollRef}>
        <CitationContext value={{ activeCitation: undefined, showCitation: () => {} }}>
          <AnswerSourcesContext value={inertAnswerSources}>
            <ThreadContext value={{ startThread: threadFromQuestion }}>
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

describe('«Bla til nederst»', () => {
  it('is one button over the field, and none in the answers', () => {
    const { container } = render(
      <Shell column={tallColumn()}>
        <ChatView client={client} thread={thread} />
      </Shell>,
    );

    const buttons = screen.getAllByRole('button', { name: 'Bla til nederst' });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].closest('.ka-composer-area')).not.toBeNull();
    for (const answer of container.querySelectorAll('.ka-message--assistant')) {
      expect(
        within(answer as HTMLElement).queryByRole('button', { name: 'Bla til nederst' }),
      ).toBeNull();
    }
  });

  it('is not there when the column is at its bottom', () => {
    const column = tallColumn();
    column.scrollTop = 1500;
    render(
      <Shell column={column}>
        <ChatView client={client} thread={thread} />
      </Shell>,
    );

    expect(screen.queryByRole('button', { name: 'Bla til nederst' })).toBeNull();
  });

  it('scrolls the column, and hands the keyboard on to the field', () => {
    const column = tallColumn();
    render(
      <Shell column={column}>
        <ChatView client={client} thread={thread} />
      </Shell>,
    );

    const button = screen.getByRole('button', { name: 'Bla til nederst' });
    button.focus();
    // A click the keyboard made has no pointer behind it: detail 0.
    fireEvent.click(button, { detail: 0 });

    expect(column.scrollTo).toHaveBeenCalledWith({ top: 2000, behavior: 'smooth' });
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' }),
    );
  });

  /*
   * The same in the chat view and not only in the button: a tap scrolls and
   * leaves the focus where it was. Focus in the field opens the keyboard on a
   * phone, over the text the reader just asked to see (KA CC on #228, kan 2).
   */
  it('scrolls the column after a tap, and leaves the focus where it was', () => {
    const column = tallColumn();
    render(
      <Shell column={column}>
        <ChatView client={client} thread={thread} />
      </Shell>,
    );

    const button = screen.getByRole('button', { name: 'Bla til nederst' });
    // Where a tap leaves it in a browser that focuses what it clicks.
    button.focus();
    // A click with a pointer behind it: detail 1.
    fireEvent.click(button, { detail: 1 });

    expect(column.scrollTo).toHaveBeenCalledWith({ top: 2000, behavior: 'smooth' });
    expect(document.activeElement).toBe(button);
  });

  it('leaves focus alone after a tap, which would open the keyboard on a phone', () => {
    const onScroll = vi.fn();
    render(<ScrollToBottom onScroll={onScroll} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bla til nederst' }), { detail: 1 });

    expect(onScroll).toHaveBeenCalledExactlyOnceWith(false);
  });
});
