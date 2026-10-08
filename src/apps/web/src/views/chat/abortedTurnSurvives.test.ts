import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockChatClient } from '../../api/mock/MockChatClient';
import { resetMockThreads } from '../../api/mock/sessionThreads';
import { threads } from '../../api/mock/fixtures';
import type { Message } from '../../model';
import { useChat } from './useChat';

/**
 * En stoppet tur, og veien gjennom en oppfriskning.
 *
 * To hull, funnet av KA CC på #71. Mocken lagret bare turer det var kommet
 * tekst i, så den som ble stoppet i tenkefasen var borte etter en
 * oppfriskning — etter #59 tegnes kortet med «Generer på nytt» også når
 * ingenting kom, så leseren så et kort som ikke overlevde. Og turen ble lagret
 * som `complete`, fra den gangen `useChat` settlet den slik; etter #4 sin funn
 * A gjør den ikke det, så et halvt svar kom tilbake forkledd som et ferdig.
 */

/*
 * Sakte nok til at turen kan stoppes midt i. `firstTokenMs` er hele vinduet
 * der turen er i tenkefasen, og det er nettopp der den tomme stoppede turen
 * lever.
 */
const client = new MockChatClient({
  thinkingStepMs: 5,
  firstTokenMs: 400,
  tokenMs: 5,
  sourcesMs: 10,
  requestMs: 0,
});

const nkom = threads.find((thread) => thread.id === 'nkom-maaloppnaaelse')!;
const SPOERSMAAL = 'Hvordan jobber Nkom med måloppnåelse?';

const answers = (messages: Message[]) => messages.filter((m) => m.role === 'assistant');

/**
 * Turen en oppfriskning ville lest tilbake, som det siste paret i tråden.
 *
 * Nkom-tråden har to meldinger fra fixturen fra før, og de er ikke det disse
 * testene handler om: det er turen som nettopp ble stoppet som skal ha
 * overlevd.
 */
async function lastTurnAfterReload() {
  const thread = await client.getThread(nkom.id);
  return thread!.messages.slice(-2);
}

beforeEach(() => {
  resetMockThreads();
});

