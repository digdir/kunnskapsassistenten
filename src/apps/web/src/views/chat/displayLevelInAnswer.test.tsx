import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatClient } from '../../api';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { FilterContext } from '../../layout/filterContext';
import { MainScrollContext } from '../../layout/scrollContext';
import { ThreadContext } from '../../layout/threadContext';
import { emptyFilterSelection, threadFromQuestion, type Message } from '../../model';
import { AnswerMessage } from './AnswerMessage';
import { MessageList } from './MessageList';
import { ChatView } from './ChatView';
import { getFooterMode, resetFooterMode } from '../../layout/footerMode';
import { getDisplayLevel, resetDisplayLevel, setDisplayLevel } from './displayLevel';
import { resetViewport, setViewportWidth } from '../../test/matchMedia';

/*
 * Designsystemets Skeleton spør etter document.getAnimations, som jsdom ikke
 * har. Det tomme svarkortet tegner en mens det første tegnet er på vei.
 */
if (typeof document.getAnimations !== 'function') {
  document.getAnimations = () => [];
}

const answer: Message = {
  id: 'a1',
  role: 'assistant',
  content: 'Nkom måler måloppnåelse mot målene i tildelingsbrevet.',
  createdAt: '2026-09-15T09:00:00Z',
  citations: [],
  thinkingSteps: [
    { id: 's1', kind: 'reasoning', label: 'Jeg deler spørsmålet i to.', durationMs: 2000 },
    {
      id: 's2',
      kind: 'search',
      label: 'Jeg søker i årsrapportene.',
      detail: 'Fant 10 biter i 3 dokumenter.',
      queries: ['Nkom måloppnåelse 2025'],
      durationMs: 2000,
    },
  ],
  retrieval: { hitCount: 10, documentCount: 3, keywords: ['måloppnåelse', 'Nkom'] },
  thoughtMs: 4000,
  status: 'complete',
};

/** Søket eies av `MessageList`; disse testene handler om noe annet. */
const utenSok = {
  searchOpen: false,
  searchQuery: '',
  onSearchQueryChange: () => {},
  onToggleSearch: () => {},
  onCloseSearch: () => {},
  searchLabel: 'Søk i svaret',
};

function showAnswer() {
  return render(
    <ol>
      <AnswerMessage
        {...utenSok}
        message={answer}
        onRegenerate={() => {}}
        onSelectSource={() => {}}
      />
    </ol>,
  );
}

const idleClient: ChatClient = {
  // oxlint-disable-next-line require-yield
  async *ask() {
    throw new Error('ikke spurt');
  },
  listThreads: async () => [],
  getThread: async () => null,
  listFacets: async () => [],
};

/** Skriver adressen ut, så en test kan lese hva lukkingen gjorde med den. */
function Address() {
  const { pathname, hash } = useLocation();
  return <p data-testid="adresse">{pathname + hash}</p>;
}

function Shell({ children, at }: { children: ReactNode; at: string }) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return (
    <MemoryRouter initialEntries={[at]}>
      <MainScrollContext value={scrollRef}>
        <CitationContext value={{ activeCitation: undefined, showCitation: () => {} }}>
          <AnswerSourcesContext value={inertAnswerSources}>
            <ThreadContext value={{ startThread: (question) => threadFromQuestion(question) }}>
              <FilterContext value={{ selection: emptyFilterSelection, setSelection: () => {} }}>
                {children}
                <Address />
              </FilterContext>
            </ThreadContext>
          </AnswerSourcesContext>
        </CitationContext>
      </MainScrollContext>
    </MemoryRouter>
  );
}

