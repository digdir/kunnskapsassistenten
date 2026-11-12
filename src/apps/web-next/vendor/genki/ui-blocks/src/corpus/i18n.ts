import { defineCatalogue, defineNamespace, type Translation } from '@genai/i18n';
import { defineTranslations } from '@genai/i18n/react';

export const nbCorpus = defineNamespace({
  label: 'Dokumentsamling',
  switched: 'Dokumentsamling: {name}',
  switchedReset:
    'Dokumentsamling: {name}. Filteret er nullstilt fordi dokumentsamlingen ble byttet.',
  source: 'Dokumenter fra {name}',
  unnamed: 'standardsamlingen',
  documents: { one: '{count} dokument', other: '{count} dokumenter' },
  andMore: '{types} med flere',
  more: 'Vis mer',
  less: 'Vis mindre',
  moreAbout: 'Vis mer om dokumentsamlingen',
  lessAbout: 'Vis mindre om dokumentsamlingen',
});

export const enCorpus = {
  label: 'Document collection',
  switched: 'Document collection: {name}',
  switchedReset:
    'Document collection: {name}. The filter was reset because the document collection changed.',
  source: 'Documents from {name}',
  unnamed: 'the default collection',
  documents: { one: '{count} document', other: '{count} documents' },
  andMore: '{types} and more',
  more: 'Show more',
  less: 'Show less',
  moreAbout: 'Show more about the document collection',
  lessAbout: 'Show less about the document collection',
} satisfies Translation<typeof nbCorpus>;

/** The collection's own catalogue, apart from the shared one, so a host loads only its words. */
export const nb = defineCatalogue({ corpus: nbCorpus });
export const en = { corpus: enCorpus } satisfies Translation<typeof nb>;

export const { useT, translator } = defineTranslations({ nb, en });
