import type { Citation, Message, ThreadDetail } from '../../../model';
import { MOCK_CORPUS } from '../../corpus';
import { daysAgo } from '../clock';
import { scriptedConversations } from './scripts';
import type { ScriptedConversation } from './types';

/**
 * The `[n]` markers in a conversation's answer, resolved.
 *
 * Derived from the excerpts rather than written out beside them, so a
 * renumbered excerpt cannot end up pointing at the wrong one. Excerpts the
 * answer never cited carry no number and are skipped.
 */
export function citationsFor(conversation: ScriptedConversation): Citation[] {
  return conversation.documents
    .flatMap((document) => document.excerpts.map((excerpt) => ({ document, excerpt })))
    .filter(({ excerpt }) => excerpt.citationNumber !== undefined)
    .map(({ document, excerpt }) => ({
      number: excerpt.citationNumber!,
      excerptId: excerpt.id,
      documentId: document.id,
    }))
    .sort((a, b) => a.number - b.number);
}

/**
 * A scripted conversation, as a thread that is already in the list.
 *
 * When it was had comes from the conversation itself (`daysAgo`), so nothing
 * here is paired by position with anything. It was an array beside this list
 * until KA CC read PR #58 and noticed the array was paired with the FILTERED
 * conversations: a second one that fails would have shifted every day after
 * it, silently.
 *
 * The question, then the answer with everything behind it: the sources
 * grouped per document, the `[n]` markers resolved against them, the thinking
 * steps, and «Fremgangsmåte». Opening one of these from the list is the same
 * screen as asking the question and waiting — which is the whole point, and
 * what it was not: the rows were titles with no conversation under them, so
 * every thread a reader opened from the list was empty. Punkt 16 på
 * brukerreise-lista, målt av #4.
 */
function threadFor(conversation: ScriptedConversation): ThreadDetail {
  const asked = daysAgo(conversation.daysAgo, 8);
  const answered = daysAgo(conversation.daysAgo, 9);

  const question: Message = {
    id: `${conversation.id}-question`,
    role: 'user',
    content: conversation.question,
    createdAt: asked,
    citations: [],
    status: 'complete',
  };

  /*
   * `needs-clarification` is a finished turn and not a failed one: the agent
   * answered that it cannot answer yet and asked back. The message list draws
   * it as a question to the reader, and there are no sources because nothing
   * was retrieved — which is why `documents` being empty here is right rather
   * than missing.
   */
  const answer: Message = {
    id: `${conversation.id}-answer`,
    role: 'assistant',
    content: conversation.answer,
    createdAt: answered,
    citations: citationsFor(conversation),
    sources: conversation.documents,
    retrieval: conversation.retrieval,
    thinkingSteps: conversation.thinkingSteps,
    /*
     * The corpus these were written against. Every document in them is a
     * Kudos document, so the answer says so rather than borrowing whatever
     * the chooser stands on when it is read back — the same rule a turn the
     * mock streams now follows, and the same one the live client follows off
     * the conversation's tag.
     */
    corpusKey: MOCK_CORPUS.key,
    status: conversation.outcome === 'needs-clarification' ? 'needs-clarification' : 'complete',
  };

  return {
    id: conversation.id,
    title: conversation.threadTitle,
    createdAt: asked,
    updatedAt: answered,
    /*
     * On the thread as well as on the answer, because the thread list reads
     * the thread. Without it the eleven scripted rows were the only ones in
     * the list with no corpus on them while every row a reader had made
     * carried one, which reads as «these belong to no corpus» rather than as
     * «these are older» (KA CC kan 2 på #133).
     */
    corpusKey: MOCK_CORPUS.key,
    messages: [question, answer],
  };
}

/**
 * The scripted conversations as threads, with their content.
 *
 * All of them but one. `klima-feil` is the conversation that FAILS, and a
 * failed turn has no answer to store: its `answer` is the empty string on
 * purpose, because the text a reader sees belongs to the view
 * (`views/chat/errorText.ts`, keyed on the error code) and the alert is
 * driven by the live turn's own state rather than by a message. Writing it
 * down as a thread would put an empty bubble in the list with nothing to say
 * what went wrong. It stays reachable the way it was meant to be reached, by
 * asking the question.
 */
export const scriptedThreads: ThreadDetail[] = scriptedConversations
  .filter((conversation) => conversation.failure === undefined)
  .map(threadFor);
