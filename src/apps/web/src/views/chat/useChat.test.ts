import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AskParams, ChatClient } from '../../api';
import {
  emptyFilterSelection,
  type FilterSelection,
  type Message,
  type StreamEvent,
} from '../../model';
import {
  CLARIFICATION_ANNOUNCEMENT,
  NO_HITS_ANNOUNCEMENT,
  NO_HITS_FILTERED,
  NO_HITS_WHOLE_CORPUS,
} from './text';
import { useChat } from './useChat';

/** One `ask` call, held open so a test can decide when the next frame lands. */
type OpenTurn = {
  query: string;
  emit: (event: StreamEvent) => void;
};

/**
 * A client whose streams never end on their own.
 *
 * The real clients are driven by the network, so the interesting states —
 * mid-stream, stopped before the first token, overtaken by a second question
 * — are all about when a frame arrives relative to what the reader does.
 * Cancellation comes back as an `error` frame with code `aborted` rather than
 * a thrown exception, exactly as `MockChatClient` reports it.
 */
function heldClient(): { client: ChatClient; turns: OpenTurn[] } {
  const turns: OpenTurn[] = [];

  async function* ask({ query, signal }: AskParams): AsyncIterable<StreamEvent> {
    const queue: StreamEvent[] = [];
    let wake: (() => void) | null = null;

    turns.push({
      query,
      emit(event) {
        queue.push(event);
        wake?.();
      },
    });

    for (;;) {
      if (signal?.aborted) {
        yield { type: 'error', error: { code: 'aborted', message: 'Svaret ble avbrutt.' } };
        return;
      }
      const next = queue.shift();
      if (next) {
        yield next;
        continue;
      }
      await new Promise<void>((resolve) => {
        wake = resolve;
        signal?.addEventListener('abort', () => resolve(), { once: true });
      });
    }
  }

  return {
    client: {
      ask,
      listThreads: async () => [],
      getThread: async () => null,
      listFacets: async () => [],
    },
    turns,
  };
}

const assistantMessages = (messages: Message[]) =>
  messages.filter((message) => message.role === 'assistant');

