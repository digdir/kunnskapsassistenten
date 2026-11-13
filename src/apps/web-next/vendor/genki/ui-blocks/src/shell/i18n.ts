import { defineCatalogue, defineNamespace, type Translation } from '@genai/i18n';
import { defineTranslations } from '@genai/i18n/react';

// `{panel}` is the panel's own name, lower-cased: «Skjul tråder og filter».
export const nbShell = defineNamespace({
  skipToMain: 'Hopp til hovedinnhold',
  // The word beside the icon, which the button's name starts with (WCAG 2.5.3).
  hide: 'Skjul',
  hidePanel: 'Skjul {panel}',
  showPanel: 'Vis {panel}',
  closePanel: 'Lukk {panel}',
  resizePanel: 'Endre bredde på {panel}',
  // The separator's value while a drag has folded the panel.
  hidden: 'Skjult',
  // Without a unit, `aria-valuenow` is read as a bare number.
  width: '{width} piksler',
  // The name of the secondary panel's tabs, and of its dropdown, when it holds more than one tool.
  tools: 'Verktøy',
  // The tinted dropdown's button: the tool it shows, then what it does.
  toolChoice: '{tool}, velg verktøy',
  // The profile menu's entries, the design's words (dev-navbar), and the dot's words for a screen
  // reader. `{to}` is whom the reader contacts: «Kontakt Digdir».
  profileSettings: 'Innstillinger',
  profileFeedback: 'Gi tilbakemelding',
  profileChangelog: 'Endringslogg',
  profileNews: 'Nytt',
  profileAbout: 'Om tjenesten',
  profileContact: 'Kontakt {to}',
  profileSignOut: 'Logg ut',
});

export const enShell = {
  skipToMain: 'Skip to main content',
  hide: 'Hide',
  hidePanel: 'Hide {panel}',
  showPanel: 'Show {panel}',
  closePanel: 'Close {panel}',
  resizePanel: 'Resize {panel}',
  hidden: 'Hidden',
  width: '{width} pixels',
  tools: 'Tools',
  toolChoice: '{tool}, choose a tool',
  profileSettings: 'Settings',
  profileFeedback: 'Give feedback',
  profileChangelog: 'Changelog',
  profileNews: 'New',
  profileAbout: 'About the service',
  profileContact: 'Contact {to}',
  profileSignOut: 'Sign out',
} satisfies Translation<typeof nbShell>;

/** The shell's own catalogue, apart from the shared one, so a host loads only its words. */
export const nb = defineCatalogue({ shell: nbShell });
export const en = { shell: enShell } satisfies Translation<typeof nb>;

export const { useT, translator } = defineTranslations({ nb, en });
