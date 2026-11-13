import '@digdir/designsystemet-css';
import './theme.css';
import '@genai/ui-blocks/styles.css';
import '@genai/ui-assembly/styles.css';
import './page.css';
import { CrashBoundary } from '@genai/ui-blocks';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SessionError } from './SessionError';
import { loadMe, signInHref, SignedOut } from './session';

const root = createRoot(document.getElementById('root') as HTMLElement);

loadMe().then(
  (me) =>
    root.render(
      <CrashBoundary onError={(error) => console.error('[ka-next] crash', error)}>
        <App me={me} />
      </CrashBoundary>,
    ),
  (error: unknown) => {
    if (error instanceof SignedOut) location.assign(signInHref());
    else root.render(<SessionError />);
  },
);