describe('useChat', () => {
  it('keeps an answer that was stopped before its first token', async () => {
    const { client } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    expect(assistantMessages(result.current.messages)).toHaveLength(1);

    act(() => result.current.cancel());

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.announcement).toBe('Genereringen ble avbrutt.');
    /*
     * The turn stays, marked as stopped. It used to be dropped, because an
     * answer with no text draws no card — and then the reader who had pressed
     * stop while «Tenker …» was running had no «Generer på nytt» and a
     * sources panel saying they had not asked anything (#4, funn A). Stopping
     * the same turn one word later left both.
     */
    const [answer] = assistantMessages(result.current.messages);
    expect(answer.status).toBe('aborted');
    expect(answer.content).toBe('');
    expect(result.current.messages).toHaveLength(2);
  });

  it('still drops an answer whose turn failed before its first token', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));
    await waitFor(() => expect(turns).toHaveLength(1));

    act(() => turns[0].emit({ type: 'error', error: { code: 'model-unavailable' } }));

    // A failure has the alert to say what happened and to offer the way on,
    // so an empty card above it would say nothing twice.
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(assistantMessages(result.current.messages)).toHaveLength(0);
  });

  it('keeps a partial answer when the reader stops it mid-stream', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));
    await waitFor(() => expect(turns).toHaveLength(1));

    act(() => turns[0].emit({ type: 'token', text: 'Måloppnåelse er ' }));
    await waitFor(() => expect(result.current.status).toBe('streaming'));

    act(() => result.current.cancel());

    await waitFor(() => expect(result.current.status).toBe('idle'));
    const [answer] = assistantMessages(result.current.messages);
    // Stopped, not finished: the sources never came, so the card offers to
    // run again instead of a copy button.
    expect(answer).toMatchObject({ content: 'Måloppnåelse er ', status: 'aborted' });
  });

  it('lets a new question override the turn it interrupted', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Første spørsmål'));
    await waitFor(() => expect(turns).toHaveLength(1));
    act(() => turns[0].emit({ type: 'token', text: 'Starten på svaret ' }));
    await waitFor(() => expect(result.current.status).toBe('streaming'));

    // The follow-up chips stay on screen while an answer streams, so this is
    // two clicks away.
    act(() => result.current.send('Andre spørsmål'));
    await waitFor(() => expect(turns).toHaveLength(2));

    // The first turn's abort lands after the second turn has already said
    // «Henter svar.». It must not put the status back to idle — that would
    // take the stop button away from a generation still running — and it must
    // not announce a cancellation the reader never asked for.
    await waitFor(() => expect(result.current.announcement).toBe('Henter svar.'));
    expect(result.current.status).toBe('pending');

    act(() => turns[1].emit({ type: 'done', messageId: 'm-2', conversationId: 'c-1' }));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    // Both questions and the partial first answer are kept. The second turn
    // finished without a single token, so it holds nothing to show and is
    // gone — the same rule that removes an answer stopped before its first
    // token.
    expect(result.current.messages.map((message) => message.content)).toEqual([
      'Første spørsmål',
      'Starten på svaret ',
      'Andre spørsmål',
    ]);
  });

  it('reports a failed turn once and clears it on retry', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));
    await waitFor(() => expect(turns).toHaveLength(1));

    act(() =>
      turns[0].emit({
        type: 'error',
        error: { code: 'model-unavailable' },
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    // The code, not a sentence: which case it was is what the view needs to
    // pick a heading, a text and whether to offer «Prøv igjen» at all.
    expect(result.current.error).toEqual({ code: 'model-unavailable' });
    expect(result.current.announcement).toBe('');
    expect(assistantMessages(result.current.messages)).toHaveLength(0);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('pending'));
    expect(result.current.error).toBeNull();
    expect(turns[1].query).toBe('Hva er måloppnåelse?');
  });

  it('turns a search that found nothing into a finished answer', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva sier dokumentene om romfart?'));
    await waitFor(() => expect(turns).toHaveLength(1));

    act(() => turns[0].emit({ type: 'error', error: { code: 'no-hits' } }));

    await waitFor(() => expect(result.current.status).toBe('idle'));
    // Not an error: nothing failed, the search just came back empty. A red
    // alert with «Prøv igjen» would offer to ask the same question of the
    // same documents again (brukerreiser punkt 12).
    expect(result.current.error).toBeNull();

    const [answer] = assistantMessages(result.current.messages);
    expect(answer.status).toBe('complete');
    expect(answer.content).toBe(NO_HITS_WHOLE_CORPUS);
    // Empty and not absent: that is what makes the sources panel say the same
    // thing instead of waiting for excerpts that are not coming.
    expect(answer.sources).toEqual([]);
    expect(result.current.announcement).toBe(NO_HITS_ANNOUNCEMENT);
  });

  it('tells the reader to loosen the filter only when there is one', async () => {
    const { client, turns } = heldClient();
    const narrowed: FilterSelection = { ...emptyFilterSelection, organisation: ['nkom'] };
    const { result } = renderHook(() => useChat(client, [], narrowed));

    act(() => result.current.send('Hva sier dokumentene om romfart?'));
    await waitFor(() => expect(turns).toHaveLength(1));

    act(() => turns[0].emit({ type: 'error', error: { code: 'no-hits' } }));

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(assistantMessages(result.current.messages)[0].content).toBe(NO_HITS_FILTERED);
  });

  it('keeps what the agent did write when the search came back empty', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva sier dokumentene om romfart?'));
    await waitFor(() => expect(turns).toHaveLength(1));

    act(() => turns[0].emit({ type: 'token', text: 'Dette står ikke i dokumentene.' }));
    await waitFor(() => expect(result.current.status).toBe('streaming'));
    act(() => turns[0].emit({ type: 'error', error: { code: 'no-hits' } }));

    await waitFor(() => expect(result.current.status).toBe('idle'));
    // The stand-in text is for a turn that said nothing at all. Words that
    // did arrive are the answer, and replacing them would be rewriting it.
    expect(assistantMessages(result.current.messages)[0].content).toBe(
      'Dette står ikke i dokumentene.',
    );
  });

  it('marks a turn the agent ended by asking back', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));
    await waitFor(() => expect(turns).toHaveLength(1));

    act(() => turns[0].emit({ type: 'token', text: 'Mener du årsrapporten?' }));
    act(() =>
      turns[0].emit({
        type: 'done',
        messageId: 'm1',
        conversationId: 'c1',
        outcome: 'needs-clarification',
      }),
    );

    // A finished turn, not a failed one: idle, no error, and the message
    // carries the status the card reads.
    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.error).toBeNull();
    expect(assistantMessages(result.current.messages)[0]?.status).toBe('needs-clarification');
    expect(result.current.announcement).toBe(CLARIFICATION_ANNOUNCEMENT);
  });

  it('treats a done frame without an outcome as a finished answer', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));
    await waitFor(() => expect(turns).toHaveLength(1));

    act(() => turns[0].emit({ type: 'token', text: 'Svaret.' }));
    act(() => turns[0].emit({ type: 'done', messageId: 'm1', conversationId: 'c1' }));

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(assistantMessages(result.current.messages)[0]?.status).toBe('complete');
    expect(result.current.announcement).toBe('Svaret er ferdig.');
  });

  it('says it is searching once, however many steps arrive', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));
    await waitFor(() => expect(turns).toHaveLength(1));

    act(() =>
      turns[0].emit({
        type: 'thinking-step',
        step: { id: 's1', kind: 'reasoning', label: 'Jeg deler spørsmålet i to.' },
      }),
    );
    await waitFor(() => expect(result.current.announcement).toBe('Kunnskapsassistenten søker …'));

    // A dozen more steps must not turn the polite region into a reading of
    // every step; it is still the same sentence when the answer starts.
    act(() =>
      turns[0].emit({
        type: 'thinking-step',
        step: { id: 's2', kind: 'search', label: 'Jeg søker i årsrapportene.' },
      }),
    );
    await waitFor(() => expect(result.current.messages.at(-1)?.thinkingSteps).toHaveLength(2));
    expect(result.current.announcement).toBe('Kunnskapsassistenten søker …');
  });
});

