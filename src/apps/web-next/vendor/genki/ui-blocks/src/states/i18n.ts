import { defineCatalogue, defineNamespace, type Translation } from '@genai/i18n';
import { defineTranslations } from '@genai/i18n/react';

export const nbStates = defineNamespace({
  retry: 'Prøv igjen',
  goHome: 'Gå til forsiden',
  notFoundTitle: 'Siden finnes ikke',
  notFoundDescription:
    'Adressen fører ingen steder. Den kan være skrevet feil, eller peke på noe som er borte.',
  crashTitle: 'Noe gikk galt',
  crashText: 'Siden kunne ikke vises. Last inn siden på nytt for å fortsette.',
  crashOutside:
    'Det kan skje når en utvidelse i nettleseren, eller oversettelse av siden, endrer innholdet mens siden oppdateres.',
  reload: 'Last inn på nytt',
  crashDetails: 'Feilmeldingen',
  // The error kinds, as kunnskapsassistenten words them: a heading, what happened, and what the
  // reader can do.
  assistant: 'Assistenten',
  modelTitle: 'Assistenten svarte ikke',
  modelWhat: 'Språkmodellen som skriver svaret, svarte ikke.',
  modelAdvice: 'Ingenting annet er endret, så spørsmålet kan stilles som det står.',
  retrievalTitle: 'Søket i dokumentene svarte ikke',
  retrievalWhat: '{name} fikk ikke søkt i dokumentene, så svaret hadde ingenting å bygge på.',
  retrievalAdvice: 'Det er søket som er nede, ikke spørsmålet ditt. Det står som du skrev det.',
  timeoutTitle: 'Svaret tok for lang tid',
  timeoutWhat: 'Spørsmålet ble avbrutt fordi svaret brukte for lang tid.',
  timeoutAdvice: 'Et mer avgrenset spørsmål går som regel raskere.',
  unauthorizedTitle: 'Ingen tilgang',
  unauthorizedWhat: '{name} avviste nøkkelen som gir tilgang til tjenesten.',
  unauthorizedAdvice:
    'Last siden på nytt og logg inn igjen. Står meldingen der fortsatt, må noen med tilgang til tjenesten se på det.',
  rateLimitedTitle: 'For mange spørsmål på kort tid',
  rateLimitedWhat: 'Tjenesten tok imot for mange spørsmål på kort tid og satte dette til side.',
  rateLimitedAdvice: 'Vent et lite øyeblikk, så går det som regel gjennom.',
  tooLongTitle: 'Spørsmålet er for langt',
  tooLongWhat: 'Spørsmålet er lengre enn tjenesten tar imot.',
  tooLongAdvice: 'Kort det ned, for eksempel ved å dele det i to spørsmål, og send det på nytt.',
  filterRefusedTitle: 'Filteret kan ikke brukes',
  filterRefusedWhat: 'Tjenesten tar ikke imot filteret slik det er valgt.',
  filterRefusedAdvice: 'Endre filteret, og spør på nytt.',
  threadNotFoundTitle: 'Tråden er borte',
  threadNotFoundWhat: 'Tråden finnes ikke lenger, kanskje fordi den er slettet et annet sted.',
  threadNotFoundAdvice: 'Start en ny tråd, og still spørsmålet der.',
  unknownTitle: 'Svaret kom ikke fram',
  unknownWhat: 'Noe gikk galt da svaret skulle hentes.',
  unknownAdvice: 'Tjenesten sa ikke hva, så det eneste å gjøre er å stille spørsmålet på nytt.',
});

export const enStates = {
  retry: 'Try again',
  goHome: 'Go to the front page',
  notFoundTitle: 'The page does not exist',
  notFoundDescription:
    'The address leads nowhere. It may be mistyped, or point to something that is gone.',
  crashTitle: 'Something went wrong',
  crashText: 'The page could not be shown. Reload the page to continue.',
  crashOutside:
    'This can happen when a browser extension, or a translation of the page, changes its content while the page updates.',
  reload: 'Reload',
  crashDetails: 'The error message',
  assistant: 'The assistant',
  modelTitle: 'The assistant did not answer',
  modelWhat: 'The language model that writes the answer did not respond.',
  modelAdvice: 'Nothing else has changed, so the question can be asked as it is.',
  retrievalTitle: 'The document search did not answer',
  retrievalWhat: '{name} could not search the documents, so the answer had nothing to build on.',
  retrievalAdvice:
    'It is the search that is down, not your question, which stands as you wrote it.',
  timeoutTitle: 'The answer took too long',
  timeoutWhat: 'The question was stopped because the answer took too long.',
  timeoutAdvice: 'A narrower question is usually faster.',
  unauthorizedTitle: 'No access',
  unauthorizedWhat: '{name} refused the key that gives access to the service.',
  unauthorizedAdvice:
    'Reload the page and sign in again. If the message is still there, someone with access to the service needs to look at it.',
  rateLimitedTitle: 'Too many questions in a short time',
  rateLimitedWhat:
    'The service received too many questions in a short time and set this one aside.',
  rateLimitedAdvice: 'Wait a moment, and it usually goes through.',
  tooLongTitle: 'The question is too long',
  tooLongWhat: 'The question is longer than the service accepts.',
  tooLongAdvice: 'Shorten it, for example by splitting it in two questions, and send it again.',
  filterRefusedTitle: 'The filter cannot be used',
  filterRefusedWhat: 'The service does not accept the filter as it is chosen.',
  filterRefusedAdvice: 'Change the filter, and ask again.',
  threadNotFoundTitle: 'The thread is gone',
  threadNotFoundWhat: 'The thread no longer exists, perhaps because it was deleted elsewhere.',
  threadNotFoundAdvice: 'Start a new thread, and ask there.',
  unknownTitle: 'The answer did not arrive',
  unknownWhat: 'Something went wrong while the answer was being fetched.',
  unknownAdvice: 'The service did not say what, so the only thing to do is ask the question again.',
} satisfies Translation<typeof nbStates>;

/**
 * The states' own catalogue. It stays out of the package's shared one, so a host that imports
 * another block, such as Approach, does not load these words. A block that borrows them puts this
 * namespace in its own catalogue.
 */
export const nb = defineCatalogue({ states: nbStates });
export const en = { states: enStates } satisfies Translation<typeof nb>;

export const { useT, translator } = defineTranslations({ nb, en });
