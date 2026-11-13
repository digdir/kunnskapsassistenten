// Kunnskapsassistenten's next client: `<Assistant>` from genki's @genai/ui-assembly with the
// template `knowledge-assistant-next`, against genki through this site's server. What is this
// host's own stays here: who is signed in (`/api/next/me`), the profile, the paths, the
// `ka-next.` keys in this browser, the colour scheme, and the way back to the old client.
import {
  Assistant,
  browserStorage,
  useNotice,
  useStoredColorScheme,
  type AssistantApi,
  type AssistantFeedback,
} from '@genai/ui-assembly';
import { fromTemplate } from '@genai/ui-blocks';
import { useMemo, useRef } from 'react';
import { genkiApi } from './api';
import { sendFeedback } from './feedback';
import { menuFor } from './menu';
import { profileFor } from './profile';
import type { Me } from './session';
import { switchClient } from './switchClient';
import { threadWrites } from './threadWrites';

// The template as it is: the next look, feedback under each answer and no follow-ups.
export const layout = fromTemplate('knowledge-assistant-next').layout;
const storage = browserStorage('ka-next.');
const paths = { home: '/', settings: '/innstillinger' };
export const COLOR_SCHEME_KEY = 'ka-next.colorScheme';

export interface AppProps {
  me: Me;
  /** genki through the server's proxy, unless a test gives another. */
  api?: AssistantApi | undefined;
  /** «Tilbake til gammel versjon»; the server's toggle unless a test gives another. */
  onSwitchBack?: (() => Promise<void> | void) | undefined;
}

export const App = ({ me, api, onSwitchBack = () => switchClient('classic') }: AppProps) => {
  const [scheme, setScheme] = useStoredColorScheme(COLOR_SCHEME_KEY);
  const [say, notice] = useNotice();
  // Kept in a ref, so a new function from the host does not draw the assistant again.
  const switchBack = useRef(onSwitchBack);
  switchBack.current = onSwitchBack;
  const profile = useMemo(
    () => ({
      ...profileFor(me),
      menu: menuFor(() => {
        void Promise.resolve(switchBack.current()).catch(() =>
          say('Fikk ikke byttet til gammel versjon. Prøv igjen.'),
        );
      }),
    }),
    [me, say],
  );
  const genki = useMemo(() => api ?? genkiApi(me.tenant, profile), [api, me.tenant, profile]);
  // The thread on screen, which feedback on its answers names.
  const thread = useRef<string | undefined>(undefined);
  // Writes, feedback included, only with a person's token: the server refuses them otherwise.
  const writes = useMemo(
    () =>
      me.writes
        ? {
            ...threadWrites(),
            onFeedback: (feedback: AssistantFeedback) => sendFeedback(thread.current, feedback),
          }
        : {},
    [me.writes],
  );
  return (
    <>
      <Assistant
        api={genki}
        layout={layout}
        service={me.service}
        tenant={me.tenant}
        model={me.model}
        profile={profile}
        threadInUrl
        paths={paths}
        storage={storage}
        onNotice={say}
        colorScheme={scheme}
        onColorSchemeChange={setScheme}
        // A block body: the assembly calls this in an effect, which would take a value as cleanup.
        onThreadChange={(id) => {
          thread.current = id;
        }}
        {...writes}
      />
      {notice}
    </>
  );
};
