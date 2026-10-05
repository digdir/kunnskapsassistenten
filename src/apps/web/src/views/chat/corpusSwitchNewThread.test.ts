import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockChatClient } from '../../api/mock/MockChatClient';
import { resetMockThreads } from '../../api/mock/sessionThreads';
import type { Message } from '../../model';
import { useChat } from './useChat';

/**
 * Korpusbytte slipper samtalen (KA CC på #131).
 *
 * En tråd hører til korpuset den ble startet i — svarene siterer dokumenter
 * som bare finnes der — så å fortsette den mot et annet ville gitt én samtale
 * med sitater inn i to ulike dokumentsett, uten noe på skjermen som sier
 * hvilket som er hvilket. Trådlista tegnet ett korpus for en tråd som hadde
 * to.
 */
const client = new MockChatClient({
  thinkingStepMs: 0,
  firstTokenMs: 0,
  tokenMs: 0,
  sourcesMs: 0,
  requestMs: 0,
});

const answers = (messages: Message[]) => messages.filter((m) => m.role === 'assistant');

beforeEach(() => {
  resetMockThreads();
});

describe('useChat og korpusbytte', () => {
  it('slipper samtalen når korpuset endres', async () => {
    const { result, rerender } = renderHook(
      ({ corpus }) => useChat(client, [], undefined, corpus),
      {
        initialProps: { corpus: 'mock' },
      },
    );

    act(() => result.current.send('Hva står i årsrapporten?'));
    await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 5000 });
    expect(answers(result.current.messages)).toHaveLength(1);

    rerender({ corpus: 'norquad-mock' });

    // Skjermen er tom: neste spørsmål er begynnelsen på noe, ikke fortsettelsen.
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.status).toBe('idle');
  });

  it('slipper ikke samtalen når korpuset står stille', async () => {
    /*
     * Motstykket til testen over. «Slipp tråden ved bytte» må ikke bli «slipp
     * tråden nå og da»: to spørsmål i samme korpus er én samtale, og en
     * gjenrendring uten endring skal ikke koste leseren det som står der.
     */
    const { result, rerender } = renderHook(
      ({ corpus }) => useChat(client, [], undefined, corpus),
      {
        initialProps: { corpus: 'mock' },
      },
    );

    act(() => result.current.send('Hva står i årsrapporten?'));
    await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 5000 });

    rerender({ corpus: 'mock' });
    rerender({ corpus: 'mock' });

    expect(answers(result.current.messages)).toHaveLength(1);
  });

  it('fortsetter ikke samtalen i backend etter et bytte', async () => {
    /*
     * `conversationId` er det som får neste spørsmål til å bli en fortsettelse
     * hos backend. Blir den stående over et bytte, fortsetter samtalen der
     * selv om skjermen er tom.
     */
    const seen: (string | undefined)[] = [];
    const spy = new MockChatClient({
      thinkingStepMs: 0,
      firstTokenMs: 0,
      tokenMs: 0,
      sourcesMs: 0,
      requestMs: 0,
    });
    const wrapped = {
      ...spy,
      ask: (params: Parameters<typeof spy.ask>[0]) => {
        seen.push(params.conversationId);
        return spy.ask(params);
      },
      listThreads: spy.listThreads.bind(spy),
      getThread: spy.getThread.bind(spy),
      listFacets: spy.listFacets.bind(spy),
      openThread: spy.openThread.bind(spy),
    };

    const { result, rerender } = renderHook(
      ({ corpus }) => useChat(wrapped, [], undefined, corpus),
      { initialProps: { corpus: 'mock' } },
    );

    act(() => result.current.send('Første'));
    await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 5000 });
    act(() => result.current.send('Andre i samme tråd'));
    await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 5000 });
    // Andre spørsmål fortsetter samtalen, som det skal.
    expect(seen[1]).toBeDefined();

    rerender({ corpus: 'norquad-mock' });
    act(() => result.current.send('Etter bytte'));
    await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 5000 });

    expect(seen[2]).toBeUndefined();
  });
});
