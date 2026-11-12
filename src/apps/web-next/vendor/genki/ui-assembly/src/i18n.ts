// The assembly's words, with bokmål as the source and English held to it, as the blocks keep
// theirs. The blocks' catalogue is part of it, so a word a block already has is read from there:
// the blocks' names from `builder`, «Ny tråd» from `threads`, «Avgrenset til» from `conversation`,
// «Vis i dokumentet» from `documentView`.
import { defineCatalogue, defineNamespace, intlLocale, type Translation } from '@genai/i18n';
import { defineTranslations } from '@genai/i18n/react';
import { uiBlocksEn, uiBlocksNb } from '@genai/ui-blocks';

const nbAssembly = defineNamespace({
  threadNotFoundTitle: 'Fant ikke tråden',
  threadNotFound: 'Den kan være slettet, eller lenken kan være feil.',
  threadFailed: 'Kunne ikke hente tråden',
  // Why, in the reader's words, never the error's own (kunnskapsassistenten's LiveChatClient).
  unreached: 'Fikk ikke kontakt med tjenesten.',
  answeredWithStatus: 'Tjenesten svarte med feilkode {status}.',
  emptyThreadTitle: 'Tråden har ingen meldinger ennå',
  emptyThread: 'Still et spørsmål for å starte samtalen.',
  serviceFailedTitle: 'Fikk ikke kontakt med tjenesten',
  serviceFailed: 'Spørsmål kan ikke sendes før tjenesten svarer.',
  serviceFailedStatus:
    'Spørsmål kan ikke sendes før tjenesten svarer. Den svarte med feilkode {status}.',
  technicalDetails: 'Tekniske detaljer',
  stripChange: 'Endre',
  stripClose: 'Lukk',
  // The next look's filter panel beside the threads, as dev-filter-panel names its region.
  filterForThread: 'Filter for tråden',
  // The next look's secondary panel, as the dev-verktoy boards name it: «Skjul verktøypanelet».
  toolsPanel: 'Verktøypanelet',
  approachEmpty: 'Fremgangsmåten vises her når du stiller et spørsmål.',
  approachNotKept:
    'Fremgangsmåten lagres ikke med svarene i tråden. Den vises her når du stiller et nytt spørsmål.',
  approachWaiting: 'Venter på det første steget …',
  noChatTitle: 'Legg Chat i innholdet for å prøve assistenten.',
  noChat: 'Uten Chat er det ingen samtale å prøve.',
  emptyMain: 'Ingen klosser i innholdet.',
  skipToField: 'Hopp til skrivefeltet ({modifier} + /)',
  corpusChanged: 'Byttet til {corpus}. Du har fått en ny tråd, og filteret er tømt.',
  tabTitle: '{page} – {assistant}',
  aboutDocument: 'Om «{title}»: {question}',
  // What a host that only tries the assistant says in place of sending (`useLogOnly`).
  logOnlyFeedback: 'Ville sendt tilbakemelding: {rating}. Ikke sendt i forhåndsvisningen.',
  logOnlyFeedbackReasons:
    'Ville sendt tilbakemelding: {rating} ({reasons}). Ikke sendt i forhåndsvisningen.',
  ratingUp: 'tommel opp',
  ratingDown: 'tommel ned',
  logOnlyRename:
    'Ville gitt tråden nytt navn: «{title}». Ikke endret i genki: det gamle navnet er tilbake når du laster siden på nytt.',
  logOnlyDelete:
    'Ville slettet tråden «{title}». Ikke slettet i genki: den er tilbake når du laster siden på nytt.',
  stepPlanQueries: 'Forsto spørsmålet',
  stepInspectFilters: 'Så på hvilke kilder tråden leser fra',
  stepSearch: 'Lette etter steder som handler om spørsmålet',
  stepReadChunks: 'Leste de relevante delene nøye',
  stepRerankResults: 'Valgte ut det som svarer på spørsmålet',
  stepReportGaps: 'Det jeg ikke fant',
  stepGenerateResponse: 'Skrev svaret',
});

const enAssembly = {
  threadNotFoundTitle: 'Thread not found',
  threadNotFound: 'It may have been deleted, or the link may be wrong.',
  threadFailed: 'Could not load the thread',
  unreached: 'Could not reach the service.',
  answeredWithStatus: 'The service answered with error code {status}.',
  emptyThreadTitle: 'The thread has no messages yet',
  emptyThread: 'Ask a question to start the conversation.',
  serviceFailedTitle: 'Could not reach the service',
  serviceFailed: 'Questions cannot be sent until the service answers.',
  serviceFailedStatus:
    'Questions cannot be sent until the service answers. It answered with error code {status}.',
  technicalDetails: 'Technical details',
  stripChange: 'Change',
  stripClose: 'Close',
  filterForThread: 'The thread’s filter',
  toolsPanel: 'Tool panel',
  approachEmpty: 'The approach shows here when you ask a question.',
  approachNotKept:
    'The approach is not kept with the answers in the thread. It shows here when you ask a new question.',
  approachWaiting: 'Waiting for the first step …',
  noChatTitle: 'Put Chat in the content to try the assistant.',
  noChat: 'Without Chat there is no conversation to try.',
  emptyMain: 'No blocks in the content.',
  skipToField: 'Skip to the question field ({modifier} + /)',
  corpusChanged: 'Switched to {corpus}. You have a new thread, and the filter is cleared.',
  tabTitle: '{page} – {assistant}',
  aboutDocument: 'About “{title}”: {question}',
  logOnlyFeedback: 'Would have sent feedback: {rating}. Not sent in the preview.',
  logOnlyFeedbackReasons:
    'Would have sent feedback: {rating} ({reasons}). Not sent in the preview.',
  ratingUp: 'thumbs up',
  ratingDown: 'thumbs down',
  logOnlyRename:
    'Would have renamed the thread “{title}”. Not changed in genki: the old name is back when you reload the page.',
  logOnlyDelete:
    'Would have deleted the thread “{title}”. Not deleted in genki: it is back when you reload the page.',
  stepPlanQueries: 'Understood the question',
  stepInspectFilters: 'Looked at which sources the thread reads from',
  stepSearch: 'Looked for passages about the question',
  stepReadChunks: 'Read the relevant parts closely',
  stepRerankResults: 'Picked what answers the question',
  stepReportGaps: 'What I did not find',
  stepGenerateResponse: 'Wrote the answer',
} satisfies Translation<typeof nbAssembly>;

export const nb = defineCatalogue({ ...uiBlocksNb, assembly: nbAssembly });
export const en = { ...uiBlocksEn, assembly: enAssembly } satisfies Translation<typeof nb>;

export const { useT, translator } = defineTranslations({ nb, en });

export type AssemblyTranslator = ReturnType<typeof translator>;

/**
 * A panel named after what is in it, as one phrase in the reader's language: «Tråder og filter»,
 * «Fremgangsmåte, kilder og dokumentvisning».
 */
export const phrase = (t: AssemblyTranslator, parts: readonly string[]) => {
  const tag = intlLocale(t.locale);
  return new Intl.ListFormat(tag, { type: 'conjunction' }).format(
    parts.map((part, at) => (at === 0 ? part : part.toLocaleLowerCase(tag))),
  );
};
