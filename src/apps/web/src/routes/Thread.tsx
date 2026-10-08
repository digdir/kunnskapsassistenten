import { Heading } from '@digdir/designsystemet-react';

/**
 * Route `/threads/:threadId`.
 *
 * The route contributes the page's level 1 heading and nothing else. The
 * conversation itself is drawn by whichever view sits in the main slot, which
 * the shell looks up in viewComponents; the chat view reads the thread id
 * from the URL through its adapter in src/layout/slotViews/.
 *
 * The h1 is the application, not the thread. A thread is one section of the
 * page and its title is the h2 the chat view renders, so the heading levels
 * hold whether or not a thread was found. Naming the page after the thread
 * would also rename it mid-session, the moment a title is generated from the
 * first question.
 *
 * The browser's title is a different thing, and it does name the thread
 * (WCAG 2.4.2). The chat view sets it, because it is the one that has the
 * title; this route has only the address. See components/PageTitle.tsx.
 *
 * Visually hidden because no header is drawn anywhere in Figma, and an h1
 * stacked above the thread title is not in the design. The day a header is
 * drawn, this is the element it replaces.
 */
export function Thread() {
  return (
    <Heading level={1} className="ds-sr-only">
      Kunnskapsassistenten
    </Heading>
  );
}
