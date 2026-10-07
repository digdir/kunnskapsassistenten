import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act, useRef } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveCorpusKey } from '../../api';
import { resetBffClient } from '../../api/bff/BffChatClient';
import askStream from '../../api/bff/fixtures/ask.sse?raw';
import capabilities from '../../api/bff/fixtures/capabilities.json';
import { LayoutProvider } from '../LayoutProvider';
import { MainScrollContext } from '../scrollContext';
import { ChatSlotView } from './ChatSlotView';

/**
 * A first question that fails before the BFF has named its conversation.
 *
 * The page writes a stand-in address the moment the question is sent, and
 * moves it to the BFF's id when the `conversation` event comes. When the
 * question failed first, nothing moved it later: «Prøv igjen» made a real
 * conversation in the BFF, and the address stayed on the stand-in, which
 * leads to «Fant ikke tråden» after a reload.
 */

/** The id in the recorded answer, `fixtures/ask.sse`. */
const CONVERSATION_ID = 'kWn8jrWsHY5TgBLRU6LPs';

function Scroll({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return <MainScrollContext value={scrollRef}>{children}</MainScrollContext>;
}

function showFrontPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <LayoutProvider>
        <Scroll>
          <Routes>
            <Route element={<ChatSlotView />} path="/" />
            <Route element={<ChatSlotView />} path="/threads/:threadId" />
          </Routes>
        </Scroll>
      </LayoutProvider>
    </MemoryRouter>,
  );
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A BFF whose `/api/v2/ask` answers with the given responses in turn. */
function fakeBff(...asks: (() => Response)[]) {
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const route = `${init?.method ?? 'GET'} ${String(url)}`;
    if (route === 'POST /api/v2/ask') return (asks.shift() ?? (() => json({}, 500)))();
    if (route === 'GET /api/v2/capabilities') return json(capabilities);
    if (route === 'GET /api/v2/conversations') return json({ conversations: [] });
    return json({}, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const answered = () =>
  new Response(askStream, { headers: { 'Content-Type': 'text/event-stream' } });

function ask(question: string) {
  const field = screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' });
  fireEvent.change(field, { target: { value: question } });
  act(() => screen.getByRole('button', { name: 'Send spørsmålet' }).click());
}

beforeEach(() => {
  resetBffClient();
  vi.stubEnv('VITE_API_MODE', 'bff');
  setActiveCorpusKey('kudos-full');
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('et første spørsmål som feiler før samtalen finnes', () => {
  it('får adressen til samtalen når «Prøv igjen» lager den', async () => {
    fakeBff(() => json({ error: 'Kunne ikke opprette samtale.' }, 502), answered);
    showFrontPage();

    ask('Hva skriver DFØ om måloppnåelse?');
    const retry = await screen.findByRole('button', { name: 'Prøv igjen' });
    expect(window.location.pathname).not.toBe(`/threads/${CONVERSATION_ID}`);

    act(() => retry.click());

    await waitFor(() => expect(window.location.pathname).toBe(`/threads/${CONVERSATION_ID}`));
  });

  it('får adressen til samtalen når et nytt spørsmål lager den', async () => {
    fakeBff(() => json({ error: 'Kunne ikke opprette samtale.' }, 502), answered);
    showFrontPage();

    ask('Hva skriver DFØ om måloppnåelse?');
    await screen.findByRole('button', { name: 'Prøv igjen' });

    ask('Hva skriver DFØ om måloppnåelse i 2024?');

    await waitFor(() => expect(window.location.pathname).toBe(`/threads/${CONVERSATION_ID}`));
  });
});
