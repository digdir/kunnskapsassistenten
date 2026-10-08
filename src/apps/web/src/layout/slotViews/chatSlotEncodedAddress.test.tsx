import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { ChatClient } from '../../api/chatClient';

/**
 * The thread id goes into the address as one path segment, whatever it holds.
 *
 * The id is the backend's to mint. Written into the path as it stands, an id
 * with `/` or `?` in it gave an address that names another path, or a query.
 */
const ID = 'ny/tråd?x=1';

vi.mock('../../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api')>();
  return {
    ...actual,
    createChatClient: (): ChatClient => {
      const inner = actual.createChatClient();
      return {
        ask: (params) => inner.ask(params),
        listThreads: (signal) => inner.listThreads(signal),
        getThread: (id, signal) => inner.getThread(id, signal),
        listFacets: (signal, selection) => inner.listFacets(signal, selection),
        openThread: (thread, certainty) => inner.openThread?.(thread, certainty),
        createThread: async (thread) => ({ ...thread, id: ID, conversationId: ID }),
      };
    },
  };
});

const { App } = await import('../../App');

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
document.getAnimations ??= () => [];

describe('adressen til en tråd', () => {
  it('har id-en som ett segment, også når den har skråstrek og spørsmålstegn', async () => {
    window.history.replaceState(null, '', '/');
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    const field = screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' });
    fireEvent.change(field, { target: { value: 'Hva rapporterer Nkom?' } });
    act(() => screen.getByRole('button', { name: 'Send spørsmålet' }).click());

    await waitFor(() =>
      expect(window.location.pathname + window.location.search).toBe(
        `/threads/${encodeURIComponent(ID)}`,
      ),
    );
  });
});
