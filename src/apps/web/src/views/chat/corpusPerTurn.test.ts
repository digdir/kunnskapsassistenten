import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AskParams, ChatClient } from '../../api';
import { corpusDisplayNameFor } from '../../api';
import { emptyFilterSelection, type Message, type StreamEvent } from '../../model';
import { answerScopeText } from './filterSummary';
import { useChat } from './useChat';

/**
 * Korpuset ligger på turen, ikke på valget (#135 sin modell, denne PR-ens
 * halvdel).
 *
 * Fraskrivelsen og kildepanelet beskrev korpuset som er valgt NÅ. Åpnet
 * leseren en Kudos-tråd mens velgeren sto på Wikipedia, sto feil navn over
 * riktige kilder (KA CC på #129). Nøkkelen kommer fra ramma som avslutter
 * strømmen, for klienten er det eneste som vet hva som faktisk gikk på tråden.
 */
function clientAnswering(corpusKey?: string): { client: ChatClient; asked: AskParams[] } {
  const asked: AskParams[] = [];
  return {
    asked,
    client: {
      async *ask(params): AsyncIterable<StreamEvent> {
        asked.push(params);
        yield { type: 'token', text: 'Svaret.' };
        yield {
          type: 'done',
          messageId: 'm1',
          conversationId: 'c1',
          ...(corpusKey === undefined ? {} : { corpusKey }),
        };
      },
      listThreads: async () => [],
      getThread: async () => null,
      listFacets: async () => [],
    },
  };
}

const answers = (messages: Message[]) => messages.filter((m) => m.role === 'assistant');

describe('korpus per tur', () => {
  it('lagrer nøkkelen fra done-ramma på svaret', async () => {
    const { client } = clientAnswering('kudos-pilot');
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva står i årsrapporten?'));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    expect(answers(result.current.messages).at(-1)?.corpusKey).toBe('kudos-pilot');
  });

  it('tåler at ramma ikke sier noe', async () => {
    /*
     * `undefined` betyr «ikke kjent», aldri «standardkorpuset». En live-stack
     * uten tenant lar backend velge selv, og da kan ingenting på denne sida
     * navngi det som svarte.
     */
    const { client } = clientAnswering(undefined);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva står i årsrapporten?'));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    expect(answers(result.current.messages).at(-1)?.corpusKey).toBeUndefined();
  });

  it('har ingen nøkkel mens svaret strømmer', async () => {
    // Den kommer etter kildene, i ramma som avslutter. Et svar under skriving
    // har ikke fått den ennå, og skal ikke låne den fra valget.
    const held: (() => void)[] = [];
    const client: ChatClient = {
      async *ask(_params: AskParams): AsyncIterable<StreamEvent> {
        void _params;
        yield { type: 'token', text: 'Halv' };
        await new Promise<void>((resolve) => held.push(() => resolve()));
      },
      listThreads: async () => [],
      getThread: async () => null,
      listFacets: async () => [],
    };

    const { result } = renderHook(() => useChat(client));
    act(() => result.current.send('Hva står i årsrapporten?'));
    await waitFor(() => expect(result.current.status).toBe('streaming'));

    const streaming = answers(result.current.messages).at(-1);
    expect(streaming?.status).toBe('streaming');
    expect(streaming?.corpusKey).toBeUndefined();
    act(() => held[0]?.());
  });

  it('beholder nøkkelen som ble lest tilbake med tråden', async () => {
    /*
     * Ved tilbakelesing står nøkkelen på hver melding (fra #135). Den skal
     * ikke røres av at et nytt spørsmål stilles i samme økt.
     */
    const stored: Message[] = [
      {
        id: 'u1',
        role: 'user',
        content: 'Gammelt spørsmål',
        createdAt: '2026-09-20T09:00:00.000Z',
        citations: [],
        status: 'complete',
      },
      {
        id: 'a1',
        role: 'assistant',
        content: 'Gammelt svar.',
        createdAt: '2026-09-20T09:00:05.000Z',
        citations: [],
        corpusKey: 'kudos-pilot',
        status: 'complete',
      },
    ];

    const { client } = clientAnswering('norquad-docs');
    const { result } = renderHook(() => useChat(client, stored));

    act(() => result.current.send('Nytt spørsmål'));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    const both = answers(result.current.messages);
    expect(both.map((message) => message.corpusKey)).toEqual(['kudos-pilot', 'norquad-docs']);
  });
});

describe('linja over svaret', () => {
  const name = corpusDisplayNameFor('kudos-pilot');

  it('skiller korpuset fra fasettene', () => {
    /*
     * To ulike opplysninger, så de tegnes som to: fasettene er det LESEREN
     * huket av, korpuset er hvor svaret ble hentet. Slått sammen til én liste
     * leste «Kudos · Årsrapport · 2023» som tre ting leseren hadde valgt, og
     * én av dem var ikke det (KA CC kan 4 på #138).
     */
    expect(answerScopeText({ ...emptyFilterSelection, year: ['2023'] }, name)).toBe(
      `Avgrenset til: 2023, fra ${name}`,
    );
  });

  it('sier «hentet fra» når ingenting er avgrenset', () => {
    // «Avgrenset til» ville vært feil ord: svaret ble stilt til hele det
    // andre korpuset.
    expect(answerScopeText(emptyFilterSelection, name)).toBe(`Hentet fra ${name}`);
  });

  it('nevner bare fasettene når korpuset er det valgte', () => {
    expect(answerScopeText({ ...emptyFilterSelection, year: ['2023'] }, undefined)).toBe(
      'Avgrenset til: 2023',
    );
  });

  it('tegner ingen linje når det ikke er noe å si', () => {
    expect(answerScopeText(emptyFilterSelection, undefined)).toBeUndefined();
  });
});
