// Feedback on an answer goes to this server's `POST /api/next/feedback`, never to genki through
// the proxy: the server checks that the run is an answer in the person's own thread, and takes it
// only with a person's token (decisions/0013).
import type { AssistantFeedback } from '@genai/ui-assembly';

export const FEEDBACK_PATH = '/api/next/feedback';

/** Send `feedback` on an answer in `thread`. Rejects when it was not recorded. */
export async function sendFeedback(
  thread: string | undefined,
  feedback: AssistantFeedback,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  // genki rates a run: without the thread and the run, there is nothing to send.
  if (!thread || !feedback.runId) throw new Error('No run to rate.');
  const response = await fetcher(FEEDBACK_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      conversationId: thread,
      taskId: feedback.runId,
      rating: feedback.rating,
      reasons: feedback.reasons,
      ...(feedback.comment?.trim() ? { comment: feedback.comment.trim() } : {}),
    }),
  });
  if (!response.ok) throw new Error(`POST ${FEEDBACK_PATH} ${response.status}`);
  const body = (await response.json().catch(() => undefined)) as { ok?: unknown } | undefined;
  if (body?.ok !== true) throw new Error('Feedback not recorded.');
}
