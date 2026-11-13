import { defineCatalogue, type Translation } from '@genai/i18n';
import * as answerActions from './answer-actions/i18n.js';
import * as answer from './answer/i18n.js';
import * as approach from './approach/i18n.js';
import * as composer from './composer/i18n.js';
import * as conversation from './conversation/i18n.js';
import * as corpus from './corpus/i18n.js';
import * as documentView from './document-view/i18n.js';
import * as documents from './documents/i18n.js';
import * as filter from './filter/i18n.js';
import * as shared from './i18n.js';
import * as settings from './settings/i18n.js';
import * as shell from './shell/i18n.js';
import * as sources from './sources/i18n.js';
import * as states from './states/i18n.js';
import * as threads from './threads/i18n.js';
import * as variantPicker from './variant-picker/i18n.js';
import * as welcome from './welcome/i18n.js';

/**
 * Every block's words in one catalogue, exported as `uiBlocksNb` and `uiBlocksEn`, for a host that
 * writes its own text with them, as `@genai/ui-assembly` does. No block reads it: a block reads its
 * own catalogue, so a host that imports one block loads only that block's words.
 */
export const nb = defineCatalogue({
  ...shared.nb,
  ...approach.nb,
  ...sources.nb,
  ...answer.nb,
  ...conversation.nb,
  ...documentView.nb,
  ...states.nb,
  ...variantPicker.nb,
  ...threads.nb,
  ...composer.nb,
  ...welcome.nb,
  ...filter.nb,
  ...corpus.nb,
  ...documents.nb,
  ...settings.nb,
  ...answerActions.nb,
  ...shell.nb,
});
export const en = {
  ...shared.en,
  ...approach.en,
  ...sources.en,
  ...answer.en,
  ...conversation.en,
  ...documentView.en,
  ...states.en,
  ...variantPicker.en,
  ...threads.en,
  ...composer.en,
  ...welcome.en,
  ...filter.en,
  ...corpus.en,
  ...documents.en,
  ...settings.en,
  ...answerActions.en,
  ...shell.en,
} satisfies Translation<typeof nb>;
