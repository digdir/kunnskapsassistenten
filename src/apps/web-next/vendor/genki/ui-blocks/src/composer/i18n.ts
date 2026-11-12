import { defineCatalogue, defineNamespace, type Translation } from '@genai/i18n';
import { defineTranslations } from '@genai/i18n/react';

export const nbComposer = defineNamespace({
  field: 'Spørsmål til {name}',
  fieldUnnamed: 'Spørsmål til assistenten',
  placeholder: 'Hva vil du vite mer om?',
  send: 'Send spørsmålet',
  cancel: 'Avbryt',
  cancelLabel: 'Avbryt genereringen',
  disclaimer: '{name} kan gjøre feil. Husk å sjekke viktig informasjon.',
  disclaimerUnnamed: 'Assistenten kan gjøre feil. Husk å sjekke viktig informasjon.',
  shortcutHint: 'Trykk {key} + / for å hoppe hit',
  shortcutDescription:
    'Trykk Ctrl og skråstrek, eller Cmd og skråstrek, for å flytte skrivemerket hit fra hvor som helst på siden.',
  scrollToBottom: 'Bla til bunnen',
  attach: 'Legg ved dokument',
  attachTypes: 'Legg ved dokument ({types})',
  attachSoon: 'Kommer snart',
  attachSoonLabel: 'Legg ved dokument, kommer snart',
  attachments: 'Vedlegg til spørsmålet',
  remove: 'Fjern vedlegget {name}',
  retry: 'Prøv igjen',
  retryLabel: 'Prøv å laste opp {name} på nytt',
  dropHint: 'Slipp filen for å legge den ved',
  waitForUploads: 'Vent til vedlegget er lastet opp.',
  tooLarge: 'Filen er større enn {max} MB.',
  tooLargeUnknown: 'Filen er for stor.',
  wrongType: 'Filtypen støttes ikke. Last opp {types}.',
  wrongTypeUnknown: 'Filtypen støttes ikke.',
  failed: 'Opplastingen gikk ikke gjennom.',
  unavailable: 'Opplasting er ikke tilgjengelig i denne tjenesten ennå.',
  uploading: 'Laster opp {name}.',
  uploaded: '{name} er lastet opp og lagt ved.',
  notAttached: '{name} ble ikke lagt ved. {reason}',
});

export const enComposer = {
  field: 'Question for {name}',
  fieldUnnamed: 'Question for the assistant',
  placeholder: 'What would you like to know more about?',
  send: 'Send the question',
  cancel: 'Cancel',
  cancelLabel: 'Cancel the generation',
  disclaimer: '{name} can make mistakes. Remember to check important information.',
  disclaimerUnnamed: 'The assistant can make mistakes. Remember to check important information.',
  shortcutHint: 'Press {key} + / to jump here',
  shortcutDescription:
    'Press Ctrl and slash, or Cmd and slash, to move the cursor here from anywhere on the page.',
  scrollToBottom: 'Scroll to the bottom',
  attach: 'Attach a document',
  attachTypes: 'Attach a document ({types})',
  attachSoon: 'Coming soon',
  attachSoonLabel: 'Attach a document, coming soon',
  attachments: 'Attachments to the question',
  remove: 'Remove the attachment {name}',
  retry: 'Try again',
  retryLabel: 'Try uploading {name} again',
  dropHint: 'Drop the file to attach it',
  waitForUploads: 'Wait until the attachment has uploaded.',
  tooLarge: 'The file is larger than {max} MB.',
  tooLargeUnknown: 'The file is too large.',
  wrongType: 'The file type is not supported. Upload {types}.',
  wrongTypeUnknown: 'The file type is not supported.',
  failed: 'The upload did not go through.',
  unavailable: 'Uploading is not available in this service yet.',
  uploading: 'Uploading {name}.',
  uploaded: '{name} is uploaded and attached.',
  notAttached: '{name} was not attached. {reason}',
} satisfies Translation<typeof nbComposer>;

/**
 * The question field's own catalogue. It stays out of the package's shared one, so a host that
 * imports another block, such as Approach, does not load these words. A block that borrows them
 * puts this namespace in its own catalogue.
 */
export const nb = defineCatalogue({ composer: nbComposer });
export const en = { composer: enComposer } satisfies Translation<typeof nb>;

export const { useT, translator } = defineTranslations({ nb, en });
