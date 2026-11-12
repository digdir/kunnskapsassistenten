import type { FieldError } from './types.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly fieldErrors: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const fieldErrorsOf = (body: Record<string, unknown>): FieldError[] =>
  Array.isArray(body.errors)
    ? body.errors.flatMap((e) =>
        isRecord(e) && typeof e.message === 'string'
          ? [{ path: typeof e.path === 'string' ? e.path : '', message: e.message }]
          : [],
      )
    : [];

export const apiErrorFrom = async (response: Response): Promise<ApiError> => {
  const text = await response.text().catch(() => '');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  if (!isRecord(body)) return new ApiError(response.status, text || response.statusText);
  const nested = isRecord(body.error) ? body.error : undefined;
  const message =
    (typeof nested?.message === 'string' && nested.message) ||
    (typeof body.error === 'string' && body.error) ||
    (typeof body.detail === 'string' && body.detail) ||
    (typeof body.title === 'string' && body.title) ||
    response.statusText;
  const code =
    typeof nested?.code === 'string'
      ? nested.code
      : typeof body.code === 'string'
        ? body.code
        : undefined;
  return new ApiError(response.status, message, code, fieldErrorsOf(body));
};
