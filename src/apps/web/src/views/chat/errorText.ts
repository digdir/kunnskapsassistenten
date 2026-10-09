import type { ChatError, ChatErrorCode } from '../../model';

/** One case: heading, the two sentences, and whether a retry is offered. */
type ChatErrorText = {
  /** Heading inside the alert. Says which of the cases this is. */
  title: string;
  /** One sentence: what happened. */
  what: string;
  /** One sentence: what the reader can do. */
  advice: string;
  /** Whether «Prøv igjen» is offered. A rejected key does not get one: the
      same question fails the same way, and a button that cannot work is
      worse than no button. */
  retryable: boolean;
};

// One entry per case, because four situations need four different things of
// the reader. `aborted` and `no-hits` are deliberately absent — neither is a
// failure — and the `Exclude` makes the compiler say so.
const BY_CODE: Record<Exclude<ChatErrorCode, 'aborted' | 'no-hits'>, ChatErrorText> = {
  'model-unavailable': {
    title: 'Assistenten svarte ikke',
    what: 'Språkmodellen som skriver svaret, svarte ikke.',
    advice: 'Dokumentene og filteret er uberørt, så spørsmålet kan stilles som det står.',
    retryable: true,
  },
  'retrieval-unavailable': {
    title: 'Søket i dokumentene svarte ikke',
    what: 'Kunnskapsassistenten fikk ikke søkt i dokumentene, så svaret hadde ingenting å bygge på.',
    advice: 'Det er søket som er nede, ikke spørsmålet ditt — det står som du skrev det.',
    retryable: true,
  },
  timeout: {
    title: 'Svaret tok for lang tid',
    what: 'Spørsmålet ble avbrutt fordi svaret brukte for lang tid.',
    advice: 'Et mer avgrenset spørsmål, eller et smalere filter, går som regel raskere.',
    retryable: true,
  },
  unauthorized: {
    title: 'Ingen tilgang',
    what: 'Kunnskapsassistenten avviste nøkkelen som gir tilgang til tjenesten.',
    advice:
      'Last siden på nytt og logg inn igjen. Står meldingen der fortsatt, må noen med tilgang til tjenesten se på det.',
    retryable: false,
  },
  'rate-limited': {
    title: 'For mange spørsmål på kort tid',
    what: 'Tjenesten tok imot for mange spørsmål på kort tid og satte dette til side.',
    advice: 'Vent et lite øyeblikk, så går det som regel gjennom.',
    retryable: true,
  },
  'question-too-long': {
    title: 'Spørsmålet er for langt',
    what: 'Spørsmålet er lengre enn tjenesten tar imot.',
    advice: 'Kort det ned, for eksempel ved å dele det i to spørsmål, og send det på nytt.',
    retryable: false,
  },
  'filter-refused': {
    title: 'Filteret kan ikke brukes',
    what: 'Tjenesten tar ikke imot filteret slik det er valgt.',
    advice: 'Endre filteret i filterpanelet, og spør på nytt.',
    retryable: false,
  },
  'thread-not-found': {
    title: 'Tråden er borte',
    what: 'Tråden finnes ikke lenger, kanskje fordi den er slettet et annet sted.',
    advice: 'Start en ny tråd med «Ny tråd» i trådlista, og still spørsmålet der.',
    retryable: false,
  },
  unknown: {
    title: 'Svaret kom ikke fram',
    what: 'Noe gikk galt da svaret skulle hentes.',
    advice: 'Tjenesten sa ikke hva, så det eneste å gjøre er å stille spørsmålet på nytt.',
    retryable: true,
  },
};

/** Used when trimming leaves nothing, so the alert is never empty. */
export const GENERIC_CHAT_ERROR = BY_CODE.unknown.what;

// Anchored to the end, so «Prøv igjen senere» is left alone. It guards the
// one sentence this view does not write: a `message` ending in «Prøv igjen.»
// asks for what the button under it already does.
const RETRY_PROMPT = /\s*Prøv igjen(?: om litt)?\s*[.!…]*\s*$/iu;

export function withoutRetryPrompt(message: string): string {
  const trimmed = message.replace(RETRY_PROMPT, '').trim();
  return trimmed.length > 0 ? trimmed : GENERIC_CHAT_ERROR;
}

/** Title, message and retry button for one failed turn. */
export type ChatErrorDisplay = {
  title: string;
  message: string;
  retryable: boolean;
};

/** The alert for a failed turn. A `message` on the error replaces the first
   sentence and only that one; the advice belongs to the case. */
export function chatErrorText(error: ChatError): ChatErrorDisplay {
  const text =
    error.code === 'aborted' || error.code === 'no-hits' ? BY_CODE.unknown : BY_CODE[error.code];
  const what = error.message ? withoutRetryPrompt(error.message) : text.what;

  return {
    title: text.title,
    message: `${what} ${text.advice}`,
    retryable: text.retryable,
  };
}
