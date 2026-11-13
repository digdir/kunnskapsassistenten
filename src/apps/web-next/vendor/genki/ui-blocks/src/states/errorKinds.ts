/**
 * What went wrong with an answer, as far as the reader can act on it. Each kind needs something
 * different of the reader, so each has its own heading and advice. The app decides the kind from
 * what the platform said; a stopped answer and a search with no hits are not errors and have none.
 */
export const errorKinds = [
  'model-unavailable',
  'retrieval-unavailable',
  'timeout',
  'unauthorized',
  'rate-limited',
  'question-too-long',
  'filter-refused',
  'thread-not-found',
  'unknown',
] as const;

export type ErrorKind = (typeof errorKinds)[number];

export const isErrorKind = (value: unknown): value is ErrorKind =>
  errorKinds.some((kind) => kind === value);

/**
 * Whether «Prøv igjen» can help. A refused key, a question that is too long, a refused filter and
 * a thread that is gone fail the same way again, and a button that cannot work is worse than none.
 */
export const isRetryable = (kind: ErrorKind) =>
  kind !== 'unauthorized' &&
  kind !== 'question-too-long' &&
  kind !== 'filter-refused' &&
  kind !== 'thread-not-found';

/**
 * What an HTTP status establishes about a failed answer, and no more: a 5xx does not say whether
 * the model or the search broke, so it is `unknown`.
 */
export const errorKindFromStatus = (status: number): ErrorKind => {
  switch (status) {
    case 401:
    case 403:
      return 'unauthorized';
    case 408:
    case 504:
      return 'timeout';
    case 413:
      return 'question-too-long';
    case 429:
      return 'rate-limited';
    default:
      return 'unknown';
  }
};

/** The catalogue's key for each kind's texts: `<key>Title`, `<key>What` and `<key>Advice`. */
export const errorTextKey = {
  'model-unavailable': 'model',
  'retrieval-unavailable': 'retrieval',
  timeout: 'timeout',
  unauthorized: 'unauthorized',
  'rate-limited': 'rateLimited',
  'question-too-long': 'tooLong',
  'filter-refused': 'filterRefused',
  'thread-not-found': 'threadNotFound',
  unknown: 'unknown',
} as const satisfies Record<ErrorKind, string>;
