// Kunnskapsassistenten: `<Assistant>` from genki's @genai/ui-assembly with the template
// `knowledge-assistant-next`, against genki through this site's server. What is this host's own
// stays here: who is signed in (`/api/next/me`), the profile, the paths, the `ka-next.` keys in
// this browser, the colour scheme, and KA's pages in the profile menu. When the server was given
// a layout from genki's builder (`KA_NEXT_LAYOUT`, decisions/0017), the page draws that, in its
// own words, and the menu has KA's pages only when the service is KA's.
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
import { hasKaPages } from './pages/paths';
import { hostProfileFor, profileFor } from './profile';
import type { Me } from './session';
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
}

export const App = ({ me, api }: AppProps) => {
  const [scheme, setScheme] = useStoredColorScheme(COLOR_SCHEME_KEY);
  const [say, notice] = useNotice();
  // KA's pages are about KA: another service, drawn from a layout, gets genki's entries only.
  const drawing = useMemo(() => drawingFor(me, hasKaPages(me) ? menuFor() : undefined), [me]);
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
