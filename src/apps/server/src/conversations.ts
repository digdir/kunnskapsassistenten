/** A thread as genki keeps it, read for the feedback check. The caller always comes from the session. */
import { backendHeaders, type Caller } from './backend.ts';
import { config } from './config.ts';

/** The backend answered, with a status that is not ok. */
export class BackendHttpError extends Error {
  readonly status: number;

  constructor(call: string, status: number) {
    super(`${call} ${status}`);
    this.status = status;
  }
}

/**
 * The body of a 502 for a failed call to the backend: a fixed sentence and,
 * when the failure is known, a code the page can tell it by.
 */
export function failure(error: string, err: unknown): { error: string; code?: string } {
  if (err instanceof BackendHttpError) return { error, code: `backend_http_${err.status}` };
  // fetch's own TypeError when it cannot reach the backend; any other TypeError
  // is from our code, and says nothing about the backend.
  if (err instanceof TypeError && err.message === 'fetch failed') {
    return { error, code: 'backend_unreachable' };
  }
  return { error };
}

/** The runs of the answers in one of the caller's threads. Throws when it is not theirs. */
export async function answerRuns(caller: Caller, id: string): Promise<string[]> {
  const res = await fetch(`${config.apiBase}/api/conversations/${encodeURIComponent(id)}`, {
    headers: { 'Content-Type': 'application/json', ...backendHeaders(caller) },
  });
  if (!res.ok) throw new BackendHttpError('detail', res.status);
  const body = (await res.json()) as { messages?: Array<{ role?: unknown; task?: unknown }> };
  return (body.messages ?? []).flatMap((m) =>
    m.role === 'assistant' && typeof m.task === 'string' && m.task ? [m.task] : [],
  );
}