describe('visningsnivået i svaret', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDisplayLevel();
  });

  it('viser «Fremgangsmåte», stegene og nøkkelordene, uten det tekniske, på standard', () => {
    /*
     * Issue 88, tegnet i issue 113: ett panel over svarkortet, med
     * stegene under «Tenkte» og søkeordene under «Nøkkelord som ble brukt i
     * søket». Stegene sier hva assistenten prøver å gjøre, og nøkkelordene er
     * det svaret kan etterprøves mot. Tiden, treffene og det hvert steg målte
     * er maskineri — en «bit» er ikke noe en leser har sett.
     */
    showAnswer();

    expect(screen.getByText('Fremgangsmåte')).toBeTruthy();
    expect(screen.getByText('Jeg søker i årsrapportene.')).toBeTruthy();
    expect(screen.getByText('Nøkkelord som ble brukt i søket')).toBeTruthy();
    expect(screen.getByText('måloppnåelse')).toBeTruthy();

    expect(screen.queryByText('Tenkte i 4 sekunder')).toBeNull();
    expect(screen.queryByText('10 treff i 3 dokumenter')).toBeNull();
    expect(screen.queryByText('Nkom måloppnåelse 2025')).toBeNull();
    expect(screen.queryByText('Fant 10 biter i 3 dokumenter.')).toBeNull();
  });

  it('står åpent der det er plass, fordi det svaret etterprøves mot ikke skal ligge bak et klikk', () => {
    const { container } = showAnswer();

    const panel = container.querySelector('.ka-procedure');
    expect((panel as HTMLDetailsElement).open).toBe(true);
  });

  it('står lukket der kolonnen er hele vinduet', () => {
    /*
     * Åpent med fire steg og fem nøkkelord er 450 px av 900 på 1440, men 965
     * av 844 på 390 — da ER fremgangsmåten skjermen, og den som spurte om noe
     * må rulle forbi alt sammen for å komme til svaret. 774 px er der
     * kolonnen slutter å være en lesebredde mellom to skinner og blir hele
     * vinduet.
     */
    setViewportWidth(390);
    try {
      const { container } = showAnswer();

      const panel = container.querySelector('.ka-procedure');
      expect((panel as HTMLDetailsElement).open).toBe(false);
      // Men den er der, med navnet sitt, ett klikk unna.
      expect(screen.getByText('Fremgangsmåte')).toBeTruthy();
    } finally {
      resetViewport();
    }
  });

  it('tar bort et nøkkelord som bare er spørsmålet om igjen', () => {
    /*
     * Agenten planlegger søkene sine ut fra spørsmålet, og det første den
     * planlegger er ofte spørsmålet selv: mot hele Kudos kom leserens egen
     * setning tilbake som ett av ordene den «søkte på» (#4 på #208). Det er
     * sant, og det sier ingenting — leseren skrev det, og det står to linjer
     * lenger opp.
     *
     * Gjennom `MessageList`, fordi det er den som vet hva spørsmålet var: et
     * svar bærer det ikke selv.
     */
    const spoersmaal = 'Hva sier årsrapportene om måloppnåelse?';
    render(
      <ol>
        <MessageList
          messages={[
            {
              id: 'q1',
              role: 'user',
              content: spoersmaal,
              createdAt: '2026-09-15T08:59:00Z',
              citations: [],
              status: 'complete',
            },
            {
              ...answer,
              retrieval: {
                hitCount: 10,
                documentCount: 3,
                // Ordrett, og med annen store bokstav og uten spørsmålstegn.
                keywords: ['hva sier årsrapportene om måloppnåelse', 'måloppnåelse'],
              },
            },
          ]}
          onRegenerate={() => {}}
          onSelectSource={() => {}}
        />
      </ol>,
    );

    expect(screen.getByText('Nøkkelord som ble brukt i søket')).toBeTruthy();
    expect(screen.getByText('måloppnåelse')).toBeTruthy();
    expect(screen.queryByText('hva sier årsrapportene om måloppnåelse')).toBeNull();
  });

  it('viser tenkepanelet og treffene på detaljert', () => {
    setDisplayLevel('detaljert');
    showAnswer();

    expect(screen.getByText('Tenkte i 4 sekunder')).toBeTruthy();
    expect(screen.getByText('10 treff i 3 dokumenter')).toBeTruthy();
    expect(screen.getByText('Nkom måloppnåelse 2025')).toBeTruthy();
  });
});

describe('den skjulte innstillingsmenyen', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDisplayLevel();
    resetFooterMode();
  });

  it('finnes ikke uten adressen', () => {
    // «Standard er standard. Uten adressen ser ingen at menyen finnes.»
    render(
      <Shell at="/">
        <ChatView client={idleClient} />
      </Shell>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Innstillinger')).toBeNull();
  });

  it('åpnes av #innstillinger og skifter nivå med én gang', () => {
    render(
      <Shell at="/#innstillinger">
        <ChatView client={idleClient} />
      </Shell>,
    );

    expect(screen.getByText('Innstillinger')).toBeTruthy();
    const detailed = screen.getByRole('radio', { name: /Detaljert/u });
    expect((screen.getByRole('radio', { name: /Standard/u }) as HTMLInputElement).checked).toBe(
      true,
    );

    fireEvent.click(detailed);

    expect(getDisplayLevel()).toBe('detaljert');
    expect((detailed as HTMLInputElement).checked).toBe(true);
  });

  it('holder også valget for foten, med «ruller med» som standard', () => {
    render(
      <Shell at="/#innstillinger">
        <ChatView client={idleClient} />
      </Shell>,
    );

    const pinned = screen.getByRole('radio', { name: /Festet/u }) as HTMLInputElement;
    const scrolls = screen.getByRole('radio', { name: /Ruller med/u }) as HTMLInputElement;
    expect(scrolls.checked).toBe(true);
    expect(pinned.checked).toBe(false);

    fireEvent.click(pinned);

    expect(getFooterMode()).toBe('pinned');
    expect(pinned.checked).toBe(true);
  });

  it('holder de to valgene fra hverandre, så ett ikke endrer det andre', () => {
    render(
      <Shell at="/#innstillinger">
        <ChatView client={idleClient} />
      </Shell>,
    );

    fireEvent.click(screen.getByRole('radio', { name: /Festet/u }));

    // To radiogrupper, ikke én: nivået skal stå der det stod.
    expect(getDisplayLevel()).toBe('standard');
    expect((screen.getByRole('radio', { name: /Standard/u }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('tar bare hashen ut når den lukkes, og lar tråden stå', () => {
    /*
     * Lukkingen navigerer, og en navigering som glemte stien ville sendt en
     * leser ut av tråden sin for å lukke en meny. `navigate({ hash: '' })`
     * løses mot der man står, så stien blir stående.
     */
    render(
      <Shell at="/threads/abc123#innstillinger">
        <ChatView client={idleClient} />
      </Shell>,
    );

    expect(screen.getByTestId('adresse').textContent).toBe('/threads/abc123#innstillinger');

    fireEvent.click(screen.getByRole('button', { name: 'Lukk' }));

    expect(screen.getByTestId('adresse').textContent).toBe('/threads/abc123');
    expect(screen.queryByText('Innstillinger')).toBeNull();
  });
});