describe('useChat og tråden som kommer for sent', () => {
  const stored = (id: string, role: 'user' | 'assistant', content: string): Message => ({
    id,
    role,
    content,
    createdAt: '2026-09-11T09:05:00.000Z',
    citations: [],
    status: 'complete',
  });

  const lagret = [
    stored('t1-question', 'user', 'Hva er måloppnåelse?'),
    stored('t1-answer', 'assistant', 'Måloppnåelse måles mot tildelingsbrevet.'),
  ];

  const summary = (messages: Message[]) =>
    messages.map((message) => `${message.role}:${message.content}`);

  it('legger den lagrede samtalen foran spørsmålet som ble stilt mens den lastet', async () => {
    const { client, turns } = heldClient();
    // `getThread` har ikke svart ennå: hooken starter uten meldinger.
    const { result, rerender } = renderHook(({ thread }) => useChat(client, thread), {
      initialProps: { thread: [] as Message[] },
    });

    act(() => result.current.send('Hva med DSS?'));
    await waitFor(() => expect(turns).toHaveLength(1));
    act(() => turns[0].emit({ type: 'token', text: 'DSS rapporterer ' }));
    await waitFor(() => expect(result.current.status).toBe('streaming'));

    // Nå lander tråden.
    rerender({ thread: lagret });

    /*
     * Den lagrede samtalen sto der først, så den står først. Turen som var i
     * gang er urørt: spørsmålet, svaret som strømmer, og teksten som alt var
     * kommet.
     */
    expect(summary(result.current.messages)).toEqual([
      'user:Hva er måloppnåelse?',
      'assistant:Måloppnåelse måles mot tildelingsbrevet.',
      'user:Hva med DSS?',
      'assistant:DSS rapporterer ',
    ]);
    expect(result.current.status).toBe('streaming');
  });

  it('tar tråden som den er når leseren ikke har rukket å spørre om noe', async () => {
    const { client } = heldClient();
    const { result, rerender } = renderHook(({ thread }) => useChat(client, thread), {
      initialProps: { thread: [] as Message[] },
    });

    expect(result.current.messages).toHaveLength(0);
    rerender({ thread: lagret });

    expect(summary(result.current.messages)).toEqual([
      'user:Hva er måloppnåelse?',
      'assistant:Måloppnåelse måles mot tildelingsbrevet.',
    ]);
  });

  it('dupliserer ingenting når tråden kommer tilbake med turen som nettopp ble ferdig', async () => {
    const { client, turns } = heldClient();
    const { result, rerender } = renderHook(({ thread }) => useChat(client, thread), {
      initialProps: { thread: [] as Message[] },
    });

    act(() => result.current.send('Hva med DSS?'));
    await waitFor(() => expect(turns).toHaveLength(1));
    act(() => turns[0].emit({ type: 'token', text: 'DSS rapporterer.' }));
    act(() => turns[0].emit({ type: 'done', messageId: 'm1', conversationId: 'c1' }));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    /*
     * Mocken skriver et ferdig svar inn i lageret under den id-en den nettopp
     * strømmet (`recordMockTurn`), så en tråd som svarer etterpå bærer turen
     * tilbake. Den er alt på skjermen, og skal ikke inn en gang til.
     */
    const live = result.current.messages;
    const svarId = live.at(-1)!.id;
    rerender({
      thread: [
        ...lagret,
        stored(`${svarId}-question`, 'user', 'Hva med DSS?'),
        { ...stored(svarId, 'assistant', 'DSS rapporterer.'), id: svarId },
      ],
    });

    const ids = result.current.messages.map((message) => message.id);
    expect(new Set(ids).size, ids.join(', ')).toBe(ids.length);
    // Svaret som står på skjermen er det som ble strømmet, ikke en kopi fra
    // lageret lagt oppå.
    expect(result.current.messages.filter((message) => message.id === svarId)).toHaveLength(1);
  });

  it('lar en tråd som lander etter at turen er ferdig legge seg foran den', async () => {
    const { client, turns } = heldClient();
    const { result, rerender } = renderHook(({ thread }) => useChat(client, thread), {
      initialProps: { thread: [] as Message[] },
    });

    act(() => result.current.send('Hva med DSS?'));
    await waitFor(() => expect(turns).toHaveLength(1));
    act(() => turns[0].emit({ type: 'token', text: 'DSS rapporterer.' }));
    act(() => turns[0].emit({ type: 'done', messageId: 'm1', conversationId: 'c1' }));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    rerender({ thread: lagret });

    // Rekkefølgen er den samme om tråden kommer midt i turen eller etter den.
    expect(summary(result.current.messages)).toEqual([
      'user:Hva er måloppnåelse?',
      'assistant:Måloppnåelse måles mot tildelingsbrevet.',
      'user:Hva med DSS?',
      'assistant:DSS rapporterer.',
    ]);
  });

  it('legger ikke den samme tråden inn to ganger når den rekkes over på nytt', async () => {
    const { client, turns } = heldClient();
    const { result, rerender } = renderHook(({ thread }) => useChat(client, thread), {
      initialProps: { thread: [] as Message[] },
    });

    act(() => result.current.send('Hva med DSS?'));
    await waitFor(() => expect(turns).toHaveLength(1));
    act(() => turns[0].emit({ type: 'token', text: 'DSS rapporterer ' }));
    await waitFor(() => expect(result.current.status).toBe('streaming'));

    rerender({ thread: lagret });
    // Samme tråd, ny array: en referansesjekk ville sagt «en ny tråd».
    rerender({ thread: [...lagret] });

    expect(summary(result.current.messages)).toEqual([
      'user:Hva er måloppnåelse?',
      'assistant:Måloppnåelse måles mot tildelingsbrevet.',
      'user:Hva med DSS?',
      'assistant:DSS rapporterer ',
    ]);
  });
});

