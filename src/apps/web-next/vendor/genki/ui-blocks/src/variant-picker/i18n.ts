import { defineCatalogue, defineNamespace, type Translation } from '@genai/i18n';
import { defineTranslations } from '@genai/i18n/react';

export const nbVariantPicker = defineNamespace({
  label: 'Variant: {title}',
  default: 'Standard',
  heading: 'Velg variant',
});

export const enVariantPicker = {
  label: 'Variant: {title}',
  default: 'Default',
  heading: 'Choose a variant',
} satisfies Translation<typeof nbVariantPicker>;

/**
 * The variant picker's own catalogue. It stays out of the package's shared one, so a host that
 * imports another block, such as Approach, does not load these words. A block that borrows them
 * puts this namespace in its own catalogue.
 */
export const nb = defineCatalogue({ variantPicker: nbVariantPicker });
export const en = { variantPicker: enVariantPicker } satisfies Translation<typeof nb>;

export const { useT, translator } = defineTranslations({ nb, en });
