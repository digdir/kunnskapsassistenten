import { beforeEach, describe, expect, it } from 'vitest';
import { threadFromQuestion } from '../../model';
import {
  mockThreadDetail,
  openMockThread,
  recordMockTurn,
  resetMockThreads,
} from './sessionThreads';

/**
 * A stopped turn asked again is stored as a new turn here too, as in the
 * backend. Read back, the reader sees the question once, as before the reload.
 */
describe('mockThreadDetail, et svar som ble stoppet og prøvd på nytt', () => {
  beforeEach(() => resetMockThreads());

  it('viser spørsmålet én gang, med svaret fra det nye forsøket', () => {
    const thread = threadFromQuestion('Hva skriver Nkom om måloppnåelse?');
    openMockThread(thread);
    const answered = (status: 'aborted' | 'complete', content: string) => ({
      content,
      citations: [],
      createdAt: new Date().toISOString(),
      status,
    });

    recordMockTurn({ question: thread.title, answerId: 'a1', answer: answered('aborted', '') });
    recordMockTurn({
      question: thread.title,
      answerId: 'a2',
      answer: answered('complete', 'Nkom skriver at målene er nådd.'),
    });

    const messages = mockThreadDetail(thread.id, null)?.messages ?? [];
    expect(messages.map((message) => [message.role, message.status, message.id])).toEqual([
      ['user', 'complete', 'a2-question'],
      ['assistant', 'complete', 'a2'],
    ]);
  });
});
