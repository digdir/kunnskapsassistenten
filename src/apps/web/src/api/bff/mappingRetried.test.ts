import { describe, expect, it } from 'vitest';
import type { BffConversationDetail } from './contract';
import retried from './fixtures/conversation-retried.json';
import { threadDetailFromBff } from './mapping';

/**
 * A turn the reader stopped and then asked again («Generer på nytt»).
 *
 * The backend has no way to replace a turn, so the retry is stored as a new
 * one, and the stopped turn keeps the agent loop's failure as its answer
 * (digdir/digdir-headless-rag#22). Recorded from the BFF's
 * `GET /api/v2/conversations/:id` after exactly that.
 */
describe('threadDetailFromBff, et svar som ble prøvd på nytt', () => {
  it('viser spørsmålet én gang, med svaret fra det nye forsøket', () => {
    const thread = threadDetailFromBff(retried as BffConversationDetail);

    expect(thread.messages.map((message) => [message.role, message.status])).toEqual([
      ['user', 'complete'],
      ['assistant', 'complete'],
    ]);
    expect(thread.messages[1]?.content).toBe(retried.messages[3]?.text);
    expect(thread.messages[1]?.sources?.length).toBeGreaterThan(0);
  });
});

/**
 * `/api/v2` sends a turn the backend stored as failed as `failed: true` with no
 * text, instead of the backend's English error sentence.
 */
describe('threadDetailFromBff, en tur BFF-en har merket som feilet', () => {
  const detail = (messages: BffConversationDetail['messages']): BffConversationDetail => ({
    conversation: { id: 'c1', topic: 'Måloppnåelse i Nkom', created: 1791472252182 },
    messages,
  });
  const asked = { id: 'q1', role: 'user' as const, text: 'Hva skriver Nkom?', created: 1 };
  const failed = { id: 'a1', role: 'assistant' as const, text: '', created: 2, failed: true };

  it('står som feilet, og forsvinner ikke fordi teksten er tom', () => {
    const thread = threadDetailFromBff(detail([asked, failed]));

    expect(thread.messages.map((message) => [message.role, message.status])).toEqual([
      ['user', 'complete'],
      ['assistant', 'error'],
    ]);
  });

  it('tas ut når det samme spørsmålet ble stilt igjen', () => {
    const thread = threadDetailFromBff(
      detail([
        asked,
        failed,
        { ...asked, id: 'q2', created: 3 },
        { id: 'a2', role: 'assistant', text: 'Nkom skriver at målene er nådd.', created: 4 },
      ]),
    );

    expect(thread.messages.map((message) => [message.role, message.status])).toEqual([
      ['user', 'complete'],
      ['assistant', 'complete'],
    ]);
  });
});
