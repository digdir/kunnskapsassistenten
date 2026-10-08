import { useEffect } from 'react';

/** The app's name, last in every page title and the whole title on its own. */
export const APP_TITLE = 'Kunnskapsassistenten';

/**
 * «Onboarding – Kunnskapsassistenten»: the page first, because a tab title is
 * cut from the end and a screen reader reads the title on page change.
 */
export function pageTitle(name?: string): string {
  return name ? `${name} – ${APP_TITLE}` : APP_TITLE;
}

export type PageTitleProps = {
  /** What this page is, in Norwegian. Absent leaves the app's name alone. */
  name?: string;
};

/**
 * The document title (WCAG 2.4.2). Render only one at a time, or the last effect wins.
 * `document.title`, not React's `<title>`: the browser reads the first of two, index.html's
 * static one. No cleanup, so the app name does not flash between pages.
 */
export function PageTitle({ name }: PageTitleProps) {
  useEffect(() => {
    document.title = pageTitle(name);
  }, [name]);

  return null;
}
