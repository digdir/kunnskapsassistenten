import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setActiveCorpusKey } from '../../api';
import { findThread, threads } from '../../api/mock/fixtures';
import { mockThreadList, resetMockThreads } from '../../api/mock/sessionThreads';
import { LayoutProvider } from '../LayoutProvider';
import { MainScrollContext } from '../scrollContext';
import { ChatSlotView } from './ChatSlotView';

/**
 * Spørsmål stilt før tråden er ferdig lastet (kjent hull etter #66).
 *
 * `getThread` bruker en rundtur, og skrivefeltet står der hele tiden — det er
 * med vilje: leseren skal kunne skrive mens tråden lastes. Men `startThread`
 * så bare på tråden som var kommet, og en tråd som ikke er kommet ser ut som
 * ingen tråd. Så spørsmålet myntet en HELT ny tråd, skrev adressen om til den,
 * og la en tom tråd i lista ved siden av den leseren faktisk sto i.
 *
 * Adressen er det observerbare, og den er nok: `startThread` kjører synkront
 * når spørsmålet sendes. Svaret trenger ikke lande for at dette skal være
 * sant, og testen venter derfor ikke på strømmen.
 */
const THREAD_ID = 'nkom-maaloppnaaelse';

/** The scroll container the main slot owns; the shell hands it over. */
function Scroll({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return <MainScrollContext value={scrollRef}>{children}</MainScrollContext>;
}

function showThread() {
  return render(
    <MemoryRouter initialEntries={[`/threads/${THREAD_ID}`]}>
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

const field = () => screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' });

beforeEach(() => {
  resetMockThreads();
  setActiveCorpusKey('mock');
  window.history.replaceState(null, '', `/threads/${THREAD_ID}`);
});

describe('spørsmål stilt før tråden har landet', () => {
  it('lar adressen bli stående på tråden leseren åpnet', () => {
    showThread();

    ask('Hva med DSS?');

    expect(window.location.pathname).toBe(`/threads/${THREAD_ID}`);
  });

  it('legger ingen ny tråd i lista', () => {
    showThread();

    ask('Hva med DSS?');

    /*
     * Lista er fikstursamtalene og ingenting annet. En tråd myntet her ville
     * blitt lagt i lageret med én gang (`openThread`), og stått i lista som en
     * tom samtale med spørsmålet som tittel — ved siden av tråden leseren
     * hadde åpnet, som svaret uansett havner i.
     */
    const listed = mockThreadList(threads).map((thread) => thread.id);
    expect(listed).toEqual(threads.map((thread) => thread.id));
  });

  it('viser den lagrede samtalen og spørsmålet sammen når tråden lander', async () => {
    const lagret = findThread(THREAD_ID)?.messages.at(0)?.content ?? '';
    expect(lagret).not.toBe('');

    showThread();

    ask('Hva med DSS?');

    /*
     * Begge halvdelene, på skjermen samtidig: `useChat` legger den lagrede
     * samtalen foran turen som var i gang, og adressen er den leseren åpnet,
     * så «Kopier lenke til tråden» (som kopierer `window.location.href`)
     * peker på samtalen de faktisk står i.
     */
    expect(await screen.findByText(lagret)).toBeTruthy();
    expect(screen.getByText('Hva med DSS?')).toBeTruthy();
    expect(window.location.pathname).toBe(`/threads/${THREAD_ID}`);
  });
});

function ask(question: string) {
  fireEvent.change(field(), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Send spørsmålet' }));
}
