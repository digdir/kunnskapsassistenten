import { Avatar, Divider, Dropdown } from '@digdir/designsystemet-react';
import {
  ChatExclamationmarkIcon,
  CogIcon,
  EnvelopeClosedIcon,
  InformationIcon,
  LeaveIcon,
  NewspaperIcon,
} from '@navikt/aksel-icons';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { classes, plainClick } from '../dom.js';
import { useT } from './i18n.js';

/** A page or an action in the profile menu. */
export interface ShellProfileEntry {
  /** Where it leads. Without `onSelect`, the browser follows it. */
  href?: string | undefined;
  /** A plain click, for a page in the app or an action such as a feedback form. */
  onSelect?: (() => void) | undefined;
}

/** One of the host's own entries, in its own words, such as a way back to an older client. */
export interface ShellProfileHostEntry extends ShellProfileEntry {
  /** Unique among the host's entries. */
  id: string;
  /** The entry's words, in the reader's language: the host's own, not the catalogue's. */
  label: string;
  /** Drawn before the words and hidden from screen readers, as the menu's own icons. */
  icon?: ReactNode | undefined;
}

export interface ShellProfileProps {
  /** The reader's name, as they know themselves. Nothing is drawn without it. */
  name?: string | undefined;
  /** Their organisation, under the name at the top of the menu. */
  organisation?: string | undefined;
  /** «Innstillinger». An entry the host does not give is not drawn. */
  settings?: ShellProfileEntry | undefined;
  /** «Gi tilbakemelding». */
  feedback?: ShellProfileEntry | undefined;
  /** «Endringslogg», with a dot only when `news` says something is new. */
  changelog?: (ShellProfileEntry & { news?: boolean | undefined }) | undefined;
  /** «Om tjenesten». */
  about?: ShellProfileEntry | undefined;
  /** «Kontakt {to}», as «Kontakt Digdir». */
  contact?: (ShellProfileEntry & { to: string }) | undefined;
  /** The host's own entries, in its order, after the pages above and before «Logg ut»'s line. */
  extra?: readonly ShellProfileHostEntry[] | undefined;
  /**
   * «Logg ut», under a line: a full navigation to the host's sign-out. `onSignOut` runs first, so
   * the host forgets what this browser kept for the reader.
   */
  signOut?: { href: string; onSignOut?: (() => void) | undefined } | undefined;
  /** Only the avatar, for a folded panel (`ShellPanel.railFoot`). */
  compact?: boolean | undefined;
  className?: string | undefined;
}

