// KA's entries in genki's profile menu: «Endringslogg» and «Om prosjektet», this client's own pages.
import type { AssistantProfile } from '@genai/ui-assembly';
import { BookIcon } from '@navikt/aksel-icons';
import { ABOUT_PATH, CHANGELOG_PATH, pageFrom } from './pages/paths';

export { ABOUT_PATH, CHANGELOG_PATH };
export const ABOUT_LABEL = 'Om prosjektet';

/**
 * The menu. Each page is a page load of its own, opened with the assistant's address in `fra`,
 * so its way back returns to the thread the person was in.
 */
export const menuFor = (
  go: (href: string) => void = (href) => location.assign(href),
): NonNullable<AssistantProfile['menu']> => ({
  // genki's own entry, in its words: «Endringslogg».
  changelog: { href: CHANGELOG_PATH, onSelect: () => go(pageFrom(CHANGELOG_PATH)) },
  extra: [
    // KA's page is «Om prosjektet», not genki's «Om tjenesten», with the previous client's icon.
    {
      id: 'about',
      label: ABOUT_LABEL,
      href: ABOUT_PATH,
      onSelect: () => go(pageFrom(ABOUT_PATH)),
      icon: <BookIcon />,
    },
  ],
});
