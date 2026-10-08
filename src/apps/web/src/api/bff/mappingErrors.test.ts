import { describe, expect, it } from 'vitest';
import type { BffConversationDetail } from './contract';
import { BffTurnState, chatErrorFromBff, threadDetailFromBff } from './mapping';

/**
 * The BFF's own codes for what only it can know. Everything else goes on to
 * `errorFromBackend`, which is the reading the live client already does.
 */
describe('chatErrorFromBff', () => {
  it('a backend nobody could reach is not the same as one that answered badly', () => {
    expect(
      chatErrorFromBff('backend_unreachable', 'Fikk ikke kontakt med backend (ECONNREFUSED).'),
    ).toEqual({ code: 'unknown', message: 'Tjenesten svarte ikke.' });
  });

  it('a status carries what the status establishes, and no more', () => {
    expect(chatErrorFromBff('backend_http_401', 'Backend svarte 401.')).toEqual({
      code: 'unauthorized',
    });
    expect(chatErrorFromBff('backend_http_504', 'Backend svarte 504.')).toEqual({
      code: 'timeout',
    });
    expect(chatErrorFromBff('backend_http_500', 'Backend svarte 500.').code).toBe('unknown');
  });

  it('a broken stream says what happened, in Norwegian', () => {
    expect(chatErrorFromBff('stream_broken', 'Forbindelsen til backend ble brutt.')).toEqual({
      code: 'unknown',
      message: 'Forbindelsen brøt sammen mens svaret kom.',
    });
  });

  it("the backend's own code is read, not the English sentence around it", () => {
    expect(
      chatErrorFromBff('dataset_not_authorized', 'Dataset not authorized for this key'),
    ).toEqual({ code: 'unauthorized' });
  });

  it('no code at all still falls back to reading the text', () => {
    expect(chatErrorFromBff(undefined, 'LLM request failed at iteration 2').code).toBe(
      'model-unavailable',
    );
  });
});

/**
 * Reading the code is one thing; carrying it from the stream to the reader is
 * another. A mutation that left `chatErrorFromBff` in place but stopped the
 * stream from calling it went unnoticed by every test above, because they call
 * it directly. This one goes through the turn state, with a message no pattern
 * matches so that only the code can answer.
 */
describe('BffTurnState: the code travels with the error', () => {
  it('an unreachable backend is named by its code, not by its English sentence', () => {
    const state = new BffTurnState();
    const [event] = state.read({
      type: 'error',
      message: 'Fikk ikke kontakt med backend (ECONNREFUSED).',
      code: 'backend_unreachable',
    });
    expect(event?.type).toBe('error');
    expect(event?.type === 'error' ? event.error : undefined).toEqual({
      code: 'unknown',
      message: 'Tjenesten svarte ikke.',
    });
  });
});

/**
 * A turn the backend recorded as failed comes back looking exactly like an
 * answer, because the backend stores its own error sentence as the assistant's
 * message. Measured 2026-09-29 after a reader reloaded mid-stream.
 */
describe('threadDetailFromBff: a stored failure is not an answer', () => {
  const detail = (text: string): BffConversationDetail => ({
    conversation: { id: 'c1', topic: 'Et spørsmål', created: 1 },
    messages: [
      { id: 'm1', role: 'user', text: 'Et spørsmål', created: 1 },
      { id: 'm2', role: 'assistant', text, created: 2 },
    ],
  });

  it("the agent loop's own failure sentence is drawn as a failed turn, not as the answer", () => {
    const thread = threadDetailFromBff(
      detail('LLM request failed at iteration 2: Interceptor Exception: '),
    );
    const answer = thread.messages.at(-1);
    expect(answer?.status).toBe('error');
    expect(answer?.content).toBe('');
    expect(answer?.citations).toEqual([]);
  });

  it('an ordinary answer is untouched, even when it says the word timeout', () => {
    const thread = threadDetailFromBff(
      detail('Rundskrivet nevner en timeout på 30 sekunder for rate limit [1].'),
    );
    const answer = thread.messages.at(-1);
    expect(answer?.status).toBe('complete');
    expect(answer?.content).toContain('timeout');
  });

  it('the sources go on the last real answer, never on the failed turn', () => {
    const thread = threadDetailFromBff({
      conversation: { id: 'c1', topic: 'Et spørsmål', created: 1 },
      messages: [
        { id: 'm1', role: 'user', text: 'Første', created: 1 },
        { id: 'm2', role: 'assistant', text: 'Et svar [1].', created: 2 },
        { id: 'm3', role: 'user', text: 'Andre', created: 3 },
        { id: 'm4', role: 'assistant', text: 'LLM request failed at iteration 1', created: 4 },
      ],
      sources: [
        { docNum: '1', title: 'Tildelingsbrev', url: '', marker: 1, chunkId: 'a', excerpt: 'x' },
      ],
    });

    expect(thread.messages.at(-1)?.sources).toBeUndefined();
    expect(thread.messages.at(1)?.sources).toHaveLength(1);
  });
});
