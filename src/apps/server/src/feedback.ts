import type { FeedbackRequest, FeedbackResponse } from '@ka/contract';
import { backendHeaders, type Caller } from './backend.ts';
import { config } from './config.ts';
import * as convos from './conversations.ts';

export const MAX_FEEDBACK_COMMENT = 2000;
/** As many reasons as genki keeps, each a short phrase picked in the client. */
export const MAX_FEEDBACK_REASONS = 10;
export const MAX_FEEDBACK_REASON = 200;

export function cleanFeedback(body: unknown): FeedbackRequest | string {
  if (!body || typeof body !== 'object') return 'Ugyldig tilbakemelding.';
  const b = body as Record<string, unknown>;
  if (b.rating !== 'up' && b.rating !== 'down') return 'Velg tommel opp eller ned.';
  if (typeof b.conversationId !== 'string' || !b.conversationId) return 'Mangler samtale.';
  if (typeof b.taskId !== 'string' || !b.taskId) return 'Mangler svaret det gjelder.';
  const comment = typeof b.comment === 'string' ? b.comment.trim() : '';
  if (comment.length > MAX_FEEDBACK_COMMENT)
    return `Kommentaren er for lang (maks ${MAX_FEEDBACK_COMMENT} tegn).`;
  if (
    b.reasons !== undefined &&
    !(Array.isArray(b.reasons) && b.reasons.every((r) => typeof r === 'string'))
  )
    return 'Ugyldige grunner.';
  const reasons = ((b.reasons as string[] | undefined) ?? [])
    .map((r) => r.trim())
    .filter(Boolean);
  if (
    reasons.length > MAX_FEEDBACK_REASONS ||
    reasons.some((r) => r.length > MAX_FEEDBACK_REASON)
  )
    return 'For mange eller for lange grunner.';
  return {
    conversationId: b.conversationId,
    taskId: b.taskId,
    rating: b.rating,
    ...(reasons.length > 0 ? { reasons } : {}),
    ...(comment ? { comment } : {}),
  };
}

/**
 * The run must be an answer in one of the caller's own threads: with a service
 * key genki takes feedback from anyone holding the key, whatever `X-User-Id` says.
 */
export async function ownsTask(caller: Caller, feedback: FeedbackRequest): Promise<boolean> {
  try {
    const { messages } = await convos.detail(caller, feedback.conversationId);
    return messages.some((m) => m.taskId === feedback.taskId);
  } catch {
    return false;
  }
}

export async function sendFeedback(
  caller: Caller,
  feedback: FeedbackRequest,
): Promise<FeedbackResponse> {
  const res = await fetch(`${config.apiBase}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...backendHeaders(caller) },
    body: JSON.stringify({
      task: feedback.taskId,
      rating: feedback.rating,
      ...(feedback.reasons?.length ? { reasons: feedback.reasons } : {}),
      ...(feedback.comment ? { comment: feedback.comment } : {}),
    }),
  });
  if (res.status === 404 || res.status === 405 || res.status === 501)
    return { ok: false, unavailable: true };
  if (!res.ok) throw new convos.BackendHttpError('feedback', res.status);
  return { ok: true };
}
