// What the address shows: the assistant at its own addresses, KA's pages at theirs, and «Siden
// finnes ikke» at any other. Each is a page load of its own, so the address is read once.
import type { AssistantApi } from '@genai/ui-assembly';
import { App, drawingFor } from './App';
import { ABOUT } from './pages/about';
import { CHANGELOG } from './pages/changelog';
import { InfoPage, NotFoundPage } from './pages/Page';
import { backFrom, hasKaPages, pageAt } from './pages/paths';
import type { Me } from './session';

export interface RootProps {
  me: Me;
  /** The address, `location` unless a test gives another. */
  at?: Pick<Location, 'pathname' | 'search'> | undefined;
  /** genki through the server's proxy, unless a test gives another. */
  api?: AssistantApi | undefined;
}

export const Root = ({ me, at = location, api }: RootProps) => {
  const page = pageAt(at.pathname, hasKaPages(me));
  if (page === 'assistant') return <App me={me} api={api} />;
  const assistantName =
    drawingFor(me, undefined).profile.assistantName ?? 'Kunnskapsassistenten';
  if (page === 'not-found') return <NotFoundPage assistantName={assistantName} />;
  return (
    <InfoPage
      {...(page === 'changelog'
        ? { title: 'Endringslogg', text: CHANGELOG }
        : { title: 'Om prosjektet', text: ABOUT })}
      assistantName={assistantName}
      back={backFrom(at.search)}
    />
  );
};
