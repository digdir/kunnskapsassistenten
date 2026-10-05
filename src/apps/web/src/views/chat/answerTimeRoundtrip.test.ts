import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MOCK_CLARIFICATION_QUERY, MockChatClient } from '../../api/mock/MockChatClient';
import { resetMockThreads } from '../../api/mock/sessionThreads';
import { threads } from '../../api/mock/fixtures';
import type { Message } from '../../model';
import { useChat } from './useChat';

/**
 * Tida på svaret, hele veien rundt: stilt, strømmet, lagret, lastet igjen.
 *
 * Feilen dette dekker (KA CC på #71): svaret ble stemplet to steder. `useChat`
 * stemplet plassholderen da spørsmålet ble sendt, og lageret stemplet turen da
 * den ble skrevet ned — hele svarets lengde senere. Et svar som sa «14:32» på
 * skjermen sa «14:32:15» etter en oppfriskning, uten at noe hadde endret seg.
 *
 * Nå lages tida ett sted, i `done`-ramma, og begge leser den derfra.
 */
/*
 * Med forsinkelse, og det er poenget med den.
 *
 * Feilen er at svaret ble stemplet i to ender av det samme svaret, så den er
 * bare synlig når det tar tid å svare. Med null forsinkelse faller «da
 * spørsmålet ble sendt» og «da turen ble skrevet ned» i det samme
 * millisekundet, og en test som kjører instant ville vært grønn med feilen på
 * plass — den ble målt grønn slik før tallene her ble satt.
 *
 * `SVARTID_MS` er nedre grense for hvor lang en tur er, og testene måler mot
 * den: stempelet skal ha flyttet seg minst så langt fra sendetidspunktet.
 */
const SVARTID_MS = 60;

const client = new MockChatClient({
  thinkingStepMs: 10,
  firstTokenMs: 50,
  tokenMs: 0,
  sourcesMs: 20,
  requestMs: 0,
});

const nkom = threads.find((thread) => thread.id === 'nkom-maaloppnaaelse')!;

const svaret = (messages: Message[]) =>
  messages.filter((message) => message.role === 'assistant').at(-1);

beforeEach(() => {
  resetMockThreads();
});

describe('tidsstempelet på svaret overlever en oppfriskning', () => {
  it('har samme datetime på skjermen og i lageret, ned til millisekundet', async () => {
    client.openThread(nkom);
    const startet = Date.now();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hvordan jobber Nkom med måloppnåelse?'));
    await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 5000 });

    const paaSkjermen = svaret(result.current.messages);
    expect(paaSkjermen?.status).toBe('complete');

    // Det lageret har: nøyaktig det en oppfriskning ville lest tilbake.
    const lagret = await client.getThread(nkom.id);
    const gjenopprettet = svaret(lagret!.messages);

    // Samme streng, ikke bare samme sekund: `datetime` er full ISO med
    // millisekunder, og det er den attributten som skal overleve uendret.
    expect(gjenopprettet?.createdAt).toBe(paaSkjermen?.createdAt);
    // Og turen tok faktisk tid, så testen hadde noe å ta feil av.
    expect(Date.parse(paaSkjermen!.createdAt) - startet).toBeGreaterThanOrEqual(SVARTID_MS);
  });

  it('stempler svaret da det ble ferdig, ikke da spørsmålet ble sendt', async () => {
    client.openThread(nkom);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hvordan jobber Nkom med måloppnåelse?'));

    // Plassholderen finnes med en gang, og bærer sendetidspunktet.
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    const vedSending = svaret(result.current.messages)!.createdAt;

    await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 5000 });
    const vedFerdig = svaret(result.current.messages)!.createdAt;

    /*
     * Stempelet har flyttet seg et helt svar bortover. Det er nettopp den
     * avstanden som var feilen: skjermen viste sendetidspunktet og lageret
     * nedskrivingstidspunktet, og de to er så langt fra hverandre.
     */
    expect(vedFerdig).not.toBe(vedSending);
    expect(Date.parse(vedFerdig) - Date.parse(vedSending)).toBeGreaterThanOrEqual(SVARTID_MS);

    const lagret = await client.getThread(nkom.id);
    expect(svaret(lagret!.messages)?.createdAt).toBe(vedFerdig);
  });

  it('gjelder også en tur som spurte tilbake', async () => {
    client.openThread(nkom);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send(MOCK_CLARIFICATION_QUERY));
    await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 5000 });

    const paaSkjermen = svaret(result.current.messages);
    expect(paaSkjermen?.status).toBe('needs-clarification');

    const lagret = await client.getThread(nkom.id);
    expect(svaret(lagret!.messages)?.createdAt).toBe(paaSkjermen?.createdAt);
  });
  it('gjelder også en tur leseren stoppet underveis', async () => {
    /*
     * En stoppet tur ender på `error`-ramma og ikke på `done`, og lageret
     * skriver den ned som et ferdig svar — det er det leseren så da de
     * oppfrisket. Så ramma bærer tida på samme måte, fra den samme kilden.
     */
    client.openThread(nkom);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hvordan jobber Nkom med måloppnåelse?'));
    // Vent til noe tekst har kommet: en tur stoppet før første ord lagres
    // ikke, og da er det ingenting å sammenlikne.
    await waitFor(
      () => expect(svaret(result.current.messages)?.content.length).toBeGreaterThan(0),
      {
        timeout: 5000,
      },
    );

    act(() => result.current.cancel());
    await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 5000 });

    const paaSkjermen = svaret(result.current.messages);
    expect(paaSkjermen?.status).toBe('aborted');

    const lagret = await client.getThread(nkom.id);
    expect(svaret(lagret!.messages)?.createdAt).toBe(paaSkjermen?.createdAt);
  });
});
