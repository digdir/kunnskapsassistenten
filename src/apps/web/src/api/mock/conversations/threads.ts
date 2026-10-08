import type { Citation, Message, ThreadDetail } from '../../../model';
import { MOCK_CORPUS } from '../../corpus';
import { daysAgo } from '../clock';
import { scriptedConversations } from './scripts';
import type { ScriptedConversation } from './types';

/**
 * The `[n]` markers in a conversation's answer, derived from the excerpts so
 * a renumbered excerpt cannot point at the wrong one. Uncited excerpts are
 * skipped.
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

// A scripted conversation as a thread with everything a live turn has, so opening it from the
// list shows the same screen as asking.
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

  // A finished turn where the agent asked back: nothing was retrieved, so no `documents` is right.
  const answer: Message = {
    id: `${conversation.id}-answer`,
    role: 'assistant',
    content: conversation.answer,
    createdAt: answered,
    citations: citationsFor(conversation),
    sources: conversation.documents,
    retrieval: conversation.retrieval,
    thinkingSteps: conversation.thinkingSteps,
    // Kudos, the corpus these were written against, not whatever the chooser stands on later.
    corpusKey: MOCK_CORPUS.key,
    status: conversation.outcome === 'needs-clarification' ? 'needs-clarification' : 'complete',
  };

  return {
    id: conversation.id,
    title: conversation.threadTitle,
    createdAt: asked,
    updatedAt: answered,
    // On the thread too, because the list reads the thread; without it these
    // rows would look like they belong to no corpus.
    corpusKey: MOCK_CORPUS.key,
    messages: [question, answer],
  };
}

/**
 * The scripted conversations as threads, except the failing `klima-feil`: a failed turn has no
 * answer to store, so it would be an empty bubble. Asking the question still reaches it.
 */
export const scriptedThreads: ThreadDetail[] = scriptedConversations
  .filter((conversation) => conversation.failure === undefined)
  .map(threadFor);
