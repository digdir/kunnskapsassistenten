import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setActiveCorpusKey } from '../../api';
import { resetMockThreads } from '../../api/mock/sessionThreads';
import { LayoutProvider } from '../LayoutProvider';
import { MainScrollContext } from '../scrollContext';
import { ChatSlotView } from './ChatSlotView';

/**
 * Bytte korpus starter en ny tråd (KA CC bør 2 på #131).
 *
 * Her og ikke i `useChat`, fordi det er hele kjeden som er saken. `useChat`
 * tømmer samtalen, men det er `startThread` i dette skallet som avgjør om det
 * neste spørsmålet får en ny tråd eller havner i den gamle — og det er der
 * feilen satt.
 *
 * Mekanismen er verdt å ha skrevet ned: adressen til den første tråden
 * skrives med `history.replaceState`, som routeren ALDRI ser. Så
 * korpusvelgerens `navigate('/')` er en no-op — routeren tror den allerede
 * står der — ingenting remonteres, og `startedRef` beholdt den gamle tråden.
 */
/** The scroll container the main slot owns; the shell hands it over. */
function Scroll({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return <MainScrollContext value={scrollRef}>{children}</MainScrollContext>;
}

function show() {
  return render(
    <MemoryRouter>
      <LayoutProvider>
        <Scroll>
          {/*
            The two routes the shell has (`App.tsx`). This file stays on `/`
            and would be green without them, because `threadId` is `undefined`
            either way — but `useParams` gives `{}` without a matched route and
            says nothing about it. The day an assertion here opens a thread
            from the list, it would measure nothing.
          */}
          <Routes>
            <Route index element={<ChatSlotView />} />
            <Route path="threads/:threadId" element={<ChatSlotView />} />
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
  window.history.replaceState(null, '', '/');
});

describe('korpusbytte i chat-plassen', () => {
  it('mynter en ny tråd for spørsmålet etter et bytte', () => {
    /*
     * Adressen er det observerbare her, og den er nok: `startThread` kjører
     * synkront når spørsmålet sendes, og skriver `/threads/<id>` med
     * `replaceState`. Får det andre spørsmålet den samme adressen, havnet det
     * i den gamle tråden — som er hele funnet.
     *
     * Svaret trenger ikke lande for at dette skal være sant, og det er med
     * vilje: strømmen gjør ikke seg ferdig i jsdom, og en test som ventet på
     * den ville målt noe annet enn det den heter.
     */
    show();

    ask('Hva står i årsrapporten?');
    const first = window.location.pathname;
    expect(first).toMatch(/^\/threads\/.+/u);
    stop();

    act(() => setActiveCorpusKey('norquad-mock'));

    ask('Hva står i artiklene?');
    const second = window.location.pathname;

    expect(second).toMatch(/^\/threads\/.+/u);
    expect(second).not.toBe(first);
  });
});

function ask(question: string) {
  fireEvent.change(field(), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Send spørsmålet' }));
}

function stop() {
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Avbryt genereringen' }));
  });
}
