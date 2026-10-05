import { BookIcon, WrenchIcon } from '@navikt/aksel-icons';
import type { ComponentType, SVGProps } from 'react';
import { InfoPage, type InfoPart } from './InfoPage';
import { endringsloggParts } from './endringsloggParts';
import { omProsjektetParts } from './omProsjektetParts';
import { onboardingParts } from './onboardingParts';

export type InfoPageEntry = {
  /** Route and link target, without a leading slash — see App.tsx. */
  path: string;
  /** The page's name, on the link and as its heading. */
  title: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  parts: InfoPart[];
};

/**
 * The three pages about Kunnskapsassistenten itself, in the order the old
 * Kunnskapsassistenten lists them at the foot of its sidebar (Simens issue
 * 85, design/_sources/eksisterende-ka-sider/lenkene-i-foten.png).
 *
 * One list and not two, because the address, the name and the icon are needed
 * in two places that must not drift: the links in `SidebarFooter` and the
 * routes in `App.tsx`. Adding a page here is enough to get both.
 *
 * Norwegian addresses, unlike `/threads/:threadId`: these are the addresses
 * the old Kunnskapsassistenten uses (`/onboarding`, `/endringslogg`,
 * `/om-prosjektet`), and a link somebody saved should still land somewhere.
 *
 * The icons are the old page's own — a book for the two pages that explain
 * something and a wrench for the changelog. Imported straight from
 * aksel-icons: neither carries a side in its name, so neither goes through
 * `src/components/icons.ts` (regler.md).
 */
export const infoPages: InfoPageEntry[] = [
  { path: 'onboarding', title: 'Onboarding', Icon: BookIcon, parts: onboardingParts },
  { path: 'endringslogg', title: 'Endringslogg', Icon: WrenchIcon, parts: endringsloggParts },
  { path: 'om-prosjektet', title: 'Om prosjektet', Icon: BookIcon, parts: omProsjektetParts },
];

/** The element the route mounts for one entry. */
export function infoPageElement({ title, parts }: InfoPageEntry) {
  return <InfoPage title={title} parts={parts} />;
}
