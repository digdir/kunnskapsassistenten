import { Link, Paragraph } from '@digdir/designsystemet-react';
import { LeaveIcon, PersonIcon } from '@navikt/aksel-icons';
import { useT } from './i18n.js';

export interface SignedInProps {
  /** Who is signed in, as the reader knows themselves. Nothing is drawn without it. */
  name?: string | undefined;
  /** The reader's e-mail address, shown on hover. */
  email?: string | undefined;
  /** Where «Logg ut» leads: a full navigation to the host's sign-out. Without it, no «Logg ut». */
  signOutHref?: string | undefined;
  /** The reader is leaving by «Logg ut»: the host forgets what this browser kept for them. */
  onSignOut?: (() => void) | undefined;
  className?: string | undefined;
}

/** Who is signed in, and «Logg ut», at the list's end, where it covers no row (WCAG 2.4.11). */
export const SignedIn = ({ name, email, signOutHref, onSignOut, className }: SignedInProps) => {
  const t = useT();
  if (!name) return null;

  return (
    <div className={['uib-threads-signed-in', className].filter(Boolean).join(' ')}>
      <Paragraph data-size="sm" className="uib-threads-user" title={email}>
        <PersonIcon aria-hidden="true" />
        <span>
          <span className="ds-sr-only">{t('threads.signedInAs')} </span>
          {name}
        </span>
      </Paragraph>
      {/* A plain link, since signing out navigates; a middle click fires only `auxclick`. */}
      {signOutHref && (
        <Link
          href={signOutHref}
          data-size="sm"
          onClick={() => onSignOut?.()}
          onAuxClick={(event) => {
            if (event.button === 1) onSignOut?.();
          }}
        >
          <LeaveIcon aria-hidden="true" />
          {t('threads.signOut')}
        </Link>
      )}
    </div>
  );
};
