// KA's entries in genki's profile menu: apps/web's info pages and the way back to apps/web.
import type { AssistantProfile } from '@genai/ui-assembly';
import { ArrowUndoIcon, BookIcon } from '@navikt/aksel-icons';

export const CHANGELOG_PATH = '/endringslogg';
export const ABOUT_PATH = '/om-prosjektet';
export const ABOUT_LABEL = 'Om prosjektet';
export const BACK_LABEL = 'Tilbake til gammel versjon';

/** apps/web's page, with this client's address in `fra` for its «Tilbake til ny versjon». */
export const pageFrom = (path: string, here = `${location.pathname}${location.search}`) =>
  `${path}?${new URLSearchParams({ fra: here })}`;

/** The menu, with `onSwitchBack` for «Tilbake til gammel versjon». */
export const menuFor = (
  onSwitchBack: () => void,
  go: (href: string) => void = (href) => location.assign(href),
): NonNullable<AssistantProfile['menu']> => ({
  // genki's own entry, in its words: «Endringslogg».
  changelog: { href: CHANGELOG_PATH, onSelect: () => go(pageFrom(CHANGELOG_PATH)) },
  extra: [
    // KA's page is «Om prosjektet», not genki's «Om tjenesten», with apps/web's icon for it.
    {
      id: 'about',
      label: ABOUT_LABEL,
      href: ABOUT_PATH,
      onSelect: () => go(pageFrom(ABOUT_PATH)),
      icon: <BookIcon />,
    },
    {
      id: 'back-to-classic',
      label: BACK_LABEL,
      onSelect: onSwitchBack,
      icon: <ArrowUndoIcon />,
    },
  ],
});
