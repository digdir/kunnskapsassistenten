import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setActiveCorpusKey } from '../../api';
import { findThread } from '../../api/mock/fixtures';
import { openMockThread, resetMockThreads } from '../../api/mock/sessionThreads';
import { LayoutProvider } from '../LayoutProvider';
import { MainScrollContext } from '../scrollContext';
import { ChatSlotView } from './ChatSlotView';

/**
 * Hele kjeden bak brukerblikk 8, funn 2: hva hovedkolonnen viser på en adresse
 * som navngir en tråd, før og etter at lesingen har svart.
 *
 * Her og ikke i viewet, fordi det er skallet som vet hva adressen sier.
 * `ChatView` tar en `ThreadDetail` og aldri en rute, så det er beskjeden
 * herfra som skiller «forside» fra «tråd på vei».
 */
const ID = 'nkom-maaloppnaaelse';

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

const greeting = () => screen.queryByText(/Hva lurer du på\?/u);

beforeEach(() => {
  resetMockThreads();
  setActiveCorpusKey('mock');
  window.history.replaceState(null, '', `/threads/${ID}`);
});

describe('hovedkolonnen på en tråd-adresse', () => {
  it('henter samtalen i stedet for å hilse mens lesingen står på', async () => {
    showThread(ID);

    expect(await screen.findByText('Henter samtalen')).toBeTruthy();
    expect(greeting()).toBeNull();
  });

  it('viser samtalen når lesingen har svart', async () => {
    showThread(ID);

    const fixtureQuestion = findThread(ID)?.messages.at(0)?.content ?? '';
    expect(fixtureQuestion).not.toBe('');

    expect(await screen.findByText(fixtureQuestion, undefined, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByText('Henter samtalen')).toBeNull();
  });

  it('slutter å hente når tråden lander tom', async () => {
    /*
     * En samtale som finnes, men ikke har noen turer — en tråd som ble myntet
     * og aldri besvart. Lesingen HAR svart, så det kommer ikke noe mer: da er
     * hilsenen det ærlige, og et skjelett ville lovet meldinger som ikke er
     * på vei.
     */
    openMockThread({
      id: 'tom-traad',
      title: 'En samtale uten svar',
      createdAt: '2026-09-22T09:00:00.000Z',
      updatedAt: '2026-09-22T09:00:00.000Z',
    });

    window.history.replaceState(null, '', '/threads/tom-traad');
    showThread('tom-traad');

    expect(await screen.findByText('Henter samtalen')).toBeTruthy();

    expect(
      await screen.findByText(/Hva lurer du på\?/u, undefined, { timeout: 5000 }),
    ).toBeTruthy();
    expect(screen.queryByText('Henter samtalen')).toBeNull();
  });

  it('sier ærlig fra om en tråd som ikke finnes, og hilser ikke da heller', async () => {
    window.history.replaceState(null, '', '/threads/finnes-ikke');
    showThread('finnes-ikke');

    // Mens lesingen står på er svaret ukjent, så skjermen venter.
    expect(await screen.findByText('Henter samtalen')).toBeTruthy();

    expect(await screen.findByText('Fant ikke tråden', undefined, { timeout: 5000 })).toBeTruthy();
    expect(greeting()).toBeNull();
    expect(screen.queryByText('Henter samtalen')).toBeNull();
  });
});
