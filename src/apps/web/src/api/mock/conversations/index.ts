import { scriptedConversations } from './scripts';
import type { ScriptedConversation } from './types';

export type { ScriptedConversation } from './types';
export { scriptedConversations } from './scripts';
// The conversations as threads, and the `[n]` markers that belong to the same
// job: turning a script into the messages a thread holds. See threads.ts.
export { citationsFor, scriptedThreads } from './threads';

/**
 * Loose enough to survive a user editing the suggestion before sending.
 *
 * Kickstarters fill the compose field and do not send (answer 40), so the
 * question that arrives has often been changed a little — a word dropped, a
 * question mark added. Comparing on letters and digits only, lowercased,
 * means punctuation and spacing never decide whether there is an answer.
 */
function normalise(question: string): string {
  return question
    .toLocaleLowerCase('nb-NO')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();
}

const byQuestion = new Map<string, ScriptedConversation>();
for (const conversation of scriptedConversations) {
  byQuestion.set(normalise(conversation.question), conversation);
  for (const alias of conversation.aliases ?? []) byQuestion.set(normalise(alias), conversation);
}

/**
 * The scripted conversation for a question, if there is one.
 *
 * Exact match first, then a prefix match either way round, so «Hva sier
 * Bufdir om kapasitet i barnevernet» still finds its answer when the user
 * trims the question mark or the last word. Anything else falls through to
 * the default answer in MockChatClient.
 */
export function scriptedFor(question: string): ScriptedConversation | undefined {
  const asked = normalise(question);
  if (asked.length === 0) return undefined;

  const exact = byQuestion.get(asked);
  if (exact) return exact;

  // Long enough that «hva» does not match everything.
  if (asked.length < 12) return undefined;

  for (const [known, conversation] of byQuestion) {
    if (known.startsWith(asked) || asked.startsWith(known)) return conversation;
  }
  return undefined;
}
