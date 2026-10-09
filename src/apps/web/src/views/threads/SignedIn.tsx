import { Link, Paragraph } from '@digdir/designsystemet-react';
import { LeaveIcon, PersonIcon } from '@navikt/aksel-icons';
import { useEffect, useState } from 'react';
import { beforeLogout, fetchSession, type Session } from '../../api/session';

export type SignedInProps = {
  /** Overrides the fetch: a session, or null for none. Only for tests. */
  session?: Session | null;
};

/** Who is signed in, and «Logg ut», at the end of the thread list. */
export function SignedIn({ session: given }: SignedInProps) {
  const [session, setSession] = useState<Session | undefined>(given ?? undefined);

  useEffect(() => {
    if (given !== undefined) return;
    const abort = new AbortController();
    void fetchSession(abort.signal).then((found) => {
      if (!abort.signal.aborted) setSession(found);
    });
    return () => abort.abort();
  }, [given]);

  if (!session) return null;

  // At the end of the list, not pinned to the panel's bottom, where it would
  // cover rows the keyboard scrolls to (WCAG 2.4.11, Focus Not Obscured).
  return (
    <div className="threads-view__signed-in">
      <Paragraph data-size="sm" className="threads-view__user" title={session.email}>
        <PersonIcon aria-hidden="true" />
        <span>
          <span className="ds-sr-only">Innlogget som </span>
          {session.name}
        </span>
      </Paragraph>
      {/* A plain `<a>`: `/auth/logout` is a full navigation on to Entra. A middle
          click fires only `auxclick`, which a right click fires too, hence button 1.
          «Åpne i ny fane» from the context menu fires nothing. */}
      <Link
        href={session.logoutUrl}
        data-size="sm"
        onClick={beforeLogout}
        onAuxClick={(event) => {
          if (event.button === 1) beforeLogout();
        }}
      >
        <LeaveIcon aria-hidden="true" />
        Logg ut
      </Link>
    </div>
  );
}
