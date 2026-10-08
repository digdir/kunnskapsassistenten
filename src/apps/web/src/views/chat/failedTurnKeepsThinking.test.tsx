import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatClient } from '../../api';
import { MockChatClient } from '../../api/mock/MockChatClient';
import { resetMockThreads } from '../../api/mock/sessionThreads';
import { threads } from '../../api/mock/fixtures';
import type { Message } from '../../model';
import { MessageList } from './MessageList';
import { FAILED_NOTE, REGENERATE } from './text';
import { useChat } from './useChat';

/**
 * Tenkepanelet på feilstien (brukerblikk 4, funn 3).
 *
 * Mens spørsmålet går, står «Tenker …» med steget for dette spørsmålet. I det
 * feilkortet kom, var panelet borte: leseren satt igjen med spørsmålet, feilen,
 * og ingenting om hva som ble forsøkt — på den ene stien der det er mest verdt
 * å se. Et vellykket svar beholder sitt panel.
 *
 * Årsaken var at en feilet tur med tom tekst ble tatt ut av samtalen, og
 * stegene fulgte med ut.
 */

const client = new MockChatClient({
  thinkingStepMs: 5,
  firstTokenMs: 50,
  tokenMs: 5,
  sourcesMs: 10,
  requestMs: 0,
});

const nkom = threads.find((thread) => thread.id === 'nkom-maaloppnaaelse')!;
const FEILSPOERSMAAL = 'simuler feil';

const answers = (messages: Message[]) => messages.filter((m) => m.role === 'assistant');

beforeEach(() => {
  resetMockThreads();
});

describe('en feilet tur beholder tenkepanelet', () => {
  it('lar turen stå med stegene sine når feilen lander', async () => {
    client.openThread(nkom);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send(FEILSPOERSMAAL));
    await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 5000 });

    /*
     * Turen ble tatt ut her før. Nå står den, med stegene som var sendt, så
     * panelet tegnes over feilen slik det tegnes over et svar.
     */
    const feilet = answers(result.current.messages).at(-1);
    expect(feilet?.status).toBe('error');
    expect(feilet?.thinkingSteps?.length).toBeGreaterThan(0);
    expect(feilet?.content).toBe('');
  });

  it('viser stegene fra dette spørsmålet, ikke fra et annet', async () => {
    // #81 ga feilstien sitt eget tenkesteg. Panelet som blir stående skal
    // vise det, ikke NKOM-fixturens første steg.
    client.openThread(nkom);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send(FEILSPOERSMAAL));
    await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 5000 });

    const steg = answers(result.current.messages).at(-1)?.thinkingSteps ?? [];
    expect(steg).toHaveLength(1);
    expect(steg[0]?.label).not.toBe('Jeg deler spørsmålet i to.');
  });

  it('tar turen ut når det ikke finnes noe å vise', async () => {
    /*
     * Grensen som står igjen fra før, og grunnen til at den står: en tur uten
     * tekst OG uten steg har ingenting i seg, og en <li> som bare inneholder
     * den skjulte «Kunnskapsassistenten svarte:» forteller en skjermleser at
     * assistenten svarte noe.
     *
     * Mocken sender alltid et steg først, så tilfellet må lages her: en
     * klient som feiler før noe har skjedd.
     */
    const stumClient: ChatClient = {
      // oxlint-disable-next-line require-yield
      async *ask() {
        throw new Error('nede');
      },
      listThreads: async () => [],
      getThread: async () => null,
      listFacets: async () => [],
    };

    const { result } = renderHook(() => useChat(stumClient));

    act(() => result.current.send('Hva sier rapporten?'));
    await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 5000 });

    expect(answers(result.current.messages)).toHaveLength(0);
  });

  it('overlever en oppfriskning, med stegene og et kort som sier hva som skjedde', async () => {
    /*
     * Feil ble ikke lagret i det hele tatt før: ingen av de to feilstiene i
     * mocken kalte recordMockTurn, så en oppfriskning ga en tråd uten
     * spørsmålet engang. Nå skrives turen ned som de stoppede gjør.
     */
    client.openThread(nkom);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send(FEILSPOERSMAAL));
    await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 5000 });

    const lagret = (await client.getThread(nkom.id))!.messages.slice(-2);
    expect(lagret.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(lagret[0].content).toBe(FEILSPOERSMAAL);
    expect(lagret[1].status).toBe('error');
    expect(lagret[1].thinkingSteps?.length).toBeGreaterThan(0);
  });
});

describe('kortet på en feilet tur', () => {
  const failed: Message = {
    id: 'a1',
    role: 'assistant',
    content: '',
    createdAt: '2026-09-21T09:00:00Z',
    citations: [],
    thinkingSteps: [{ id: 's1', kind: 'search', label: 'Jeg søker i korpuset.', durationMs: 900 }],
    status: 'error',
  };

  function show(liveErrorId?: string) {
    return render(
      <MessageList
        liveErrorId={liveErrorId}
        messages={[failed]}
        onRegenerate={() => {}}
        onSelectSource={() => {}}
      />,
    );
  }

  it('tier mens varselet under samtalen er om denne turen', () => {
    // Varselet sier hva som gikk galt og gir veien videre. To utsagn om det
    // samme er ett for mye.
    show('a1');

    expect(screen.queryByText(FAILED_NOTE)).toBeNull();
    expect(screen.getByText('Jeg søker i korpuset.')).toBeTruthy();
  });

  it('sier fra når varselet ikke lenger gjelder den', () => {
    // Etter en oppfriskning, eller når leseren har spurt om noe siden. Da er
    // kortet det eneste som kan si hvorfor det ikke står et svar under
    // spørsmålet, og «Tenkte i 1 sekund» over ingenting er en gåte uten det.
    show(undefined);

    expect(screen.getByText(FAILED_NOTE)).toBeTruthy();
    expect(screen.getByText('Jeg søker i korpuset.')).toBeTruthy();
  });

  it('gir veien videre når varselet er borte, slik den stoppede turen har', () => {
    /*
     * Varselet bar «Prøv igjen» mens det sto. Uten knappen her ville en
     * gjenopprettet feil vært den ene turen i tråden uten noen vei videre i
     * det hele tatt. `retry` finner spørsmålet i samtalen når økta som stilte
     * det er borte (#76), så den virker i en oppfrisket fane.
     */
    show(undefined);

    expect(screen.getByRole('button', { name: REGENERATE })).toBeTruthy();
  });

  it('lar varselet beholde veien videre mens det står', () => {
    // To «prøv igjen» om det samme, ett i varselet og ett i kortet, er ett
    // for mye.
    show('a1');

    expect(screen.queryByRole('button', { name: REGENERATE })).toBeNull();
  });

  it('kaller onRegenerate når knappen trykkes', () => {
    const kall: number[] = [];
    render(
      <MessageList
        messages={[failed]}
        onRegenerate={() => kall.push(1)}
        onSelectSource={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: REGENERATE }));
    expect(kall).toHaveLength(1);
  });
});
