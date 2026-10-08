import { render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveCorpusKey } from '../../api';
import { openMockThread, resetMockThreads } from '../../api/mock/sessionThreads';
import {
  createThreadActions,
  resetThreadActions,
  resetThreadRenames,
} from '../../api/threadActions';
import { threadFromQuestion, type Thread } from '../../model';
import { LayoutProvider } from '../LayoutProvider';
import { MainScrollContext } from '../scrollContext';
import { ChatSlotView } from './ChatSlotView';

/**
 * En tråd som ikke har fått noe eget navn ennå, bærer `titleFromQuestion:
 * true` — både den som ble startet her (`threadFromQuestion`) og den som er
 * lest fra backenden (`live/conversations.ts`, `threadFromConversation`).
 *
 * Da tegnes overskriften `ds-sr-only`: den gjentar spørsmålet som står rett
 * under, så den er verdt å høre og ikke verdt å se (`ChatView`,
 * `heading.repeatsQuestion`).
 *
 * Det flagget må overleve et tilbakefall. Slår omdøpingen feil, kommer den
 * gamle tittelen tilbake — og kommer den tilbake som et EGET navn, står den
 * samme setningen plutselig synlig rett over spørsmålet den er laget av.
 *
 * Funnet av KA CC på #185, lest i koden. Denne fila er målingen.
 *
 * Unntak fra dirigenten for `src/layout/slotViews/ChatSlotView.tsx`.
 */
const QUESTION = 'Hva sier årsrapportene om måloppnåelse?';

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

/*
 * Trådens overskrift er den FØRSTE H2-en. Hilsenen «Hei 👋 Hva lurer du på?»
 * er også en H2 på en tråd uten turer, så `getByRole` alene kaster på to
 * treff — og en test som aldri kommer forbi det første `waitFor`, sier
 * ingenting om saken.
 */
const headingElement = () => screen.getAllByRole('heading', { level: 2 })[0]!;
const headingText = () => headingElement().textContent;
/** `ds-sr-only`: heard, not seen, because it only repeats the question. */
const headingIsHidden = () => headingElement().classList.contains('ds-sr-only');

/**
 * A thread with no name of its own, readable by its address.
 *
 * `openMockThread` puts it in the session store, and `mockThreadDetail`
 * answers from the store for an id the fixtures know nothing about — so the
 * slot loads it into `thread`, flag and all, the same shape live gives a
 * conversation the backend has not named.
 */
function unnamedThread(): Thread {
  const thread = { ...threadFromQuestion(QUESTION), corpusKey: 'mock' };
  openMockThread(thread);
  return thread;
}

beforeEach(() => {
  resetMockThreads();
  resetThreadActions();
  resetThreadRenames();
  setActiveCorpusKey('mock');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('en tråd uten eget navn, døpt om', () => {
  it('får en synlig overskrift av navnet, fordi det ikke lenger gjentar spørsmålet', async () => {
    const thread = unnamedThread();
    showThread(thread.id);
    // Mocken svarer med vilje etter en stund; 5 s som i de andre slot-testene.
    await waitFor(() => expect(headingText()).toBe(QUESTION), { timeout: 5000 });
    expect(headingIsHidden()).toBe(true);

    await createThreadActions()!.rename(thread, 'Måloppnåelse 2024');

    await waitFor(() => expect(headingText()).toBe('Måloppnåelse 2024'));
    expect(headingIsHidden()).toBe(false);
  });

  it('lar overskriften bli skjult igjen når backenden sier nei', async () => {
    const thread = unnamedThread();
    showThread(thread.id);
    await waitFor(() => expect(headingText()).toBe(QUESTION), { timeout: 5000 });

    vi.stubEnv('VITE_API_MODE', 'bff');
    let sayNo = (): void => {};
    const answered = new Promise<Response>((resolve) => {
      sayNo = () => resolve(new Response('nei', { status: 500 }));
    });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(answered));

    const pending = createThreadActions()!.rename(thread, 'Måloppnåelse 2024');
    const settled = expect(pending).rejects.toThrow();
    await waitFor(() => expect(headingText()).toBe('Måloppnåelse 2024'));

    sayNo();
    await settled;

    await waitFor(() => expect(headingText()).toBe(QUESTION));
    /*
     * Dette er saken: tittelen er tilbake, men flagget må være det også.
     * Uten det tegnes den gamle overskriften synlig, rett over det samme
     * spørsmålet den er laget av.
     */
    expect(headingIsHidden()).toBe(true);
  });
});
