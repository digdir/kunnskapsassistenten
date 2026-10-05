import { Link, Paragraph } from '@digdir/designsystemet-react';
import { LeaveIcon, PersonIcon } from '@navikt/aksel-icons';
import { useEffect, useState } from 'react';
import { beforeLogout, fetchSession, type Session } from '../../api/session';

export type SignedInProps = {
  /** Overrides the fetch: a session, or null for none. Only for tests. */
  session?: Session | null;
};

/**
 * Who is signed in, and «Logg ut», at the end of the thread list.
 *
 * At the END of the view, and not pinned to the bottom of the panel, which is
 * where chat apps usually put it. A pinned line would sit over the list, and
 * a row the keyboard moves to can scroll in under it: the browser scrolls a
 * focused element into view without knowing what is pinned, and a row hidden
 * under the line is the thing WCAG 2.4.11 (Focus Not Obscured) forbids.
 * Keeping the rows clear would take a `scroll-padding` on the panel's own
 * scrolling region, which belongs to the shell. Here it is where the tab
 * order already ends, after the last thread.
 *
 * Nothing at all without a session — in mock, in live and behind a BFF with
 * sign-in turned off (session.ts).
 *
 * «Logg ut» is a link and not a button: it goes to `/auth/logout`, which ends
 * the session and sends the browser on to Entra. It is a navigation, and a
 * full one, so it is an `<a>` and not the router's.
 */
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

  return (
    <div className="threads-view__signed-in">
      <Paragraph data-size="sm" className="threads-view__user" title={session.email}>
        <PersonIcon aria-hidden="true" />
        <span>
          <span className="ds-sr-only">Innlogget som </span>
          {session.name}
        </span>
      </Paragraph>
      {/*
        `beforeLogout` empties what this browser kept of the reader's answers.
        A click, Enter and Ctrl- or Cmd-click all fire `click`; a middle click
        that opens the link in a new tab fires only `auxclick` (KA CC on #243).
        Only the middle button: `auxclick` fires for the right button too, and
        a context menu is not a logout. «Åpne i ny fane» from that menu fires
        nothing here, and is the server's to handle behind the BFF.
      */}
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
