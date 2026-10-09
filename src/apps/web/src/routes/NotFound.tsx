import { Heading } from '@digdir/designsystemet-react';
import { NotFoundState, PageTitle } from '../components';

/**
 * Catch-all route. Without it `Routes` renders null, and an unknown address gets a blank page
 * with no `main` or skip link. The shell is mounted with `routeOwnsMain`, so no welcome screen
 * or compose field appears under «siden finnes ikke».
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