describe('en stoppet tur overlever en oppfriskning', () => {
  it('lagrer turen som ble stoppet før første ord', async () => {
    client.openThread(nkom);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send(SPOERSMAAL));
    // Stopp mens «Tenker …» fortsatt går: ingen tekst er kommet.
    await waitFor(() => expect(result.current.status).toBe('pending'));
    expect(answers(result.current.messages)[0]?.content).toBe('');

    act(() => result.current.cancel());
    await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 5000 });

    const paaSkjermen = answers(result.current.messages);
    expect(paaSkjermen).toHaveLength(1);
    expect(paaSkjermen[0]).toMatchObject({ content: '', status: 'aborted' });

    // Ett spørsmål og ett svar, og svaret er fortsatt stoppet: det er dette
    // som gir ett kort med «Generer på nytt» etter oppfriskningen.
    const lagret = await lastTurnAfterReload();
    expect(lagret.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(lagret[0].content).toBe(SPOERSMAAL);
    expect(lagret[1]).toMatchObject({ content: '', status: 'aborted' });
  });

  it('lagrer en tur som rakk noen ord som stoppet, ikke som ferdig', async () => {
    client.openThread(nkom);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send(SPOERSMAAL));
    await waitFor(
      () => expect(answers(result.current.messages)[0]?.content.length).toBeGreaterThan(0),
      {
        timeout: 5000,
      },
    );

    act(() => result.current.cancel());
    await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 5000 });

    const lagret = await lastTurnAfterReload();
    /*
     * `aborted` og ikke `complete`. Lagret som ferdig ville det halve svaret
     * kommet tilbake med «Kopier svaret» og avslutningsspørsmålet, og uten
     * veien videre leseren faktisk trenger.
     */
    expect(lagret[1]).toMatchObject({ status: 'aborted' });
    expect(lagret[1].content.length).toBeGreaterThan(0);
  });

  it('lar «Generer på nytt» sende spørsmålet igjen i en frisk økt', async () => {
    /*
     * Ingen har sendt noe i denne økta — det er nettopp det en oppfriskning
     * er. `lastQuestionRef` er tom, og retry leste bare den, så knappen på
     * det gjenopprettede kortet gjorde ingenting.
     */
    const lagret: Message[] = [
      {
        id: 'u1',
        role: 'user',
        content: SPOERSMAAL,
        createdAt: '2026-09-15T09:00:00.000Z',
        citations: [],
        status: 'complete',
      },
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        createdAt: '2026-09-15T09:00:05.000Z',
        citations: [],
        status: 'aborted',
      },
    ];

    client.openThread(nkom);
    const { result } = renderHook(() => useChat(client, lagret));

    act(() => result.current.retry());

    // Den stoppede turen er byttet ut, ikke stablet på, og spørsmålet er
    // hentet fra tråden.
    await waitFor(() => expect(result.current.status).not.toBe('idle'));
    expect(result.current.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(result.current.messages[0].content).toBe(SPOERSMAAL);

    await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 10000 });
    const svaret = answers(result.current.messages).at(-1);
    expect(svaret?.status).toBe('complete');
    expect(svaret?.content.length).toBeGreaterThan(0);
  });

  it('rører ikke en eldre stoppet tur lenger opp i tråden', async () => {
    /*
     * Følgen av at stoppede turer nå overlever: det kan ligge en fra i går
     * lenger opp. «Generer på nytt» på den nederste skal bytte ut den
     * nederste, ikke rydde bort alt som en gang ble stoppet.
     */
    const iGaar: Message[] = [
      {
        id: 'u0',
        role: 'user',
        content: 'Et gammelt spørsmål',
        createdAt: '2026-09-14T09:00:00.000Z',
        citations: [],
        status: 'complete',
      },
      {
        id: 'a0',
        role: 'assistant',
        content: 'Et halvt gammelt svar',
        createdAt: '2026-09-14T09:00:05.000Z',
        citations: [],
        status: 'aborted',
      },
      {
        id: 'u1',
        role: 'user',
        content: SPOERSMAAL,
        createdAt: '2026-09-15T09:00:00.000Z',
        citations: [],
        status: 'complete',
      },
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        createdAt: '2026-09-15T09:00:05.000Z',
        citations: [],
        status: 'aborted',
      },
    ];

    client.openThread(nkom);
    const { result } = renderHook(() => useChat(client, iGaar));

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).not.toBe('idle'));

    // Den gamle står der fortsatt, uendret.
    expect(result.current.messages[1]).toMatchObject({
      id: 'a0',
      content: 'Et halvt gammelt svar',
      status: 'aborted',
    });
    // Og den nederste er byttet ut med én ny tur, ikke stablet.
    expect(result.current.messages).toHaveLength(4);
    expect(result.current.messages.at(-1)?.status).toBe('streaming');
  });
  it('tar tenkepanelet med seg gjennom oppfriskningen', async () => {
    /*
     * Brukerblikk 3, funn 6. Turen overlevde, tidsstemplet også, men
     * tenkepanelet var borte: «Tenkte i 6 sekunder» før, ingenting etter.
     * Det er nettopp den delen leseren som stoppet FORDI det tok tid satt og
     * så på.
     */
    client.openThread(nkom);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send(SPOERSMAAL));
    // Vent til minst ett tenkesteg har kommet, ellers er det ingenting å ta
    // vare på.
    await waitFor(
      () => expect(answers(result.current.messages)[0]?.thinkingSteps?.length).toBeGreaterThan(0),
      { timeout: 5000 },
    );

    act(() => result.current.cancel());
    await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 5000 });

    const paaSkjermen = answers(result.current.messages).at(-1);
    const lagret = (await lastTurnAfterReload())[1];

    // Samme steg, i samme rekkefølge: panelet tegner det samme begge steder.
    expect(lagret.thinkingSteps?.map((step) => step.id)).toEqual(
      paaSkjermen?.thinkingSteps?.map((step) => step.id),
    );
    expect(lagret.thinkingSteps?.length).toBeGreaterThan(0);
  });

  it('gir ikke den stoppede turen en måling skjermen ikke har', async () => {
    /*
     * Runde 2 punkt 5 igjen, i en ny form. Stoppet før første ord har den
     * levende turen ingen `thoughtMs` — panelet faller tilbake på summen av
     * stegenes egne varigheter. Skrev lageret inn en målt tid her, ville
     * samme tur sagt to forskjellige tall før og etter en oppfriskning.
     */
    client.openThread(nkom);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send(SPOERSMAAL));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    expect(answers(result.current.messages)[0]?.content).toBe('');

    act(() => result.current.cancel());
    await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 5000 });

    const paaSkjermen = answers(result.current.messages).at(-1);
    const lagret = (await lastTurnAfterReload())[1];

    expect(paaSkjermen?.thoughtMs).toBeUndefined();
    expect(lagret.thoughtMs).toBeUndefined();
  });
});
