import { chatErrorCode } from '../model';
import type { ChatError } from '../model';

/**
 * What an HTTP status says about the turn, and what it does not.
 *
 * Only what the status actually establishes. A 5xx means the backend broke;
 * it does not say whether the language model was down or the search was, and
 * the two want opposite things from the reader — so it is `unknown` and says
 * so, rather than guessing at a code the reader would act on
 * (API-bestilling A16 asks the backend for the missing half).
 *
 * The status number stays in the text: it is the one thing anyone debugging
 * this from a screenshot has to go on.
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

/**
 * The backend's own snake_case codes, as it sends them today in `_meta.code`
 * and in a JSON-RPC error's `data.code` (digdir/mcp/tools.clj). Only the ones
 * that say something the reader's text depends on; the rest — an agent or a
 * mode that does not exist, a dataset scope nobody set — are the operator's
 * to fix and read as `unknown`.
 */
const BACKEND_CODES: Record<string, ChatError> = {
  agent_not_authorized: { code: 'unauthorized' },
  mode_not_authorized: { code: 'unauthorized' },
  dataset_not_authorized: { code: 'unauthorized' },
};

/**
 * Texts the backend and the BFF are known to send, and what each one is.
 * First match wins, so the order matters where two could match.
 *
 * Only the failing half is read off the text, never the reader's next step:
 * that is the view's, from the code. Where the text names the language model
 * («LLM request failed …», which is how the agent loop reports every failed
 * model call — digdir/skills/builtin/agent/loop.clj), that is the backend
 * saying which half it was, not this client guessing.
 */
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
  // The BFF's 413, from its 64 KB limit on the body. On /api/ask that is the
  // question — far past the length check above, which never got to run — so
  // the same case, only without a number to give.
  { pattern: /^Forespørselen er for stor/u, error: () => ({ code: 'question-too-long' }) },
  // The BFF's 404 for a follow-up in a conversation it no longer has, most
  // likely deleted in another tab.
  { pattern: /^Fant ikke samtalen/u, error: () => ({ code: 'thread-not-found' }) },
  // The model's stream went quiet (digdir/llm/openai.cljc). That is the model
  // not answering, not the question being too big, so the reader is told the
  // question can go again as it stands. Named on its own rather than left
  // to the «LLM request failed» entry at the end, so it keeps its code if the
  // watchdog's text ever reaches this client without the agent loop's prefix.
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
 * What the reader is told when the service turns their filter away, behind
 * the BFF (`filter-too-many-values`, `filter-invalid-value`,
 * `filter-unknown-field`) and behind the backend itself
 * (`invalid_overrides`). One wording for both, so a reader reads the same
 * thing whichever of the two said no.
 *
 * `unknownField` is a field name the corpus does not have. The reader did not
 * choose the name, the build or the BFF did, but the filter is what they can
 * change, and the advice under it says so.
 */
export const FILTER_REFUSED_MESSAGES = {
  tooManyValues: 'Filteret har mer enn 100 verdier valgt i ett felt. Velg høyst 100, eller alle.',
  invalidValue:
    'Et av valgene i filteret har tegn eller en lengde søket ikke tar imot. Fjern det valget.',
  unknownField: 'Filteret bruker et felt som ikke finnes i innholdet det søkes i.',
} as const;

/**
 * headless-rag's refusal of the reader's filter, from main `1c65865` on (#15).
 * It checks `retrieve-filter-by` before the tool runs and answers JSON-RPC
 * `-32602` with `data.code` `invalid_overrides`. Measured 5.10 with the
 * `progressToken` this client sends, the refusal comes as an ordinary SSE
 * frame. Before this, the code was unknown here, and the reader got the
 * general error for a filter they can change.
 *
 * The text says which rule was broken, in English. The two a reader of this
 * panel can break get their own sentence (measured: «A filter field takes at
 * most 100 options.» and «Filter options cannot contain a backtick, a
 * backslash or a control character.»); any other refusal is still
 * `filter-refused`, with the general sentence.
 */
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
 * A failure the backend or the BFF described in its own words, as a code.
 *
 * Their text is English, technical and written for whoever runs the service
 * («LLM request failed at iteration 2: LLM streaming: no event received for
 * 30000ms …»), and it never goes on screen: the view writes both sentences
 * from the code. It goes to the console instead, where the person debugging
 * a screenshot of «Assistenten svarte ikke» can find what the backend said.
 *
 * A code, when there is one, is read before the text, because it is what the
 * backend says on purpose: first the A16 set this app already knows, then the
 * backend's own codes. Then the known texts. Anything else is `unknown`.
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
