// «Generelt»'s menu line and lead, worded from the rows the page draws and from nothing else.
import type { useFormat } from '@genai/i18n/react';
import type { useT } from './i18n.js';

/** «Generelt»'s rows, by their props' names, in the order the page draws them. */
export const settingsGeneralRows = [
  'answerLanguage',
  'answerLength',
  'openWith',
  'colorScheme',
  'textSize',
] as const;

export type SettingsGeneralRow = (typeof settingsGeneralRows)[number];

/** The rows a «Generelt» given these props draws, for the menu's line under it. */
export const generalRowsOf = (
  props: Partial<Record<SettingsGeneralRow, unknown>>,
): SettingsGeneralRow[] => settingsGeneralRows.filter((row) => !!props[row]);

const words = {
  answerLanguage: { name: 'settings.generalLanguage', lead: 'settings.generalLanguageLead' },
  answerLength: { name: 'settings.generalLength', lead: 'settings.generalLengthLead' },
  openWith: { name: 'settings.generalOpenWith', lead: 'settings.generalOpenWithLead' },
  colorScheme: { name: 'settings.generalAppearance', lead: 'settings.generalAppearanceLead' },
  textSize: { name: 'settings.generalTextSize', lead: 'settings.generalTextSizeLead' },
} as const;

type Translate = ReturnType<typeof useT>;

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// Each row once, in the page's order, whatever order the host gives them in.
const inOrder = (rows: readonly SettingsGeneralRow[]) =>
  settingsGeneralRows.filter((row) => rows.includes(row));

/** «Språk, svarlengde, utseende»; nothing for no rows. */
export const generalSummary = (t: Translate, rows: readonly SettingsGeneralRow[]) => {
  const named = inOrder(rows).map((row) => t(words[row].name));
  return named.length > 0 ? capital(named.join(', ')) : undefined;
};

/** «Språket i svarene og hvordan tjenesten ser ut.»; nothing for no rows. */
export const generalLead = (
  t: Translate,
  f: ReturnType<typeof useFormat>,
  rows: readonly SettingsGeneralRow[],
) => {
  const offered = inOrder(rows).map((row) => t(words[row].lead));
  return offered.length > 0
    ? t('settings.generalLead', { rows: capital(f.list(offered)) })
    : undefined;
};
