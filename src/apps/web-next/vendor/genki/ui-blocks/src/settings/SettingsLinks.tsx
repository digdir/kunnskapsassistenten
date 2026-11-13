import { Link } from '@digdir/designsystemet-react';
import { CogIcon } from '@navikt/aksel-icons';
import type { ReactNode } from 'react';
import { plainClick } from '../dom.js';
import { useT } from './i18n.js';

/** One of the host's pages, linked after «Innstillinger». */
export interface SettingsLinkItem {
  href: string;
  title: string;
  /** An icon before the title, `aria-hidden`. */
  icon?: ReactNode;
}

export interface SettingsLinksProps {
  /** The address of the page that holds `Settings`. Its link comes first. */
  settingsHref: string;
  /** The host's pages after it, such as the pages about the service. */
  links?: readonly SettingsLinkItem[] | undefined;
  /** The address on screen. Its link is marked with `aria-current`. */
  currentHref?: string | undefined;
  /** A plain click, for a host with its own router. A click for a new tab is the browser's. */
  onNavigate?: ((href: string) => void) | undefined;
  /** What the service is called, in the list's name: «Innstillinger og om {name}». */
  assistantName?: string | undefined;
  className?: string | undefined;
}

/** «Innstillinger» first, then the host's pages: a named list, as the panel is already the nav. */
export const SettingsLinks = ({
  settingsHref,
  links = [],
  currentHref,
  onNavigate,
  assistantName,
  className,
}: SettingsLinksProps) => {
  const t = useT();
  const items = [
    { href: settingsHref, title: t('settings.title'), icon: <CogIcon aria-hidden /> },
    ...links,
  ];
  // The name says both halves, as a screen reader reads it before «Innstillinger».
  const label =
    links.length === 0
      ? t('settings.title')
      : assistantName
        ? t('settings.linksLabel', { name: assistantName })
        : t('settings.linksLabelUnnamed');

  return (
    <ul aria-label={label} className={['uib-settings-links', className].filter(Boolean).join(' ')}>
      {items.map(({ href, title, icon }) => (
        <li key={href}>
          <Link
            aria-current={href === currentHref ? 'page' : undefined}
            data-size="sm"
            href={href}
            onClick={(event) => {
              if (!onNavigate || !plainClick(event)) return;
              event.preventDefault();
              onNavigate(href);
            }}
          >
            {icon}
            {title}
          </Link>
        </li>
      ))}
    </ul>
  );
};
