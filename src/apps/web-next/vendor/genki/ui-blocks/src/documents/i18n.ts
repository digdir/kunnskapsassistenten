import { defineCatalogue, defineNamespace, type Translation } from '@genai/i18n';
import { defineTranslations } from '@genai/i18n/react';
import { enCorpus, nbCorpus } from '../corpus/i18n.js';

// `{types}` is the file types a host takes, as a list: «PDF og .docx».

export const nbDocuments = defineNamespace({
  title: 'Dokumenter',
  from: 'Fra {name}',
  empty: 'Dokumentene som er relevante for søket ditt vises her.',
  showing: 'Viser {shown} av {total} dokumenter.',
  showMore: 'Vis flere dokumenter',
  opensInNewTab: '(åpnes i ny fane)',
  noLink: 'uten lenke',
  noLinkAlone: 'Uten lenke',
  own: 'Dine dokumenter',
  ownNew: 'Ny',
  ownSoon: 'Kommer snart',
  upload: 'Last opp egne dokumenter',
  uploadHint: 'Slipp filer her, eller velg dem selv. Kun {types} for øyeblikket, maks {max}.',
  uploadSoon: 'Snart kan du laste opp {types} her, maks {max}.',
  chooseFiles: 'Velg filer',
  uploading: 'Laster opp {name}',
  uploaded: '{name} er lastet opp',
  notUploaded: '{name} ble ikke lastet opp. {reason}',
  progress: 'Laster opp … {percent} %',
  remove: 'Fjern {name}',
  tooLarge: 'Filen er større enn {max}.',
  wrongType: 'Bare {types} kan lastes opp.',
  failed: 'Opplastingen mislyktes. Prøv igjen.',
  unavailable: 'Opplasting er ikke tilgjengelig i denne tjenesten ennå.',
  // «Dokumentene som blir med», the dev boards' box under the filter (dev-filter-panel).
  inScope: 'Dokumentene som blir med',
  inScopeHide: 'Skjul',
  inScopeShow: 'Vis',
  inScopeCount: 'Assistenten leser fra {count} av {total} dokumenter i {name}',
  inScopeCountOnly: {
    one: 'Assistenten leser fra {count} dokument i {name}',
    other: 'Assistenten leser fra {count} dokumenter i {name}',
  },
  inScopeHint: 'Mest relevante først. Fjern haken for å ta ut et dokument.',
  inScopeSearch: 'Søk i dokumentene som blir med',
  inScopeSearchHint: 'Søk i lista – tittel eller virksomhet',
  inScopeNone: 'Ingen dokumenter i lista passer med søket.',
});

export const enDocuments = {
  title: 'Documents',
  from: 'From {name}',
  empty: 'The documents relevant to your search are shown here.',
  showing: 'Showing {shown} of {total} documents.',
  showMore: 'Show more documents',
  opensInNewTab: '(opens in a new tab)',
  noLink: 'no link',
  noLinkAlone: 'No link',
  own: 'Your documents',
  ownNew: 'New',
  ownSoon: 'Coming soon',
  upload: 'Upload your own documents',
  uploadHint: 'Drop files here, or choose them. Only {types} for now, at most {max}.',
  uploadSoon: 'Soon you can upload {types} here, at most {max}.',
  chooseFiles: 'Choose files',
  uploading: 'Uploading {name}',
  uploaded: '{name} is uploaded',
  notUploaded: '{name} was not uploaded. {reason}',
  progress: 'Uploading … {percent} %',
  remove: 'Remove {name}',
  tooLarge: 'The file is larger than {max}.',
  wrongType: 'Only {types} can be uploaded.',
  failed: 'The upload failed. Try again.',
  unavailable: 'Uploading is not available in this service yet.',
  inScope: 'The documents included',
  inScopeHide: 'Hide',
  inScopeShow: 'Show',
  inScopeCount: 'The assistant reads from {count} of {total} documents in {name}',
  inScopeCountOnly: {
    one: 'The assistant reads from {count} document in {name}',
    other: 'The assistant reads from {count} documents in {name}',
  },
  inScopeHint: 'Most relevant first. Untick a document to leave it out.',
  inScopeSearch: 'Search the documents included',
  inScopeSearchHint: 'Search the list – title or organisation',
  inScopeNone: 'No document in the list matches the search.',
} satisfies Translation<typeof nbDocuments>;

/** The documents' own catalogue, with the collection's words, apart from the shared one. */
export const nb = defineCatalogue({ documents: nbDocuments, corpus: nbCorpus });
export const en = { documents: enDocuments, corpus: enCorpus } satisfies Translation<typeof nb>;

export const { useT, translator } = defineTranslations({ nb, en });
