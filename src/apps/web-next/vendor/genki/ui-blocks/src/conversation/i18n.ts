import { defineCatalogue, defineNamespace, type Translation } from '@genai/i18n';
import { defineTranslations } from '@genai/i18n/react';
import { enAnswer, nbAnswer } from '../answer/i18n.js';

export const nbConversation = defineNamespace({
  youWrote: 'Du skrev:',
  attachments: 'Med vedlegg: {names}',
  asked: '{name} spurte:',
  askedUnnamed: 'KI-assistenten spurte:',
  answerScope: 'Svaret er',
  clarificationScope: 'Spørsmålet bygger på dokumenter',
  narrowed: 'Avgrenset til: {values}',
  narrowedFrom: 'Avgrenset til: {values}, fra {corpus}',
  fetchedFrom: 'Hentet fra {corpus}',
  slow: 'Dette tar lengre tid enn vanlig.',
  answerComing: 'Henter svar.',
  answerDone: 'Svaret er ferdig.',
  answerStopped: 'Genereringen ble avbrutt.',
  foundNothing: 'Fant ingen utdrag om dette i dokumentene.',
  clarifying: '{name} trenger en avklaring.',
  clarifyingUnnamed: 'KI-assistenten trenger en avklaring.',
  needsClarification: 'Trenger avklaring',
  chooseReply: 'Velg et svar',
  loading: 'Henter samtalen',
  answered: 'Svaret kom {time}',
  yesterday: 'i går',
  search: 'Søk i svaret',
  searchOf: 'Søk i svar {n} av {total}',
  searchPlaceholder: 'Søk i svaret',
  searchMin: 'Skriv minst {n} tegn',
  searchNone: 'Ingen treff',
  searchCount: '{n} av {total} treff',
  clearSearch: 'Tøm søket',
  previous: 'Forrige',
  next: 'Neste',
  previousHit: 'Forrige treff i svaret',
  nextHit: 'Neste treff i svaret',
  closeSearch: 'Lukk søk i svaret',
  dateTime: '{date} kl. {time}',
});

export const enConversation = {
  youWrote: 'You wrote:',
  attachments: 'With attachments: {names}',
  asked: '{name} asked:',
  askedUnnamed: 'The AI assistant asked:',
  answerScope: 'The answer is',
  clarificationScope: 'The question builds on documents',
  narrowed: 'Narrowed to: {values}',
  narrowedFrom: 'Narrowed to: {values}, from {corpus}',
  fetchedFrom: 'Fetched from {corpus}',
  slow: 'This is taking longer than usual.',
  answerComing: 'Fetching the answer.',
  answerDone: 'The answer is done.',
  answerStopped: 'The answer was stopped.',
  foundNothing: 'Found no excerpts about this in the documents.',
  clarifying: '{name} needs a clarification.',
  clarifyingUnnamed: 'The AI assistant needs a clarification.',
  needsClarification: 'Needs clarification',
  chooseReply: 'Choose an answer',
  loading: 'Loading the conversation',
  answered: 'The answer came {time}',
  yesterday: 'yesterday',
  search: 'Search the answer',
  searchOf: 'Search answer {n} of {total}',
  searchPlaceholder: 'Search the answer',
  searchMin: 'Type at least {n} characters',
  searchNone: 'No matches',
  searchCount: '{n} of {total} matches',
  clearSearch: 'Clear the search',
  previous: 'Previous',
  next: 'Next',
  previousHit: 'Previous match in the answer',
  nextHit: 'Next match in the answer',
  closeSearch: 'Close the search in the answer',
  dateTime: '{date}, {time}',
} satisfies Translation<typeof nbConversation>;

/**
 * The conversation's own catalogue, with the answer's words it says in its own announcements. It
 * stays out of the package's shared one, so a host that imports another block does not load it.
 */
export const nb = defineCatalogue({ conversation: nbConversation, answer: nbAnswer });
export const en = {
  conversation: enConversation,
  answer: enAnswer,
} satisfies Translation<typeof nb>;

export const { useT, translator } = defineTranslations({ nb, en });
