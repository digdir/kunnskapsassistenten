import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AskParams, ChatClient } from '../../api';
import type { Message, StreamEvent } from '../../model';
import { chatErrorText } from './errorText';
import { SLOW_ANSWER_NOTICE } from './text';
import { SLOW_ANSWER_MS, STALLED_ANSWER_MS, useChat } from './useChat';

/**
 * A turn that never arrives: the stream that closes with nothing in it, the
 * one that goes quiet for half a minute, and the one that goes quiet for two.
 * Everything here is about WHEN a frame lands, so the clock is stubbed and
 * the streams are driven by hand.
 */

/** One `ask` call held open, so the test decides when the next frame lands. */
type OpenTurn = {
  emit: (event: StreamEvent) => void;
  /** The signal it was asked with, to see that the client stopped it itself. */
  signal: AbortSignal | undefined;
};

/** Reports an abort as an `error` frame, the way the real clients do. */
function heldClient(): { client: ChatClient; turns: OpenTurn[] } {
  const turns: OpenTurn[] = [];

  async function* ask({ signal }: AskParams): AsyncIterable<StreamEvent> {
    const queue: StreamEvent[] = [];
    let wake: (() => void) | null = null;

    turns.push({
      signal,
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

  return { client: asChatClient(ask), turns };
}

/** The other half of the pair: a client that throws on abort instead. The
    hook has to read both the same way. */
function throwingClient(): ChatClient {
  async function* ask({ signal }: AskParams): AsyncIterable<StreamEvent> {
    await new Promise<void>((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
    yield { type: 'done', messageId: 'm1', conversationId: 'c1' };
  }

  return asChatClient(ask);
}

/** A stream that yields what it is given and then simply ends: no `done`
    frame, no error, which is what a writer that fell over leaves behind. */
function closingClient(events: StreamEvent[]): ChatClient {
  async function* ask(): AsyncIterable<StreamEvent> {
    for (const event of events) yield event;
  }

  return asChatClient(ask);
}

function asChatClient(ask: ChatClient['ask']): ChatClient {
  return {
    ask,
    listThreads: async () => [],
    getThread: async () => null,
    listFacets: async () => [],
  };
}

/** One step from the agent, the shape the stream carries. */
const searchStep = {
  id: 's1',
  kind: 'search',
  label: 'Jeg søker i dokumentene.',
  durationMs: 900,
} as const;

const assistantMessages = (messages: Message[]) =>
  messages.filter((message) => message.role === 'assistant');

/** Lets the held stream run to its next await, without moving the clock. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a stream that closes without a `done` frame', () => {
  it('is a failure and not a finished answer, when nothing was written', async () => {
    const { result } = renderHook(() => useChat(closingClient([])));

    act(() => result.current.send('Hva sier årsrapportene om måloppnåelse?'));
    await settle();

    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe('unknown');
    // The sentence the reader gets, and the one a screen reader must not:
    // «Svaret er ferdig.» over a turn that wrote nothing is the one thing
    // that is certainly not true.
    expect(chatErrorText(result.current.error!).title).toBe('Svaret kom ikke fram');
    expect(result.current.announcement).toBe('');
  });

  it('keeps the turn, so the reader can ask again, when it got as far as a step', async () => {
    const client = closingClient([{ type: 'thinking-step', step: searchStep }]);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva sier årsrapportene om måloppnåelse?'));
    await settle();

    expect(result.current.status).toBe('error');
    // `error` and not `complete`: the card under the question is what offers
    // «Generer på nytt» once the alert has stopped speaking for the turn.
    expect(assistantMessages(result.current.messages)[0]?.status).toBe('error');
  });

  it('leaves an answer that was written alone', async () => {
    const client = closingClient([{ type: 'token', text: 'Måloppnåelsen er omtalt.' }]);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva sier årsrapportene om måloppnåelse?'));
    await settle();

    expect(result.current.status).toBe('idle');
    expect(assistantMessages(result.current.messages)[0]?.status).toBe('complete');
    expect(result.current.announcement).toContain('Svaret er ferdig.');
  });
});

describe('a turn that goes quiet', () => {
  it('says so after the first limit, while the turn keeps running', async () => {
    const { result } = renderHook(() => useChat(heldClient().client));

    act(() => result.current.send('Hva sier årsrapportene om måloppnåelse?'));
    await settle();
    expect(result.current.slowAnswer).toBe(false);

    await wait(SLOW_ANSWER_MS);

    expect(result.current.slowAnswer).toBe(true);
    expect(result.current.announcement).toBe(SLOW_ANSWER_NOTICE);
    // Still running: the line is a remark about the wait, and «Avbryt» in
    // the field is still what ends it.
    expect(result.current.status).toBe('pending');
  });

  it('starts the clock over on every step and every word', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva sier årsrapportene om måloppnåelse?'));
    await settle();

    await wait(SLOW_ANSWER_MS - 1000);
    act(() => turns[0]?.emit({ type: 'thinking-step', step: searchStep }));
    await settle();

    // A second before the first clock would have run out, had the step not
    // landed.
    await wait(SLOW_ANSWER_MS - 1000);
    expect(result.current.slowAnswer).toBe(false);

    await wait(1000);
    expect(result.current.slowAnswer).toBe(true);
  });

  it('takes the line back when the turn moves again', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva sier årsrapportene om måloppnåelse?'));
    await settle();
    await wait(SLOW_ANSWER_MS);
    expect(result.current.slowAnswer).toBe(true);

    act(() => turns[0]?.emit({ type: 'token', text: 'Første avsnitt.\n\n' }));
    await settle();

    expect(result.current.slowAnswer).toBe(false);
  });

  it('is read out once, however many quiet stretches the turn has', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva sier årsrapportene om måloppnåelse?'));
    await settle();
    await wait(SLOW_ANSWER_MS);
    expect(result.current.announcement).toBe(SLOW_ANSWER_NOTICE);

    act(() => turns[0]?.emit({ type: 'token', text: 'Første avsnitt.\n\n' }));
    await settle();
    expect(result.current.announcement).toBe('Første avsnitt.');

    await wait(SLOW_ANSWER_MS);

    // The line is back on screen, because the turn is quiet again — but the
    // polite region has already said its piece for this turn.
    expect(result.current.slowAnswer).toBe(true);
    expect(result.current.announcement).toBe('Første avsnitt.');
  });
});

describe('the limit', () => {
  it('stops the turn itself, and says the wait ran out', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva sier årsrapportene om måloppnåelse?'));
    await settle();

    await wait(STALLED_ANSWER_MS);

    // Through the same signal «Avbryt» uses, so the backend hears about it
    // and no answer turns up after the client has given up.
    expect(turns[0]?.signal?.aborted).toBe(true);
    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe('timeout');
    expect(chatErrorText(result.current.error!).title).toBe('Svaret tok for lang tid');
  });

  it('reads a client that throws on abort the same way', async () => {
    const { result } = renderHook(() => useChat(throwingClient()));

    act(() => result.current.send('Hva sier årsrapportene om måloppnåelse?'));
    await settle();

    await wait(STALLED_ANSWER_MS);

    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe('timeout');
  });

  it('is not what the reader pressing «Avbryt» means', async () => {
    const { result } = renderHook(() => useChat(heldClient().client));

    act(() => result.current.send('Hva sier årsrapportene om måloppnåelse?'));
    await settle();

    await wait(SLOW_ANSWER_MS);
    act(() => result.current.cancel());
    await settle();

    expect(result.current.status).toBe('idle');
    expect(assistantMessages(result.current.messages)[0]?.status).toBe('aborted');
    expect(result.current.announcement).toBe('Genereringen ble avbrutt.');
  });

  it('does not fire while the answer is being written', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva sier årsrapportene om måloppnåelse?'));
    await settle();

    // Four times as long as the limit, a word at a time: a long answer is
    // not a stalled one.
    for (let i = 0; i < 8; i += 1) {
      await wait(STALLED_ANSWER_MS / 2);
      act(() => turns[0]?.emit({ type: 'token', text: 'ord ' }));
      await settle();
    }

    expect(turns[0]?.signal?.aborted).toBe(false);
    expect(result.current.status).toBe('streaming');
    expect(result.current.error).toBeNull();
  });
});