describe('useChat og tida ramma bærer', () => {
  /*
   * En tid ingen klokke kan finne på å produsere, så testen ikke kan bli
   * grønn ved flaks. Det er nettopp flaksen som er faren her: lager og skjerm
   * stempler millisekunder fra hverandre, så en test som bare sammenlikner to
   * klokker er grønn med feilen på plass (målt).
   */
  const RAMMENS_TID = '2011-11-11T11:11:11.111Z';

  const svaret = (messages: Message[]) =>
    messages.filter((message) => message.role === 'assistant').at(-1);

  it('tar tida fra done-ramma i stedet for sin egen klokke', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));
    await waitFor(() => expect(turns).toHaveLength(1));
    act(() => turns[0].emit({ type: 'token', text: 'Svaret.' }));
    act(() =>
      turns[0].emit({
        type: 'done',
        messageId: 'm1',
        conversationId: 'c1',
        createdAt: RAMMENS_TID,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(svaret(result.current.messages)?.createdAt).toBe(RAMMENS_TID);
  });

  it('tar tida fra error-ramma når leseren stoppet turen', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));
    await waitFor(() => expect(turns).toHaveLength(1));
    act(() => turns[0].emit({ type: 'token', text: 'Måloppnåelse er ' }));
    act(() =>
      turns[0].emit({
        type: 'error',
        error: { code: 'aborted' },
        createdAt: RAMMENS_TID,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('idle'));
    const answer = svaret(result.current.messages);
    expect(answer?.status).toBe('aborted');
    expect(answer?.createdAt).toBe(RAMMENS_TID);
  });

  it('tar tida fra error-ramma når søket ikke fant noe', async () => {
    // `no-hits` er ikke en feil: det er et ferdig svar med tom kildeliste, og
    // det tegnes med tidsstempel som et hvilket som helst annet svar.
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));
    await waitFor(() => expect(turns).toHaveLength(1));
    act(() =>
      turns[0].emit({
        type: 'error',
        error: { code: 'no-hits' },
        createdAt: RAMMENS_TID,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('idle'));
    const answer = svaret(result.current.messages);
    expect(answer?.status).toBe('complete');
    expect(answer?.createdAt).toBe(RAMMENS_TID);
  });

  it('bruker sin egen klokke når ramma ikke bærer noen tid', async () => {
    // En levende backend som ikke rapporterer feltet skal ikke gi et svar
    // uten tid; da er klokka her det nærmeste som finnes.
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));
    await waitFor(() => expect(turns).toHaveLength(1));
    const foer = Date.now();
    act(() => turns[0].emit({ type: 'token', text: 'Svaret.' }));
    act(() => turns[0].emit({ type: 'done', messageId: 'm1', conversationId: 'c1' }));

    await waitFor(() => expect(result.current.status).toBe('idle'));
    const satt = Date.parse(svaret(result.current.messages)!.createdAt);
    expect(satt).toBeGreaterThanOrEqual(foer);
    expect(satt).toBeLessThanOrEqual(Date.now());
  });
});
