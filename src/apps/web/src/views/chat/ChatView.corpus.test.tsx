import { render, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
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
 * Forslagene på tomtilstanden, sett gjennom viewet (brukerblikk 5, funn 2).
 *
 * `kickstartersFor` er testet for seg. Dette er koblingen: at viewet faktisk
 * leser det aktive korpuset, og at lista bytter når korpuset bytter — uten
 * omlasting, som er hele poenget med at `useCorpus` leser en ekstern lagring
 * under render.
 *
 * Hooken står inn for her av samme grunn som i `FiltersView.corpus.test.tsx`:
 * den leser en modul-lagring som er låst ved oppstart fra miljøet, så begge
 * tilstandene finnes ikke i én kjøring uten dette.
 */
const corpus = vi.hoisted(() => ({ active: 'mock' as string | undefined }));

vi.mock('../../layout/useCorpus', () => ({
  useCorpus: () => ({
    options: [],
    active: corpus.active,
    option: undefined,
    choosable: false,
    set: vi.fn(),
  }),
}));

/** En klient som aldri blir spurt: tomtilstanden stiller ingen spørsmål. */
const idleClient: ChatClient = {
  // oxlint-disable-next-line require-yield
  async *ask() {
    throw new Error('ikke spurt');
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

const shown = () => screen.getAllByRole('button').map((button) => button.textContent?.trim() ?? '');

describe('ChatView og forslagene per korpus', () => {
  it('viser Kudos-spørsmålene over mock-korpuset', () => {
    // Mock er de 938 Kudos-dokumentene spørsmålene navngir. Kudos-pilot er
    // det ikke, tross navnet — se kickstartersPerCorpus.test.ts.
    corpus.active = 'mock';
    render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    for (const question of KICKSTARTERS) expect(shown()).toContain(question);
  });

  it('viser de generelle spørsmålene over Wikipedia-korpuset', () => {
    corpus.active = 'norquad-docs';
    render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    for (const question of GENERAL_KICKSTARTERS) expect(shown()).toContain(question);
    // Og ingen av Kudos-spørsmålene, som er selve funnet.
    for (const question of KICKSTARTERS) expect(shown()).not.toContain(question);
  });

  it('bytter liste når korpuset byttes, uten omlasting', () => {
    /*
     * Viewet leser korpuset under render, så en ny render er alt som skal til.
     * Cachet det lista ved montering, ville en leser som byttet korpus sittet
     * igjen med forslagene fra det forrige til hen lastet sida på nytt.
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
});

/**
 * Sammenligningen i `filterSummary`: svarets korpus mot det valgte.
 *
 * Den hadde ingen test (KA CC bør 2 på #138), og det er den ene linja hele
 * saken hviler på — leses navnet fra valget i stedet for fra svaret, er
 * feilen fra #129 tilbake uten at noe annet endrer seg.
 */
describe('ChatView og korpuset på linja over svaret', () => {
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

  it('navngir korpuset når svaret kom fra et annet enn det valgte', () => {
    corpus.active = 'norquad-mock';
    render(
      <Shell>
        <ChatView client={idleClient} thread={thread(answered('mock'))} />
      </Shell>,
    );

    expect(screen.getByText(`Hentet fra ${corpusDisplayNameFor('mock')}`)).toBeTruthy();
  });

  it('tier når svaret kom fra det korpuset som er valgt', () => {
    corpus.active = 'mock';
    render(
      <Shell>
        <ChatView client={idleClient} thread={thread(answered('mock'))} />
      </Shell>,
    );

    expect(screen.queryByText(/Hentet fra/u)).toBeNull();
  });

  it('tier når nøkkelen ikke er et korpus denne installasjonen kjenner', () => {
    /*
     * `corpusDisplayNameFor` svarer «standardkorpuset» for en nøkkel den ikke
     * kjenner, og det er en setning om en standard heller enn om dette
     * svaret. En live-backend som valgte datasettet selv sender nettopp en
     * slik nøkkel (KA CC bør 1 på #138).
     */
    corpus.active = 'mock';
    render(
      <Shell>
        <ChatView client={idleClient} thread={thread(answered('et-korpus-ingen-kjenner'))} />
      </Shell>,
    );

    expect(screen.queryByText(/standardkorpuset/u)).toBeNull();
    expect(screen.queryByText(/Hentet fra/u)).toBeNull();
  });

  it('tier når svaret ikke sier hvilket korpus det kom fra', () => {
    corpus.active = 'mock';
    render(
      <Shell>
        <ChatView client={idleClient} thread={thread(answered(undefined))} />
      </Shell>,
    );

    expect(screen.queryByText(/Hentet fra/u)).toBeNull();
  });
});
