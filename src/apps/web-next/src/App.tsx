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
} from '@genai/ui-assembly';
import { fromTemplate } from '@genai/ui-blocks';
import { useMemo } from 'react';
import { genkiApi } from './api';
import { BackToClassic } from './BackToClassic';
import { profileFor } from './profile';
import type { Me } from './session';
import { threadWrites } from './threadWrites';

const layout = fromTemplate('knowledge-assistant-next').layout;
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

export const App = ({ me, api, onSwitchBack }: AppProps) => {
  const [scheme, setScheme] = useStoredColorScheme(COLOR_SCHEME_KEY);
  const [say, notice] = useNotice();
  const profile = useMemo(() => profileFor(me), [me]);
  const genki = useMemo(() => api ?? genkiApi(me.tenant, profile), [api, me.tenant, profile]);
  const writes = useMemo(() => (me.writes ? threadWrites() : {}), [me.writes]);
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
        {...writes}
      />
      {notice}
      <BackToClassic {...(onSwitchBack ? { onSwitch: onSwitchBack } : {})} />
    </>
  );
};
