import '@digdir/designsystemet-css';
import './theme.css';
import '@genai/ui-blocks/styles.css';
import '@genai/ui-assembly/styles.css';
import './page.css';
import { CrashBoundary } from '@genai/ui-blocks';
import { createRoot } from 'react-dom/client';
import { canonicalPath } from './pages/paths';
import { forgetPreviousClient } from './previousClient';
import { Root } from './Root';
import { SessionError } from './SessionError';
import { loadMe, signInHref, SignedOut } from './session';

// `/innstillinger/` is `/innstillinger`: the assistant reads its pages off the address as it is.
const path = canonicalPath(location.pathname);
if (path !== location.pathname) {
  // Through a URL, so a path that starts with `//` stays a path on this site.
  const url = new URL(location.href);
  url.pathname = path;
  history.replaceState(history.state, '', url);
}

forgetPreviousClient();

const root = createRoot(document.getElementById('root') as HTMLElement);

loadMe().then(
  (me) =>
    root.render(
      <CrashBoundary onError={(error) => console.error('[ka-next] crash', error)}>
        <Root me={me} />
      </CrashBoundary>,
    ),
  (error: unknown) => {
    if (error instanceof SignedOut) location.assign(signInHref());
    else root.render(<SessionError />);
  },
);
