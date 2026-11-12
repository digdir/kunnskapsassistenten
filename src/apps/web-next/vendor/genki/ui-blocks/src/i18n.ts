import { defineCatalogue, type Translation } from '@genai/i18n';
import { defineTranslations } from '@genai/i18n/react';
import { enBuilder, nbBuilder } from './builder/i18n.js';

/**
 * The package's shared catalogue, which holds the builder's words. Each block keeps its own words
 * apart from it; `catalogues.ts` gathers them all for hosts.
 */
export const nb = defineCatalogue({
  builder: nbBuilder,
});
export const en = {
  builder: enBuilder,
} satisfies Translation<typeof nb>;

export const { useT, translator } = defineTranslations({ nb, en });
