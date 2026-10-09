import { scriptedConversations } from './scripts';
import type { ScriptedConversation } from './types';

export type { ScriptedConversation } from './types';
export { scriptedConversations } from './scripts';
// Turning a script into the messages a thread holds; see threads.ts.
export { citationsFor, scriptedThreads } from './threads';

// Kickstarters fill the compose field without sending, so questions arrive slightly edited;
// comparing lowercased letters and digits keeps punctuation and spacing out of it.
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
 * The scripted conversation for a question, if any: exact match first, then a
 * prefix match either way, so trimming the last word still finds it. Anything
 * else gets the default answer in MockChatClient.
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
