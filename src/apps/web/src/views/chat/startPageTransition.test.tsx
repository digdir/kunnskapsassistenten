import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatClient } from '../../api';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { FilterContext } from '../../layout/filterContext';
import { MainScrollContext } from '../../layout/scrollContext';
import { ThreadContext } from '../../layout/threadContext';
import {
  emptyFilterSelection,
  threadFromQuestion,
  type StreamEvent,
  type ThreadDetail,
} from '../../model';
import { ChatView } from './ChatView';

/*
 * Designsystemets Skeleton spør etter document.getAnimations, som jsdom ikke
 * har, og jsdom legger ingenting ut og ruller ikke.
 */
if (typeof document.getAnimations !== 'function') {
  document.getAnimations = () => [];
}
Element.prototype.scrollIntoView ??= () => {};

/**
 * Overgangen fra startsiden: skrivefeltet glir fra midten til foten når det
 * første spørsmålet går. Den er en forbedring og ikke en forutsetning, så det
 * som holdes fast her er at spørsmålet går uansett hvilket svar nettleseren
 * gir — med View Transitions, uten dem, og når leseren ber om mindre bevegelse.
 */
const answer: StreamEvent[] = [
  { type: 'token', text: 'Et svar.' },
  { type: 'done', messageId: 'm1', conversationId: 'c1' },
];

const client: ChatClient = {
  async *ask(): AsyncIterable<StreamEvent> {
    for (const event of answer) yield event;
  },
  listThreads: async () => [],
  getThread: async () => null,
  listFacets: async () => [],
};

function Shell({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return (
    <MemoryRouter>
      <MainScrollContext value={scrollRef}>
        <CitationContext
          value={{ activeCitation: undefined, showCitation: () => {}, showDocument: () => {} }}
        >
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

/** A browser that has the API, counted and run at once. */
function withTransitions() {
  const calls: (() => void)[] = [];
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    writable: true,
    value: (update: () => void) => {
      calls.push(update);
      update();
      return {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        skipTransition: () => {},
      };
    },
  });
  return calls;
}

function wantsLessMotion() {
  const real = window.matchMedia;
  vi.spyOn(window, 'matchMedia').mockImplementation((media: string) =>
    media.includes('prefers-reduced-motion')
      ? ({
          media,
          matches: true,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          onchange: null,
          dispatchEvent: () => false,
        } as unknown as MediaQueryList)
      : real.call(window, media),
  );
}

const thread: ThreadDetail = {
  id: 't1',
  title: 'En tråd',
  createdAt: '2026-10-14T09:00:00Z',
  updatedAt: '2026-10-14T09:00:00Z',
  messages: [
    {
      id: 'u1',
      role: 'user',
      content: 'Første spørsmål',
      createdAt: '2026-10-14T09:00:00Z',
      citations: [],
      status: 'complete',
    },
    {
      id: 'a1',
      role: 'assistant',
      content: 'Første svar',
      createdAt: '2026-10-14T09:00:01Z',
      citations: [],
      status: 'complete',
    },
  ],
};

/** Svaret står i den siste assistentmeldingen, skrevet ut av Markdown. */
function answered(container: HTMLElement): boolean {
  return [...container.querySelectorAll('.ka-message--assistant')].some((message) =>
    (message.textContent ?? '').includes('Et svar.'),
  );
}

function ask(question: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' }), {
    target: { value: question },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send spørsmålet' }));
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'startViewTransition');
});

describe('overgangen fra startsiden', () => {
  it('ber om en overgang for det første spørsmålet, og spørsmålet går', async () => {
    const calls = withTransitions();
    const { container } = render(
      <Shell>
        <ChatView client={client} />
      </Shell>,
    );

    ask('Hva sier rapporten?');

    expect(calls).toHaveLength(1);
    await waitFor(() => expect(answered(container)).toBe(true));
  });

  it('ber ikke om en overgang i en tråd som alt har svar', async () => {
    const calls = withTransitions();
    const { container } = render(
      <Shell>
        <ChatView client={client} thread={thread} />
      </Shell>,
    );

    ask('Et oppfølgingsspørsmål');

    expect(calls).toHaveLength(0);
    await waitFor(() => expect(answered(container)).toBe(true));
  });

  it('ber ikke om en overgang når leseren vil ha mindre bevegelse', async () => {
    const calls = withTransitions();
    wantsLessMotion();
    const { container } = render(
      <Shell>
        <ChatView client={client} />
      </Shell>,
    );

    ask('Hva sier rapporten?');

    expect(calls).toHaveLength(0);
    await waitFor(() => expect(answered(container)).toBe(true));
  });

  it('sender like godt i en nettleser uten View Transitions', async () => {
    expect(document.startViewTransition).toBeUndefined();
    const { container } = render(
      <Shell>
        <ChatView client={client} />
      </Shell>,
    );

    ask('Hva sier rapporten?');

    await waitFor(() => expect(answered(container)).toBe(true));
  });
});
