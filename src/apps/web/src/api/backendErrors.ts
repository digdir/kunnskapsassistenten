import { chatErrorCode } from '../model';
import type { ChatError } from '../model';

/**
 * What an HTTP status establishes about the turn, and no more: a 5xx does not
 * say whether the model or the search broke, so it is `unknown`. The number
 * stays in the text for whoever debugs from a screenshot.
 */
export function errorFromStatus(status: number): ChatError {
  switch (status) {
    case 401:
    case 403:
      return { code: 'unauthorized' };
    case 408:
    case 504:
      return { code: 'timeout' };
    case 429:
      return { code: 'rate-limited' };
    default:
      return { code: 'unknown', message: `Kunnskapsassistenten svarte med feil (${status}).` };
  }
}

// The backend's own codes in `_meta.code` and JSON-RPC `data.code`
// (digdir/mcp/tools.clj). Only those the reader's text depends on; the rest
// are the operator's to fix and read as `unknown`.
const BACKEND_CODES: Record<string, ChatError> = {
  agent_not_authorized: { code: 'unauthorized' },
  mode_not_authorized: { code: 'unauthorized' },
  dataset_not_authorized: { code: 'unauthorized' },
};

// Texts the backend and the BFF are known to send; first match wins. Only the
// failing half is read off the text, never the reader's next step. «LLM request
// failed» is how the agent loop reports a failed model call (agent/loop.clj).
const KNOWN_TEXTS: { pattern: RegExp; error: (match: RegExpMatchArray) => ChatError }[] = [
  // The BFF's wording for a status from the backend: the status says what it
  // can, the same as when it reaches this client directly.
  { pattern: /^Backend svarte (\d{3})\b/u, error: (match) => errorFromStatus(Number(match[1])) },
  // The BFF's wording for a stream that ended without an answer. Same case,
  // same sentence as when this client sees the stream end by itself.
  {
    pattern: /^Forbindelsen til backend ble brutt/u,
    error: () => ({ code: 'unknown', message: 'Forbindelsen brøt sammen mens svaret kom.' }),
  },
  // The BFF's own check on the question, a refusal the reader can do
  // something about.
  {
    pattern: /for langt \(maks (\d+) tegn\)/u,
    error: (match) => ({
      code: 'question-too-long',
      message: `Spørsmålet er lengre enn de ${match[1]} tegnene tjenesten tar imot.`,
    }),
  },
  // The BFF's 413 from its 64 KB body limit: on /api/ask, a question far past
  // the length check above, only without a number to give.
  { pattern: /^Forespørselen er for stor/u, error: () => ({ code: 'question-too-long' }) },
  // The BFF's 404 for a follow-up in a conversation it no longer has, most
  // likely deleted in another tab.
  { pattern: /^Fant ikke samtalen/u, error: () => ({ code: 'thread-not-found' }) },
  // The model's stream went quiet (digdir/llm/openai.cljc), so the question can
  // go again as it stands. Its own entry, so it keeps its code even without the
  // agent loop's «LLM request failed» prefix.
  {
    pattern: /no event received for \d+ ?ms|stream stalled/iu,
    error: () => ({ code: 'model-unavailable' }),
  },
  {
    pattern: /\(status 429\)|rate.?limit|too many requests/iu,
    error: () => ({ code: 'rate-limited' }),
  },
  {
    pattern: /\(status (?:408|504)\)|timed out|\btimeout\b/iu,
    error: () => ({ code: 'timeout' }),
  },
  {
    pattern: /API key (?:cannot|is not allowed)|is not allowed to access/iu,
    error: () => ({ code: 'unauthorized' }),
  },
  // Every other failed model call: a 400, a broken TLS session, a missing
  // secret. The reader cannot tell them apart and does not need to.
  { pattern: /^LLM request failed/iu, error: () => ({ code: 'model-unavailable' }) },
];

/**
 * What the reader is told when the BFF or the backend turns their filter away,
 * one wording for both. `unknownField` is the build's or the BFF's doing, but
 * the filter is what the reader can change.
 */
export const FILTER_REFUSED_MESSAGES = {
  tooManyValues: 'Filteret har mer enn 100 verdier valgt i ett felt. Velg høyst 100, eller alle.',
  invalidValue:
    'Et av valgene i filteret har tegn eller en lengde søket ikke tar imot. Fjern det valget.',
  unknownField: 'Filteret bruker et felt som ikke finnes i innholdet det søkes i.',
} as const;

// headless-rag refuses a bad `retrieve-filter-by` with JSON-RPC `-32602` and
// `data.code` `invalid_overrides`, naming the rule in English. The two rules
// this panel can break get their own sentence; any other gets the general one.
function refusedFilter(text: string | undefined): ChatError {
  if (text && /\bat most 100 options\b/u.test(text)) {
    return { code: 'filter-refused', message: FILTER_REFUSED_MESSAGES.tooManyValues };
  }
  if (text && /\bcannot contain a backtick\b/u.test(text)) {
    return { code: 'filter-refused', message: FILTER_REFUSED_MESSAGES.invalidValue };
  }
  return { code: 'filter-refused' };
}

/**
 * A failure the backend or the BFF described in its own words, as a code. The
 * text is for operators, so it goes to the console, never on screen. A code is
 * read before the text, because a code is said on purpose.
 */
export function errorFromBackend(text: string | undefined, code?: unknown): ChatError {
  if (text || code) {
    console.warn('KA: tjenesten svarte med feil.', { code, text });
  }

  const known = chatErrorCode(code);
  if (known !== 'unknown') return { code: known };
  if (code === 'invalid_overrides') return refusedFilter(text);
  if (typeof code === 'string' && Object.hasOwn(BACKEND_CODES, code)) return BACKEND_CODES[code];

  for (const { pattern, error } of KNOWN_TEXTS) {
    const match = text?.match(pattern);
    if (match) return error(match);
  }
  return { code: 'unknown' };
}
