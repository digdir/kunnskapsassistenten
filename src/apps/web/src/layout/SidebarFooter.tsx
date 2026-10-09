import { Link } from '@digdir/designsystemet-react';
import { Link as RouterLink, useLocation } from 'react-router';
import { infoPages } from '../routes/info/infoPages';
import { ColorSchemeToggle } from './ColorSchemeToggle';

/**
 * The foot of the navigation panel: the pages about Kunnskapsassistenten, then the colour scheme.
 * A named list, not a `nav`: the panel is already the navigation landmark, and a second one
 * would announce two places to navigate from.
 */
export function SidebarFooter() {
  const { pathname } = useLocation();

  return (
    <div className="sidebar-footer">
      <ul className="sidebar-footer__links" aria-label="Om Kunnskapsassistenten">
        {infoPages.map(({ path, title, Icon }) => {
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
      </ul>

      <ColorSchemeToggle />
    </div>
  );
}
