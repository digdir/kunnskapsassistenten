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
 * The thinking panel on the failure path (user review 4, finding 3).
 *
 * While the question runs, the panel stands with this question's step. The
 * moment the failure card came, the panel was gone: the reader was left with
 * the question, the error, and nothing about what was tried, on the one path
 * where it is most worth seeing. A successful answer keeps its panel.
 *
 * The cause was that a failed turn with no text was taken out of the
 * conversation, and the steps went with it.
 */

const client = new MockChatClient({
  thinkingStepMs: 5,
  firstTokenMs: 50,
  tokenMs: 5,
  sourcesMs: 10,
  requestMs: 0,
});

const nkom = threads.find((thread) => thread.id === 'nkom-maaloppnaaelse')!;
const FAILING_QUESTION = 'simuler feil';

const answers = (messages: Message[]) => messages.filter((m) => m.role === 'assistant');

beforeEach(() => {
  resetMockThreads();
});

describe('a failed turn keeps its thinking panel', () => {
  it('keeps the turn with its steps when the error lands', async () => {
    client.openThread(nkom);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send(FAILING_QUESTION));
    await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 5000 });

    /*
     * The turn used to be taken out here. Now it stays, with the steps that
     * were sent, so the panel is drawn over the error as it is over an answer.
     */
    const failed = answers(result.current.messages).at(-1);
    expect(failed?.status).toBe('error');
    expect(failed?.thinkingSteps?.length).toBeGreaterThan(0);
    expect(failed?.content).toBe('');
  });

  it("shows this question's steps, not another's", async () => {
    // #81 gave the failure path a thinking step of its own. The panel that
    // stays must show it, not the first step of the NKOM fixture.
    client.openThread(nkom);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send(FAILING_QUESTION));
    await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 5000 });

    const steps = answers(result.current.messages).at(-1)?.thinkingSteps ?? [];
    expect(steps).toHaveLength(1);
    expect(steps[0]?.label).not.toBe('Jeg deler spørsmålet i to.');
  });

  it('takes the turn out when there is nothing to show', async () => {
    /*
     * The line that still stands, and why: a turn with no text AND no steps
     * holds nothing, and an <li> holding only the hidden «Kunnskapsassistenten
     * svarte:» tells a screen reader the assistant answered something.
     *
     * The mock always sends a step first, so the case is made here: a client
     * that fails before anything has happened.
     */
    const silentClient: ChatClient = {
      // oxlint-disable-next-line require-yield
      async *ask() {
        throw new Error('nede');
      },
      listThreads: async () => [],
      getThread: async () => null,
      listFacets: async () => [],
    };

    const { result } = renderHook(() => useChat(silentClient));

    act(() => result.current.send('Hva sier rapporten?'));
    await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 5000 });

    expect(answers(result.current.messages)).toHaveLength(0);
  });

  it('survives a reload, with the steps and a card that says what happened', async () => {
    /*
     * Errors were not stored at all before: neither failure path in the mock
     * called recordMockTurn, so a reload gave a thread without even the
     * question. Now the turn is written down as the stopped ones are.
     */
    client.openThread(nkom);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send(FAILING_QUESTION));
    await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 5000 });

    const stored = (await client.getThread(nkom.id))!.messages.slice(-2);
    expect(stored.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(stored[0].content).toBe(FAILING_QUESTION);
    expect(stored[1].status).toBe('error');
    expect(stored[1].thinkingSteps?.length).toBeGreaterThan(0);
  });
});

describe('the card on a failed turn', () => {
  const failed: Message = {
    id: 'a1',
    role: 'assistant',
    content: '',
    createdAt: '2026-09-21T09:00:00Z',
    citations: [],
    thinkingSteps: [
      { id: 's1', kind: 'search', label: 'Jeg søker i dokumentene.', durationMs: 900 },
    ],
    status: 'error',
  };

  /** What «Fremgangsmåte» says a search step was. */
  const SEARCHED = 'Lette etter steder som handler om spørsmålet';

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

  it('stays quiet while the alert under the conversation is about this turn', () => {
    // The alert says what went wrong and gives the way on. Two statements
    // about the same thing is one too many.
    show('a1');

    expect(screen.queryByText(FAILED_NOTE)).toBeNull();
    expect(screen.getByText(SEARCHED)).toBeTruthy();
  });

  it('speaks up when the alert no longer applies to it', () => {
    // After a reload, or when the reader has asked something since. The card
    // is then the only thing that can say why there is no answer under the
    // question, and «Tok 1 sekund» over nothing is a riddle without it.
    show(undefined);

    expect(screen.getByText(FAILED_NOTE)).toBeTruthy();
    expect(screen.getByText(SEARCHED)).toBeTruthy();
  });

  it('gives the way on once the alert is gone, as the stopped turn has', () => {
    /*
     * The alert carried «Prøv igjen» while it stood. Without the button here,
     * a restored failure would be the one turn in the thread with no way on at
     * all. `retry` finds the question in the conversation when the session
     * that asked it is gone (#76), so it works in a reloaded tab.
     */
    show(undefined);

    expect(screen.getByRole('button', { name: REGENERATE })).toBeTruthy();
  });

  it('leaves the way on to the alert while it stands', () => {
    // Two «prøv igjen» about the same thing, one in the alert and one in the
    // card, is one too many.
    show('a1');

    expect(screen.queryByRole('button', { name: REGENERATE })).toBeNull();
  });

  it('calls onRegenerate when the button is pressed', () => {
    const calls: number[] = [];
    render(
      <MessageList
        messages={[failed]}
        onRegenerate={() => calls.push(1)}
        onSelectSource={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: REGENERATE }));
    expect(calls).toHaveLength(1);
  });
});
