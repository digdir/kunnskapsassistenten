import { Heading } from '@digdir/designsystemet-react';

/**
 * Route `/threads/:threadId`: only the page's h1, which names the app, not the thread, so it
 * holds whether or not the thread is found or retitled. Visually hidden because the design has
 * no header. The chat view renders the thread's h2 and sets the document title.
 */
export function Thread() {
  return (
    <Heading level={1} className="ds-sr-only">
      Kunnskapsassistenten
    </Heading>
  );
}
