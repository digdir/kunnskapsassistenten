import { useEffect } from 'react';

/** The app's name, last in every page title and the whole title on its own. */
export const APP_TITLE = 'Kunnskapsassistenten';

/**
 * «Onboarding – Kunnskapsassistenten»: the page first, the app after.
 *
 * The page first because a tab is cut from the end, and a screen reader says
 * the title when the page changes: twelve tabs that all begin «Kunnskaps…»
 * are twelve tabs nobody can tell apart.
 */
export function pageTitle(name?: string): string {
  return name ? `${name} – ${APP_TITLE}` : APP_TITLE;
}

export type PageTitleProps = {
  /** What this page is, in Norwegian. Absent leaves the app's name alone. */
  name?: string;
};

/**
 * The page's title in the browser (WCAG 2.4.2, Page Titled).
 *
 * Every address had «Kunnskapsassistenten», the title in index.html, so a
 * thread, the changelog and a broken link were the same page to a screen
 * reader and in the tab bar.
 *
 * Drawn by whatever knows what the page is, and by one thing at a time: the
 * chat view for a conversation, since it is the one that has the thread's
 * title; the slot for a thread that is not there; each information page and
 * the catch-all for themselves. Two at once would be decided by which effect
 * ran last, which is an order nobody wrote down.
 *
 * `document.title` and not React's own `<title>`: index.html has a static one
 * for the moment before the app runs, and of two titles in the head the
 * browser reads the first, which would be that one. The effect also leaves
 * the title as it is when the page goes, so the next page's title replaces it
 * rather than the app's name flashing in between.
 */
export function PageTitle({ name }: PageTitleProps) {
  useEffect(() => {
    document.title = pageTitle(name);
  }, [name]);

  return null;
}
