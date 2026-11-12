import { defineCatalogue, defineNamespace, type Translation } from '@genai/i18n';
import { defineTranslations } from '@genai/i18n/react';

export const nbWelcome = defineNamespace({
  greeting: 'Hei, {name}',
  greetingUnnamed: 'Hei',
  question: 'Hva lurer du på?',
  suggestions: 'Forslag',
});

export const enWelcome = {
  greeting: 'Hi, {name}',
  greetingUnnamed: 'Hi',
  question: 'What would you like to know?',
  suggestions: 'Suggestions',
} satisfies Translation<typeof nbWelcome>;

/**
 * The welcome's own catalogue. It stays out of the package's shared one, so a host that imports
 * another block, such as Approach, does not load these words. A block that borrows them puts this
 * namespace in its own catalogue.
 */
export const nb = defineCatalogue({ welcome: nbWelcome });
export const en = { welcome: enWelcome } satisfies Translation<typeof nb>;

export const { useT, translator } = defineTranslations({ nb, en });
