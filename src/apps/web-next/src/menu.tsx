// KA's entries in genki's profile menu: apps/web's info pages and the way back to apps/web.
import type { AssistantProfile } from '@genai/ui-assembly';
import { ArrowUndoIcon, InformationIcon } from '@navikt/aksel-icons';

export const CHANGELOG_PATH = '/endringslogg';
export const ABOUT_PATH = '/om-prosjektet';
export const ABOUT_LABEL = 'Om prosjektet';
export const BACK_LABEL = 'Tilbake til gammel versjon';

/** The menu, with `onSwitchBack` for «Tilbake til gammel versjon». */
export const menuFor = (onSwitchBack: () => void): NonNullable<AssistantProfile['menu']> => ({
  // genki's own entry, in its words: «Endringslogg».
  changelog: { href: CHANGELOG_PATH },
  extra: [
    // KA's page is «Om prosjektet», not genki's «Om tjenesten».
    { id: 'about', label: ABOUT_LABEL, href: ABOUT_PATH, icon: <InformationIcon /> },
    {
      id: 'back-to-classic',
      label: BACK_LABEL,
      onSelect: onSwitchBack,
      icon: <ArrowUndoIcon />,
    },
  ],
});
