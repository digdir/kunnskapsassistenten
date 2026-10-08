import type { Citation } from './citation';
import type { RetrievalDetails, ThinkingStep } from './retrieval';
import type { SourceDocument } from './source';

/**
 * Why a turn ended the way it did.
 *
 * The code is the contract; the Norwegian the reader sees is looked up from
 * it in the view, so the same case reads the same whether it came from the
 * mock, from an HTTP status or from the backend. «Noe gikk galt» covered all
 * of these at once and told the reader nothing about what to do next
 * (design/brukerreiser-2026-09-15.md, punkt 12).
 *
 * `aborted` is the user pressing stop (answer 34) and is not an error state
 * in the UI. `no-hits` is not one either: the search ran and found nothing,
 * which is an answer with an empty source list — it travels as an `error`
 * event because that is the frame that ends a stream without content, and
 * the chat turns it back into a finished turn. API-bestilling A16 asks the
 * backend for the same distinction.
 *
 * `model-unavailable` and `retrieval-unavailable` are told apart only when
 * the backend says which it was — by a code, or by a text of its own that
 * names the half that failed («LLM request failed …»). Nothing here guesses:
 * an HTTP 5xx is `unknown`, because «språkmodellen svarer ikke» and «korpuset
 * er nede» need different things from the reader and a wrong guess sends them
 * the wrong way.
 *
 * `question-too-long` is the one refusal the reader can fix themselves: the
 * BFF turns a question over its limit away before it reaches the backend.
 * `thread-not-found` is a follow-up in a thread the BFF no longer has, most
 * likely deleted elsewhere; asking again there gets the same answer.
 * `filter-refused` is the BFF turning the reader's filter away — more than
 * 100 values in one field, a value the backend does not take, or a field the
 * corpus does not have — and it too comes back the same until the filter is
 * changed.
 */
const CHAT_ERROR_CODES = [
  'aborted',
  'model-unavailable',
  'retrieval-unavailable',
  'timeout',
  'no-hits',
  'unauthorized',
  'rate-limited',
  'question-too-long',
  'thread-not-found',
  'filter-refused',
  'unknown',
] as const;

export type ChatErrorCode = (typeof CHAT_ERROR_CODES)[number];

/**
 * A code from outside, narrowed to one we know.
 *
 * The backend does not send `error.code` yet (API-bestilling A16), and the
 * day it does it will send codes this frontend has never heard of. That must
 * land on `unknown` and show the generic text, never throw and never reach a
 * lookup table with no entry for it.
 */
export function chatErrorCode(value: unknown): ChatErrorCode {
  return CHAT_ERROR_CODES.find((code) => code === value) ?? 'unknown';
}

export interface ChatError {
  code: ChatErrorCode;
  /**
   * What the layer that caught it saw, when it knows more than the code does
   * — «Fikk ikke kontakt med tjenesten». It replaces the first of the two
   * sentences the view writes; the second one, about what the reader can do,
   * always comes from the code. Leave it out and both come from the code.
   *
   * Norwegian if it is set at all: it goes on screen. So it is never text
   * that came over the wire — the backend's and the BFF's own words are read
   * for a code and logged (src/api/backendErrors.ts), not shown.
   */
  message?: string;
}

/**
 * One frame from a streaming answer (answer 33).
 *
 * The order is: `thinking-step` zero or more times, `token` many times,
 * `sources` once when the answer is done building, then `done` — or `error`
 * at any point, which always ends the stream.
 *
 * `sources` comes last because the backend only knows the chunks when the
 * final frame arrives; a client must not expect citations to resolve while
 * the text is still streaming.
 */
export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'thinking-step'; step: ThinkingStep }
  | {
      type: 'sources';
      documents: SourceDocument[];
      citations: Citation[];
      retrieval: RetrievalDetails;
    }
  | {
      type: 'done';
      messageId: string;
      conversationId: string;
      /**
       * When the answer was finished, ISO 8601.
       *
       * One turn has one time, and this frame is where it is decided: the
       * answer is done at this moment, and both the message on screen and
       * whatever writes the turn down have to say the same thing. Stamping it
       * separately in each place is how «14:32» on screen became «14:32:15»
       * after a reload — two clocks, fifteen seconds apart, for one answer
       * that had not changed (KA CC on #71).
       *
       * Optional, because a backend that does not report it is not broken; a
       * client that does not get one falls back to its own clock, which is
       * the same instant give or take the trip home.
       */
      createdAt?: string;
      /**
       * How the agent says the turn ended, from `_meta.status` in the final
       * frame. Absent means `complete`, which is what every answer up to now
       * has been and what a client that ignores this field keeps getting.
       *
       * The backend's third value, `error`, is not here: an answer that
       * failed already arrives as an `error` event, and having two ways to
       * say the same thing would leave a reader wondering which one wins.
       */
      outcome?: 'complete' | 'needs-clarification';
      /**
       * Which corpus answered, as the client asked it — `dataset_config_key`.
       *
       * Reported by the client rather than read off the store by whoever
       * writes the turn down, because the client is what put the key on the
       * wire: the live client resolves it once per question, and the mock
       * reads it to pick its fixtures after the thinking steps have already
       * gone out. Two reads of a store the reader can change are two answers
       * to «which corpus was this turn».
       *
       * Optional, and undefined means «not known»: live without a tenant
       * leaves the key out of the call and the backend picks its own.
       */
      corpusKey?: string;
    }
  | {
      type: 'error';
      error: ChatError;
      /**
       * When the turn ended, ISO 8601. Same field and same reason as on
       * `done`: one turn has one time, whichever frame ends it.
       *
       * It matters here because two of these codes are not failures. A
       * stopped answer stays on screen and is written down, and `no-hits` is
       * a finished answer with an empty source list — both settle as turns a
       * reader can refer back to, so both need the time the turn ended rather
       * than the time its placeholder was made.
       */
      createdAt?: string;
      /**
       * Which corpus the turn was asked of. Same field and same reason as on
       * `done`, and it is here for the same reason `createdAt` is: two of
       * these codes are finished turns that get written down — a stopped
       * answer and `no-hits` — and both stay on screen as turns a reader can
       * ask «from which corpus» about.
       */
      corpusKey?: string;
    };
