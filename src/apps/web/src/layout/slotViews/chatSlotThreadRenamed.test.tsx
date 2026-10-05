import { render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveCorpusKey } from '../../api';
import { findThread } from '../../api/mock/fixtures';
import { resetMockThreads } from '../../api/mock/sessionThreads';
import {
  createThreadActions,
  resetThreadActions,
  resetThreadRenames,
} from '../../api/threadActions';
import { LayoutProvider } from '../LayoutProvider';
import { MainScrollContext } from '../scrollContext';
import { ChatSlotView } from './ChatSlotView';

/**
 * Gir leseren den åpne tråden et nytt navn i trådlista, skal overskriften i
 * hovedkolonnen følge med med en gang.
 *
 * Målt 29.09 i mock: lista viste det nye navnet straks, mens overskriften sto
 * på «NKOM måloppnåelse» til neste innlasting. Årsaken er at hovedkolonnen
 * tegner `threadHeading` av tråden `ChatSlotView` leste da adressen ble
 * åpnet, og lista bare oppdaterer sine egne rader.
 *
 * Her og ikke i viewet, fordi det er skallet som eier den kopien av tråden.
 *
 * Unntak fra dirigenten for `src/layout/slotViews/ChatSlotView.tsx`.
 */
const ID = 'nkom-maaloppnaaelse';

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

/** Overskriften over svaret, som er den tråden heter på skjermen. */
const heading = () => screen.getByRole('heading', { level: 2 }).textContent;

beforeEach(() => {
  resetMockThreads();
  resetThreadActions();
  resetThreadRenames();
  setActiveCorpusKey('mock');
  window.history.replaceState(null, '', `/threads/${ID}`);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('et nytt navn på den åpne tråden', () => {
  it('står i overskriften uten ny innlasting', async () => {
    const thread = findThread(ID)!;
    showThread(ID);
    await waitFor(() => expect(heading()).toBe(thread.title));

    await createThreadActions()!.rename(thread, 'Måloppnåelse i Nkom 2024');

    await waitFor(() => expect(heading()).toBe('Måloppnåelse i Nkom 2024'));
  });

  it('kommer tilbake til det gamle når backenden sier nei', async () => {
    const thread = findThread(ID)!;
    showThread(ID);
    await waitFor(() => expect(heading()).toBe(thread.title));

    /*
     * Bff-modus settes FØRST her, ikke før rendringen: sattes den tidligere,
     * ville ChatSlotView hentet tråden med bff-klienten og møtt den samme
     * 500-en, så ingenting sto på skjermen å døpe om. Tråden leses i mock,
     * og bare omdøpingen går mot en backend som sier nei.
     *
     * Som lista: navnet står med en gang, og tas tilbake om kallet feiler.
     */
    vi.stubEnv('VITE_API_MODE', 'bff');
    /*
     * Backenden svarer først når testen sier fra.
     *
     * Mellomtilstanden må stå i testen, ellers holder den ingenting: uten
     * koblingen endrer overskriften seg aldri, og «den står på det gamle
     * navnet til slutt» er da sant av feil grunn. Med et svar som kommer med
     * en gang, rekker ikke mellomtilstanden å bli sett — og en ventende
     * avvisning uten en som tar imot, melder vitest som en uhåndtert feil.
     */
    let sayNo = (): void => {};
    const answered = new Promise<Response>((resolve) => {
      sayNo = () => resolve(new Response('nei', { status: 500 }));
    });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(answered));

    const pending = createThreadActions()!.rename(thread, 'Måloppnåelse i Nkom 2024');
    const settled = expect(pending).rejects.toThrow();

    // Navnet står med en gang, før backenden har svart, som i lista.
    await waitFor(() => expect(heading()).toBe('Måloppnåelse i Nkom 2024'));

    sayNo();
    await settled;

    await waitFor(() => expect(heading()).toBe(thread.title));
  });
});