/** «Kari Marie Nordmann» → «KN»: the first and the last word's first letters. */
export const initialsOf = (name: string) => {
  const words = name.match(/\p{L}[\p{L}\p{M}'’-]*/gu) ?? [];
  const first = words[0]?.charAt(0) ?? '';
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? '') : '';
  return `${first}${last}`.toLocaleUpperCase('nb-NO');
};

/**
 * The reader at the foot of the primary panel: one button with their avatar and name, which
 * opens the profile menu above itself, the design's dev-navbar and dev-innstillinger-0-start. The
 * menu holds the host's pages, settings first, and «Logg ut» under a line. There is no cog.
 */
export const ShellProfile = ({
  name,
  organisation,
  settings,
  feedback,
  changelog,
  about,
  contact,
  extra,
  signOut,
  compact = false,
  className,
}: ShellProfileProps) => {
  const t = useT();
  // Controlled, as the thread menu: a choice closes it, as does a click outside and Escape.
  const [open, setOpen] = useState(false);
  if (!name) return null;
  const initials = initialsOf(name);

  const entry = (
    key: string,
    given: ShellProfileEntry | undefined,
    icon: ReactNode,
    label: string,
    after?: ReactNode,
  ) => {
    if (!given || (given.href === undefined && !given.onSelect)) return null;
    const content = (
      <>
        {icon}
        <span className="uib-shell-profile-label">{label}</span>
        {after}
      </>
    );
    return (
      <Dropdown.Item key={key}>
        {given.href !== undefined ? (
          <Dropdown.Button asChild>
            <a
              href={given.href}
              onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                setOpen(false);
                if (!given.onSelect || !plainClick(event)) return;
                event.preventDefault();
                given.onSelect();
              }}
            >
              {content}
            </a>
          </Dropdown.Button>
        ) : (
          <Dropdown.Button
            onClick={() => {
              setOpen(false);
              given.onSelect?.();
            }}
          >
            {content}
          </Dropdown.Button>
        )}
      </Dropdown.Item>
    );
  };

  const pages = [
    entry('settings', settings, <CogIcon aria-hidden />, t('shell.profileSettings')),
    entry(
      'feedback',
      feedback,
      <ChatExclamationmarkIcon aria-hidden />,
      t('shell.profileFeedback'),
    ),
    entry(
      'changelog',
      changelog,
      <NewspaperIcon aria-hidden />,
      t('shell.profileChangelog'),
      changelog?.news ? (
        // The accent's dot, as the avatar: something new is the content's, not the chrome's.
        <span className="uib-shell-profile-news" data-color="accent">
          <span className="ds-sr-only">{t('shell.profileNews')}</span>
        </span>
      ) : null,
    ),
    entry('about', about, <InformationIcon aria-hidden />, t('shell.profileAbout')),
    entry(
      'contact',
      contact,
      <EnvelopeClosedIcon aria-hidden />,
      t('shell.profileContact', { to: contact?.to ?? '' }),
    ),
    // Keyed apart from the menu's own, so a host's id never collides with «settings».
    ...(extra ?? []).map((own) =>
      entry(
        `host-${own.id}`,
        own,
        own.icon ? (
          <span aria-hidden className="uib-shell-profile-icon">
            {own.icon}
          </span>
        ) : null,
        own.label,
      ),
    ),
  ].filter(Boolean);

  return (
    <Dropdown.TriggerContext>
      <Dropdown.Trigger
        aria-label={name}
        className={classes(compact ? 'uib-shell-profile-rail' : 'uib-shell-profile', className)}
        // Pinned to neutral: the panel's own control, quiet as the panel's button.
        data-color="neutral"
        data-size="md"
        icon={compact}
        title={name}
        variant="tertiary"
      >
        {/* Accent, as the design draws it: the reader is content, not chrome. */}
        <Avatar aria-hidden data-color="accent" data-size="xs">
          {initials}
        </Avatar>
        {compact ? null : <span className="uib-shell-profile-name">{name}</span>}
      </Dropdown.Trigger>
      <Dropdown
        className="uib-shell-profile-menu"
        // Pinned to neutral as its button: the entries are the panel's own, grey as the design's.
        data-color="neutral"
        data-size="md"
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        open={open}
        placement="top-start"
      >
        <div className="uib-shell-profile-who">
          <Avatar aria-hidden data-color="accent" data-size="sm">
            {initials}
          </Avatar>
          <span className="uib-shell-profile-who-text">
            <span className="uib-shell-profile-who-name">{name}</span>
            {organisation ? (
              <span className="uib-shell-profile-who-organisation">{organisation}</span>
            ) : null}
          </span>
        </div>
        {/* Buttons and links, not role="menu", as Designsystemet recommends without the arrows. */}
        {pages.length > 0 ? <Dropdown.List>{pages}</Dropdown.List> : null}
        {signOut ? (
          <>
            {pages.length > 0 ? <Divider /> : null}
            <Dropdown.List>
              <Dropdown.Item>
                <Dropdown.Button asChild>
                  {/* A plain link, since signing out navigates; a middle click fires only `auxclick`. */}
                  <a
                    href={signOut.href}
                    onAuxClick={(event) => {
                      if (event.button === 1) signOut.onSignOut?.();
                    }}
                    onClick={() => {
                      setOpen(false);
                      signOut.onSignOut?.();
                    }}
                  >
                    <LeaveIcon aria-hidden />
                    <span className="uib-shell-profile-label">{t('shell.profileSignOut')}</span>
                  </a>
                </Dropdown.Button>
              </Dropdown.Item>
            </Dropdown.List>
          </>
        ) : null}
      </Dropdown>
    </Dropdown.TriggerContext>
  );
};
