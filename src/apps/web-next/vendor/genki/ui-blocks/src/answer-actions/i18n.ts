import { defineCatalogue, defineNamespace, type Translation } from '@genai/i18n';
import { defineTranslations } from '@genai/i18n/react';

export const nbAnswerActions = defineNamespace({
  copyAnswer: 'Kopier svaret',
  copyLink: 'Kopier lenke til tråden',
  linkOnlyHere: 'Virker bare for deg, i denne nettleseren',
  copied: 'Svaret er kopiert.',
  copiedWithSources: {
    one: 'Svaret og {count} kilde er kopiert.',
    other: 'Svaret og {count} kilder er kopiert.',
  },
  linkCopied: 'Lenken til tråden er kopiert.',
  copyFailed: 'Kunne ikke kopiere. Nettleseren tillot det ikke.',
  feedback: 'Tilbakemelding på svaret',
  useful: 'Var svaret nyttig?',
  yes: 'Ja',
  no: 'Nei',
  whatWrong: 'Hva var galt? (valgfritt)',
  reasonWrong: 'Feil',
  reasonNoSource: 'Mangler kilde',
  reasonOutdated: 'Utdatert',
  reasonHard: 'Vanskelig å forstå',
  comment: 'Kommentar (valgfritt)',
  counter: '{length} av {max} tegn. Ikke skriv personopplysninger.',
  send: 'Send',
  skip: 'Hopp over',
  thanksDetails: 'Takk! Tilbakemeldingen lagres for tjenesten, ikke for deg som person.',
  thanks: 'Takk!',
  notSent: 'Tilbakemeldingen ble ikke sendt. Prøv igjen om litt.',
});

export const enAnswerActions = {
  copyAnswer: 'Copy the answer',
  copyLink: 'Copy link to the thread',
  linkOnlyHere: 'Works only for you, in this browser',
  copied: 'The answer is copied.',
  copiedWithSources: {
    one: 'The answer and {count} source are copied.',
    other: 'The answer and {count} sources are copied.',
  },
  linkCopied: 'The link to the thread is copied.',
  copyFailed: 'Could not copy. The browser did not allow it.',
  feedback: 'Feedback on the answer',
  useful: 'Was the answer useful?',
  yes: 'Yes',
  no: 'No',
  whatWrong: 'What was wrong? (optional)',
  reasonWrong: 'Wrong',
  reasonNoSource: 'Missing source',
  reasonOutdated: 'Out of date',
  reasonHard: 'Hard to understand',
  comment: 'Comment (optional)',
  counter: '{length} of {max} characters. Do not write personal data.',
  send: 'Send',
  skip: 'Skip',
  thanksDetails: 'Thank you! The feedback is stored for the service, not for you as a person.',
  thanks: 'Thank you!',
  notSent: 'The feedback was not sent. Please try again in a moment.',
} satisfies Translation<typeof nbAnswerActions>;

/**
 * The answer actions' own catalogue. It stays out of the package's shared one, so a host that
 * imports another block, such as Approach, does not load these words. A block that borrows them
 * puts this namespace in its own catalogue.
 */
export const nb = defineCatalogue({ answerActions: nbAnswerActions });
export const en = { answerActions: enAnswerActions } satisfies Translation<typeof nb>;

export const { useT, translator } = defineTranslations({ nb, en });
