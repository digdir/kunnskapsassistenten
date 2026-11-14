// Kunnskapsassistenten's next client: `<Assistant>` from genki's @genai/ui-assembly with the
// template `knowledge-assistant-next`, against genki through this site's server. What is this
// host's own stays here: who is signed in (`/api/next/me`), the profile, the paths, the
// `ka-next.` keys in this browser, the colour scheme, and the way back to the old client. When
// the server was given a layout from genki's builder (`KA_NEXT_LAYOUT`, decisions/0017), the page
// draws that, in its own words. Where the server serves only this client (`KA_NEXT_ONLY`), the
// menu has none of the old client's pages and no way back.
import {
  Assistant,
  browserStorage,
  profileOf,
  useNotice,
  useStoredColorScheme,
  type AssistantApi,
  type AssistantFeedback,
  type AssistantProfile,
} from '@genai/ui-assembly';
import { fromTemplate, type AssistantLayout } from '@genai/ui-blocks';
import { useMemo, useRef } from 'react';
import { genkiApi } from './api';
import { sendFeedback } from './feedback';
import { menuFor } from './menu';
import { hostProfileFor, profileFor } from './profile';
import type { Me } from './session';
import { switchClient } from './switchClient';
import { threadWrites } from './threadWrites';

// The template as it is: the next look, feedback under each answer and no follow-ups.
export const layout = fromTemplate('knowledge-assistant-next').layout;

export interface Drawing {
  layout: AssistantLayout;
  /** The host's profile, which `<Assistant>` fills in with the layout's own. */
  host: AssistantProfile;
  /** The profile drawn, `profileOf(layout, host)`, which genki's calls take too. */
  profile: AssistantProfile;
}

/**
 * What the page draws. With a layout from the server, that layout with only the host's part of
 * KA's profile, so the layout's words are the ones drawn; else KA's template with KA's whole
 * profile, as before (the template carries no profile, so `profile` is `host` itself).
 */
export const drawingFor = (me: Me, menu: AssistantProfile['menu']): Drawing => {
  const drawn = me.layout ?? layout;
  const host: AssistantProfile = { ...(me.layout ? hostProfileFor(me) : profileFor(me)), menu };
  return { layout: drawn, host, profile: profileOf(drawn, host) ?? host };
};

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
  const drawing = useMemo(
    () =>
      drawingFor(
        me,
        // Only this client on the site (`KA_NEXT_ONLY`): no apps/web pages, and no way back.
        me.nextOnly
          ? undefined
          : menuFor(() => {
              void Promise.resolve(switchBack.current()).catch(() =>
                say('Fikk ikke byttet til gammel versjon. Prøv igjen.'),
              );
            }),
      ),
    [me, say],
  );
  // The profile drawn, so the fields, the collections' names and a stored answer's links are in
  // the same words as the page (genki ADR 0054).
  const genki = useMemo(
    () => api ?? genkiApi(me.tenant, drawing.profile),
    [api, me.tenant, drawing],
  );
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
        layout={drawing.layout}
        service={me.service}
        tenant={me.tenant}
        model={me.model}
        profile={drawing.host}
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
