import { Heading } from '@digdir/designsystemet-react';
import { NotFoundState, PageTitle } from '../components';

/**
 * The catch-all route: an address that matches nothing.
 *
 * Before this existed, `/tull` drew a completely blank page — no `main`, no
 * heading, no skip link, nothing for a screen reader to land on — because
 * `Routes` renders null when no route matches and the shell is a layout route
 * under it. Measured in reise 14 of design/brukerreiser-2026-09-15.md.
 *
 * Unlike the two real routes, this one draws the main slot itself: the shell
 * is mounted with `routeOwnsMain`, so the chat view stands down. A «siden
 * finnes ikke» with a working welcome screen and a compose field under it is
 * two answers to the same question, and the wrong one is the bigger.
 *
 * The level 1 is the same visually hidden one the other routes carry, so the
 * heading order holds here too. See Thread.tsx for why it is hidden.
 */
export function NotFound() {
  return (
    <>
      <PageTitle name="Siden finnes ikke" />
      <Heading level={1} className="ds-sr-only">
        Kunnskapsassistenten
      </Heading>
      <NotFoundState
        title="Siden finnes ikke"
        description="Adressen fører ingen steder i Kunnskapsassistenten. Den kan være skrevet feil, eller peke på noe som er borte."
      />
    </>
  );
}
