import { Badge, Link } from '@digdir/designsystemet-react';
import { ChevronLeftIcon } from '@navikt/aksel-icons';
import { useId } from 'react';
import { classes, plainClick } from '../dom.js';
import { generalSummary, type SettingsGeneralRow } from './general.js';
import { useT } from './i18n.js';

/** The settings pages the block draws, in the design's order (the dev-innstillinger boards). */
export const settingsPageIds = ['general', 'about-you', 'beta', 'privacy'] as const;

export type SettingsPageId = (typeof settingsPageIds)[number];

/** For a host reading a stored or addressed page: anything else is no page. */
export const isSettingsPageId = (value: unknown): value is SettingsPageId =>
  settingsPageIds.some((id) => id === value);

/** One page in the menu. The block's own pages have their words; a host's names its own. */
export interface SettingsMenuItem {
  id: string;
  /** Its name. The block's pages have theirs without it. */
  title?: string | undefined;
  /** One line under the name, «Rolle og kontekst». */
  summary?: string | undefined;
  /** «Generelt»'s rows, from `generalRowsOf`: its line names these, and none without them. */
  rows?: readonly SettingsGeneralRow[] | undefined;
  /** How many are on, as Beta-funksjoner counts the trials turned on. No badge at 0. */
  badge?: number | undefined;
}

export interface SettingsMenuProps {
  /** The pages, in order. */
  pages: readonly SettingsMenuItem[];
  /** The page on screen. */
  value: string;
  /** The reader chose a page. */
  onChange: (id: string) => void;
  /** «Tilbake til trådene»: where the conversation is. Not drawn without it. */
  backHref?: string | undefined;
  /** A plain click on «Tilbake til trådene», for a host with its own router. */
  onBack?: (() => void) | undefined;
  className?: string | undefined;
}

type Translate = ReturnType<typeof useT>;

const ownWords = (t: Translate, { id, rows = [] }: SettingsMenuItem) => {
  switch (id) {
    case 'general':
      return { title: t('settings.general'), summary: generalSummary(t, rows) };
    case 'about-you':
      return { title: t('settings.aboutYou'), summary: t('settings.aboutYouSummary') };
    case 'beta':
      return { title: t('settings.beta'), summary: t('settings.betaSummary') };
    case 'privacy':
      return { title: t('settings.privacy'), summary: t('settings.privacySummary') };
    default:
      return { title: id, summary: undefined };
  }
};

/**
 * The primary panel while «Innstillinger» is open: «Tilbake til trådene», then one entry per page
 * with its line under it, the page on screen marked (dev-innstillinger-1 to -4). A list, not a
 * `nav`: the panel the host puts it in is already the navigation.
 */
export const SettingsMenu = ({
  pages,
  value,
  onChange,
  backHref,
  onBack,
  className,
}: SettingsMenuProps) => {
  const t = useT();
  const id = useId();
  return (
    <div className={classes('uib-settings-menu', className)}>
      {backHref ? (
        <Link
          className="uib-settings-menu-back"
          href={backHref}
          onClick={(event) => {
            if (!onBack || !plainClick(event)) return;
            event.preventDefault();
            onBack();
          }}
        >
          <ChevronLeftIcon aria-hidden />
          {t('settings.backToThreads')}
        </Link>
      ) : null}
      <ul aria-label={t('settings.pagesLabel')} className="uib-settings-menu-pages">
        {pages.map((page) => {
          const own = ownWords(t, page);
          const title = page.title ?? own.title;
          const summary = page.summary ?? own.summary;
          const badge = page.badge ?? 0;
          // Named by its name, the line under it its description, so a screen reader hears them
          // apart.
          const ids = { title: `${id}-${page.id}`, summary: `${id}-${page.id}-summary` };
          return (
            <li key={page.id}>
              <button
                aria-current={page.id === value ? 'page' : undefined}
                aria-describedby={summary ? ids.summary : undefined}
                aria-labelledby={ids.title}
                // Designsystemet's focus ring, as the shell's own buttons have it.
                className="uib-settings-menu-page ds-focus"
                onClick={() => onChange(page.id)}
                type="button"
              >
                <span className="uib-settings-menu-title" id={ids.title}>
                  {title}
                  {badge > 0 ? (
                    <>
                      {/* The count is drawn by Designsystemet's CSS, so it is said in words too. */}
                      <Badge aria-hidden className="uib-settings-menu-badge" count={badge} />
                      <span className="ds-sr-only">
                        {' '}
                        ({t('settings.betaOn', { count: badge })})
                      </span>
                    </>
                  ) : null}
                </span>
                {summary ? (
                  <span className="uib-settings-menu-summary" id={ids.summary}>
                    {summary}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
