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
 * The pages about Kunnskapsassistenten, in the previous client's order. One list, so the links
 * in `SidebarFooter` and the routes in `App.tsx` cannot drift. The Norwegian paths are the
 * previous client's, so saved links still land somewhere.
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
