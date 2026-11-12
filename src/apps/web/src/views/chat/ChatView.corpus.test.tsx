import { render, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatClient } from '../../api';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { FilterContext } from '../../layout/filterContext';
import { MainScrollContext } from '../../layout/scrollContext';
import { ThreadContext } from '../../layout/threadContext';
import { emptyFilterSelection, threadFromQuestion } from '../../model';
import { corpusDisplayNameFor } from '../../api';
import type { Message, ThreadDetail } from '../../model';
import { ChatView } from './ChatView';
import { GENERAL_KICKSTARTERS, KICKSTARTERS } from './text';

/**
 * The suggestions on the empty state, seen through the view (user view 5, finding 2).
 *
 * `kickstartersFor` is tested on its own. This is the link: that the view
 * actually reads the active corpus, and that the list changes when the corpus
 * changes, without a reload, which is the whole point of `useCorpus` reading
 * an external store during render.
 *
 * The hook is stood in for here for the same reason as in
 * `FiltersView.corpus.test.tsx`: it reads a module store locked at startup
 * from the environment, so both states cannot exist in one run without this.
 */
const corpus = vi.hoisted(() => ({
  active: 'mock' as string | undefined,
  option: undefined as { key: string; label: string } | undefined,
}));

vi.mock('../../layout/useCorpus', () => ({
  useCorpus: () => ({
    options: [],
    active: corpus.active,
    option: corpus.option,
    choosable: false,
    set: vi.fn(),
  }),
}));

/** A client that is never asked: the empty state asks no questions. */
const idleClient: ChatClient = {
  // oxlint-disable-next-line require-yield
  async *ask() {
    throw new Error('not asked');
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

const shown = () => screen.getAllByRole('button').map((button) => button.textContent?.trim() ?? '');

describe('ChatView and the suggestions per corpus', () => {
  beforeEach(() => {
    corpus.option = undefined;
  });

  it('shows the Kudos questions over the mock corpus', () => {
    // Mock is the 938 Kudos documents the questions name. Kudos-pilot is
    // not, despite the name: see kickstartersPerCorpus.test.ts.
    corpus.active = 'mock';
    render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    for (const question of KICKSTARTERS) expect(shown()).toContain(question);
  });

  it('shows the general questions over the Wikipedia corpus', () => {
    corpus.active = 'norquad-docs';
    render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    for (const question of GENERAL_KICKSTARTERS) expect(shown()).toContain(question);
    // And none of the Kudos questions, which is the finding itself.
    for (const question of KICKSTARTERS) expect(shown()).not.toContain(question);
  });

  it('changes the list when the corpus changes, without a reload', () => {
    /*
     * The view reads the corpus during render, so a new render is all it
     * takes. Had it cached the list on mount, a reader who changed corpus
     * would keep the previous one's suggestions until they reloaded the page.
     */
    corpus.active = 'mock';
    const { rerender } = render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );
    expect(shown()).toContain(KICKSTARTERS[0]);

    corpus.active = 'norquad-docs';
    rerender(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    expect(shown()).toContain(GENERAL_KICKSTARTERS[0]);
    expect(shown()).not.toContain(KICKSTARTERS[0]);
  });

  it('names the active collection in the general questions', () => {
    corpus.active = 'kudos';
    corpus.option = { key: 'kudos', label: 'Kudos' };
    render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    expect(shown()).toContain('Hva handler dokumentene i Kudos om?');
    expect(shown()).not.toContain(GENERAL_KICKSTARTERS[0]);
  });
});

/**
 * The comparison in `filterSummary`: the answer's corpus against the chosen one.
 *
 * It had no test (KA CC should 2 on #138), and it is the one line the whole
 * matter rests on: if the name is read from the choice instead of from the
 * answer, the bug from #129 is back without anything else changing.
 */
describe('ChatView and the corpus on the line above the answer', () => {
  beforeEach(() => {
    corpus.option = undefined;
  });

  const answered = (corpusKeyOnAnswer?: string): Message[] => [
    {
      id: 'u1',
      role: 'user',
      content: 'Hva står i årsrapporten?',
      createdAt: '2026-09-20T09:00:00.000Z',
      citations: [],
      status: 'complete',
    },
    {
      id: 'a1',
      role: 'assistant',
      content: 'Svaret.',
      createdAt: '2026-09-20T09:00:05.000Z',
      citations: [],
      ...(corpusKeyOnAnswer === undefined ? {} : { corpusKey: corpusKeyOnAnswer }),
      status: 'complete',
    },
  ];

  const thread = (messages: Message[]): ThreadDetail => ({
    id: 't1',
    title: 'En tråd',
    createdAt: '2026-09-20T09:00:00.000Z',
    updatedAt: '2026-09-20T09:00:05.000Z',
    messages,
  });

  it('names the corpus when the answer came from another than the chosen one', () => {
    corpus.active = 'norquad-mock';
    render(
      <Shell>
        <ChatView client={idleClient} thread={thread(answered('mock'))} />
      </Shell>,
    );

    expect(screen.getByText(`Hentet fra ${corpusDisplayNameFor('mock')}`)).toBeTruthy();
  });

  it('says nothing when the answer came from the chosen corpus', () => {
    corpus.active = 'mock';
    render(
      <Shell>
        <ChatView client={idleClient} thread={thread(answered('mock'))} />
      </Shell>,
    );

    expect(screen.queryByText(/Hentet fra/u)).toBeNull();
  });

  it('says nothing when the key is not a corpus this installation knows', () => {
    /*
     * `corpusDisplayNameFor` answers «standardsamlingen» for a key it does not
     * know, which is a sentence about a default rather than about this answer.
     * A live backend that chose the dataset itself sends just such a key
     * (KA CC should 1 on #138).
     */
    corpus.active = 'mock';
    render(
      <Shell>
        <ChatView client={idleClient} thread={thread(answered('et-korpus-ingen-kjenner'))} />
      </Shell>,
    );

    expect(screen.queryByText(/standardsamlingen/u)).toBeNull();
    expect(screen.queryByText(/Hentet fra/u)).toBeNull();
  });

  it('says nothing when the answer does not say which corpus it came from', () => {
    corpus.active = 'mock';
    render(
      <Shell>
        <ChatView client={idleClient} thread={thread(answered(undefined))} />
      </Shell>,
    );

    expect(screen.queryByText(/Hentet fra/u)).toBeNull();
  });
});
