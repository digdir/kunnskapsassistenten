import type { Message } from './message';

/**
 * Drops an attempt that was asked again: a question whose answer failed, was stopped or never came,
 * followed by the same question. The backend stores a retry as a new turn and cannot replace one,
 * so without this a reload shows the question twice where the screen showed it once.
 */
export function withoutRetriedAttempts(messages: Message[]): Message[] {
  const kept: Message[] = [];
  for (let at = 0; at < messages.length; at += 1) {
    const message = messages[at]!;
    const answer = messages[at + 1]?.role === 'assistant' ? messages[at + 1] : undefined;
    const next = messages[answer ? at + 2 : at + 1];
    const unanswered = !answer || answer.status === 'error' || answer.status === 'aborted';
    const askedAgain =
      message.role === 'user' &&
      next?.role === 'user' &&
      next.content.trim() === message.content.trim();
    if (askedAgain && unanswered) {
      if (answer) at += 1;
      continue;
    }
    kept.push(message);
  }
  return kept;
}
