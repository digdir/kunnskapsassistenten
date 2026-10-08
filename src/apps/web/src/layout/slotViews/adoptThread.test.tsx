import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatClient } from '../../api/chatClient';
import type { Thread } from '../../model';

/**
 * Vakta mot å gi en leser som har gått videre en adresse de forlot.
 *
 * Skallet spør klienten hva tråden egentlig heter og flytter adressen dit når
 * svaret kommer. I live er det et nettverkskall, så det er et ekte vindu: i
 * mellomtida kan leseren ha byttet korpus, og da er tråden sluppet. Uten
 * vakta ville adressen blitt skrevet om til en samtale som ikke lenger er på
 * skjermen.
 *
 * `createThread` er det eneste som er byttet ut; resten av klienten er den
 * ekte mocken, så alt annet i flyten oppfører seg som det pleier.
 */
const deferred = vi.hoisted(() => {
  let settle: (thread: Thread | undefined) => void = () => {};
  const promise = new Promise<Thread | undefined>((resolve) => {
    settle = resolve;
  });
  return { promise, settle: (thread: Thread | undefined) => settle(thread) };
});

const opened = vi.hoisted(() => ({ threads: [] as string[] }));

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
        openThread: (thread, certainty) => {
          opened.threads.push(thread.id);
          inner.openThread?.(thread, certainty);
        },
        createThread: () => deferred.promise,
      };
    },
  };
});

const { App } = await import('../../App');
const { setActiveCorpusKey } = await import('../../api');

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
document.getAnimations ??= () => [];

afterEach(() => vi.unstubAllEnvs());

describe('adopsjon av den ekte tråd-id-en', () => {
  it('lar adressen være når leseren har gått videre imens', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    const field = screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' });
    fireEvent.change(field, { target: { value: 'Hva rapporterer Nkom?' } });
    act(() => screen.getByRole('button', { name: 'Send spørsmålet' }).click());

    const standIn = window.location.pathname;
    expect(standIn).toMatch(/^\/threads\//);

    // Leseren bytter korpus, som slipper tråden denne sida startet.
    act(() => setActiveCorpusKey('norquad-mock'));

    // Og FØRST DA kommer klienten tilbake med det ekte navnet.
    act(() =>
      deferred.settle({
        id: 'backend-id-som-kom-for-sent',
        title: 'Hva rapporterer Nkom?',
        createdAt: '2026-09-23T08:00:00.000Z',
        updatedAt: '2026-09-23T08:00:00.000Z',
        conversationId: 'backend-id-som-kom-for-sent',
      }),
    );

    await waitFor(() => expect(deferred.promise).resolves.toBeDefined());

    expect(window.location.pathname).toBe(standIn);
    expect(opened.threads).not.toContain('backend-id-som-kom-for-sent');
  });
});
