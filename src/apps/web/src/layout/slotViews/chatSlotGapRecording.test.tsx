import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockChatClient } from '../../api/mock/MockChatClient';
import { findThread, threads } from '../../api/mock/fixtures';
import {
  SESSION_STORAGE_KEY,
  mockThreadDetail,
  mockThreadList,
  openMockThread,
  resetMockThreads,
} from '../../api/mock/sessionThreads';
import { LayoutProvider } from '../LayoutProvider';
import { MainScrollContext } from '../scrollContext';
import { ChatSlotView } from './ChatSlotView';

/**
 * Turen som ble stilt i gapet blir skrevet ned (KA CC på #149).
 *
 * #149 ga spørsmålet riktig tråd. Det som sto igjen er rekkefølgen: lesingen
 * var det eneste som sa hvor svaret hørte hjemme, og sier den det etter at
 * svaret er ferdig, har ingen filet turen noe sted. Da var spørsmålet borte
 * ved neste omlasting.
 *
 * Lander lesingen midt i strømmen går det bra allerede — det er målt — så
 * fella her er å måle for tidlig: fikstursamtalen står på skjermen fra før,
 * så både «Tenkte» og «Kopier svaret» finnes lenge før leserens egen tur er
 * over. Testene venter derfor på at stoppknappen er blitt sendeknapp igjen.
 */
/** En lesing som bruker lengre tid enn hele svaret. */
const SLOW_READ = 4000;

vi.mock('../../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api')>();
  return {
    ...actual,
    createChatClient: () =>
      new MockChatClient({
        requestMs: SLOW_READ,
        thinkingStepMs: 0,
        firstTokenMs: 0,
        tokenMs: 0,
        sourcesMs: 0,
      }),
  };
});

const ID = 'nkom-maaloppnaaelse';
const QUESTION = 'Hva med DSS?';

/** The scroll container the main slot owns; the shell hands it over. */
function Scroll({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return <MainScrollContext value={scrollRef}>{children}</MainScrollContext>;
}

function showThread(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/threads/${id}`]}>
      <LayoutProvider>
        <Scroll>
          <Routes>
            <Route element={<ChatSlotView />} path="/threads/:threadId" />
          </Routes>
        </Scroll>
      </LayoutProvider>
    </MemoryRouter>,
  );
}

function ask(question: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' }), {
    target: { value: question },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send spørsmålet' }));
}

/** Turen er over når stoppknappen er blitt sendeknapp igjen. */
async function turnIsOver() {
  await waitFor(
    () => expect(screen.getByRole('button', { name: 'Send spørsmålet' })).toBeTruthy(),
    {
      timeout: 20000,
      interval: 100,
    },
  );
}

beforeEach(() => {
  resetMockThreads();
  window.history.replaceState(null, '', `/threads/${ID}`);
});

describe('turen som ble stilt i gapet', () => {
  it(
    'skrives ned selv om lesingen lander etter at svaret er ferdig',
    { timeout: 30000 },
    async () => {
      showThread(ID);

      ask(QUESTION);
      await turnIsOver();

      const stored = mockThreadDetail(ID, findThread(ID));
      expect(stored?.messages.map((message) => message.content)).toContain(QUESTION);
    },
  );

  it('legger turen i tråden fra adressen, ikke i en annen', { timeout: 30000 }, async () => {
    // En annen samtale sto åpen først, slik den gjør når leseren kommer fra
    // en tråd og åpner en ny. Uten at noen sier fra ved spørsmålet, ville
    // turen lagt seg i den forrige.
    openMockThread({
      id: 'annen-traad',
      title: 'En annen samtale',
      createdAt: '2026-09-20T09:00:00.000Z',
      updatedAt: '2026-09-20T09:00:00.000Z',
    });

    showThread(ID);

    ask(QUESTION);
    await turnIsOver();

    const other = mockThreadDetail('annen-traad', null);
    expect(other?.messages).toHaveLength(0);
  });

  it('slipper den ekte tittelen til når lesingen lander', { timeout: 30000 }, async () => {
    /*
     * Rekkefølgen som oppstår i gapet: stedfortrederen skriver FØRST, den
     * ekte tråden 700 ms senere. En regel om at «det lageret alt vet vinner»
     * ser lik ut og er det ikke — da blir stedfortrederens tittel det lageret
     * vet, og samtalen heter leserens siste spørsmål (KA CC på #153).
     *
     * Lest rett ut av lageret, fordi det er der verdien er feil: trådlista
     * tegner fikstursamtalene fra koden, så en fikstur-tittel i lageret er
     * ikke synlig noe annet sted.
     */
    showThread(ID);
    ask(QUESTION);

    // Lesingen har landet når fikstursamtalen står på skjermen.
    const fixtureQuestion = findThread(ID)?.messages.at(0)?.content ?? '';
    expect(fixtureQuestion).not.toBe('');
    await screen.findByText(fixtureQuestion, undefined, { timeout: 20000 });

    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY) ?? '{}';
    const stored = JSON.parse(raw) as Record<string, { thread: { title: string } }>;
    expect(stored[ID]?.thread.title).toBe(findThread(ID)?.title);
  });

  it('døper ikke om en tråd lageret alt kjenner', { timeout: 30000 }, async () => {
    // En økttråd: den har sin egen tittel fra sitt eget første spørsmål.
    openMockThread({
      id: 'okt-traad',
      title: 'Det første spørsmålet',
      createdAt: '2026-09-20T09:00:00.000Z',
      updatedAt: '2026-09-20T09:00:00.000Z',
    });

    window.history.replaceState(null, '', '/threads/okt-traad');
    showThread('okt-traad');

    ask(QUESTION);
    await turnIsOver();

    const listed = mockThreadList(threads).find((thread) => thread.id === 'okt-traad');
    expect(listed?.title).toBe('Det første spørsmålet');
  });
});
