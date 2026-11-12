import { Link } from '@digdir/designsystemet-react';
import { CogIcon } from '@navikt/aksel-icons';
import { Link as RouterLink, useLocation } from 'react-router';
import { TryNextVersion } from '../nextVersion/TryNextVersion';
import { infoPages } from '../routes/info/infoPages';
import { SETTINGS_PATH, SETTINGS_TITLE } from '../routes/settings/SettingsPage';

/** Settings first, then the pages about Kunnskapsassistenten. */
const footerLinks = [
  { path: SETTINGS_PATH, title: SETTINGS_TITLE, Icon: CogIcon },
  ...infoPages.map(({ path, title, Icon }) => ({ path, title, Icon })),
];

/**
 * The foot of the navigation panel: settings and the pages about Kunnskapsassistenten. The colour
 * scheme moved to the settings page.
 * A named list, not a `nav`: the panel is already the navigation landmark, and a second one
 * would announce two places to navigate from. The name says both halves, since Innstillinger
 * comes first and a screen reader reads the name before it.
 */
export function SidebarFooter() {
  const { pathname } = useLocation();

  return (
    <div className="sidebar-footer">
      <ul className="sidebar-footer__links" aria-label="Innstillinger og om Kunnskapsassistenten">
        {footerLinks.map(({ path, title, Icon }) => {
          const to = `/${path}`;
          return (
            <li key={path}>
              <Link asChild data-size="sm">
                <RouterLink to={to} aria-current={pathname === to ? 'page' : undefined}>
                  <Icon aria-hidden />
                  {title}
                </RouterLink>
              </Link>
            </li>
          );
        })}
        <TryNextVersion />
      </ul>
    </div>
  );
}
