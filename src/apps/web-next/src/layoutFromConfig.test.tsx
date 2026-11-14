import type { AssistantApi, AssistantProfile } from '@genai/ui-assembly';
import { fromTemplate, type AssistantLayout } from '@genai/ui-blocks';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, drawingFor, layout as kaLayout } from './App';
import { hostProfileFor, profileFor } from './profile';
import type { Me } from './session';

// genki's calls as the page makes them, so a test sees the profile they are given.
const { genkiApi } = vi.hoisted(() => ({ genkiApi: vi.fn() }));
vi.mock('./api', async (original) => ({
  ...(await original<typeof import('./api')>()),
  genkiApi,
}));

/*
 * A layout from genki's builder, given to the server in KA_NEXT_LAYOUT (decisions/0017): the page
 * draws it in its own words, with only what the host must give from KA's profile. Without one,
 * the page is KA's as before.
 */

const me: Me = {
  name: 'Testperson Testesen',
  organisation: 'Testvirksomheten',
  signOut: '/auth/logout',
  model: 'kunnskapsassistenten__default',
  service: 'kunnskapsassistenten',
  tenant: 'digdir',
  writes: false,
};

/** Another assistant, as the builder's «Kopier oppsettet» gives it: KA's blocks, its own words. */
const another: AssistantLayout = {
  ...fromTemplate('knowledge-assistant-next').layout,
  profile: {
    assistantName: 'Rapportassistenten',
    suggestions: ['Hva sier rapportene om digitalisering?', 'Hvilke etater skriver mest?'],
    corpora: {
      kudos: {
        label: 'Rapportarkivet',
        description: 'rapporter fra staten',
        fields: [{ id: 'type', label: 'Slag rapport', heading: 'Slag' }],
      },
    },
    settingsNote: 'En prøve laget i genkis bygger.',
  },
};

const KA_SUGGESTION = /Hva handler dokumentene i Kudos om\?/;

const fakeApi = (): AssistantApi => ({
  loadModels: vi.fn(async () => [
    {
      id: 'kunnskapsassistenten__default',
      _service: 'kunnskapsassistenten',
      _service_title: 'Kunnskapsassistenten',
      _pickable: true,
      _chat: true,
    },
  ]),
  loadThreads: vi.fn(async () => [
    { id: 't1', title: 'En tråd', updatedAt: Date.now(), service: 'kunnskapsassistenten' },
    { id: 't2', title: 'En annen tjenestes tråd', updatedAt: Date.now(), service: 'annen' },
  ]),
  loadThread: vi.fn(async () => ({ title: 'En tråd', turns: [] })),
  loadCorpora: vi.fn(async () => []),
  loadFields: vi.fn(async () => []),
  loadFacets: vi.fn(async () => []),
  loadAbout: vi.fn(async () => undefined),
  ask: async function* () {},
});

beforeEach(() => {
  genkiApi.mockReset();
  genkiApi.mockImplementation(() => fakeApi());
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

/** The profile genki's calls were made with. */
const apiProfile = () => genkiApi.mock.calls.at(-1)?.[1] as AssistantProfile;

describe('a layout from genki’s builder (KA_NEXT_LAYOUT)', () => {
  it('draws the configured name and suggestions', async () => {
    render(<App me={{ ...me, layout: another }} />);
    expect(
      await screen.findByRole('button', { name: 'Hva sier rapportene om digitalisering?' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hvilke etater skriver mest?' })).toBeTruthy();
    expect(screen.getAllByText(/Rapportassistenten/).length).toBeGreaterThan(0);
    expect(screen.queryByText(KA_SUGGESTION)).toBeNull();
    expect(screen.queryByText(/^Kunnskapsassistenten$/)).toBeNull();
  });

  it('leaves KA’s own profile out when a layout is set', () => {
    const drawing = drawingFor({ ...me, layout: another }, undefined);
    expect(drawing.layout).toBe(another);
    for (const key of ['assistantName', 'suggestions', 'followUps', 'corpora', 'settingsNote'])
      expect(drawing.host).not.toHaveProperty(key);
    expect(drawing.profile.assistantName).toBe('Rapportassistenten');
    expect(drawing.profile.corpora).toEqual(another.profile?.corpora);
    expect(drawing.profile.settingsNote).toBe('En prøve laget i genkis bygger.');
    expect(JSON.stringify(drawing.profile)).not.toMatch(/Kudos|kudos\.dfo\.no|årsrapporter/);
  });

  it('gives genki’s calls the profile drawn, the layout’s words with the host’s part', async () => {
    render(<App me={{ ...me, layout: another }} />);
    await screen.findByText('En tråd');
    expect(genkiApi).toHaveBeenCalledWith('digdir', expect.anything());
    const profile = apiProfile();
    expect(profile.assistantName).toBe('Rapportassistenten');
    expect(profile.corpora).toEqual(another.profile?.corpora);
    expect(profile.signedInAs).toBe(me.name);
    expect(profile.menu?.extra?.map((entry) => entry.id)).toEqual(['about', 'back-to-classic']);
  });

  it('keeps what only the host gives: the person, the sign-out, this service’s threads, KA’s trials', async () => {
    const host = hostProfileFor(me);
    expect(host.signedInAs).toBe(me.name);
    expect(host.organisation).toBe(me.organisation);
    expect(host.signOut).toEqual({ href: me.signOut });
    expect(host.family?.('kunnskapsassistenten')).toBe(true);
    expect(host.family?.('annen')).toBe(false);
    expect(host.experiments?.map((experiment) => experiment.id)).toEqual(
      profileFor(me).experiments?.map((experiment) => experiment.id),
    );
    render(<App me={{ ...me, layout: another }} />);
    expect(await screen.findByText('En tråd')).toBeTruthy();
    expect(screen.queryByText('En annen tjenestes tråd')).toBeNull();
    expect(screen.getAllByRole('button', { name: me.name }).length).toBeGreaterThan(0);
  });
});

describe('without a layout from the server', () => {
  it('is unchanged when unset: KA’s template, and KA’s whole profile to the page and genki’s calls', async () => {
    const menu = { extra: [] };
    const drawing = drawingFor(me, menu);
    expect(drawing.layout).toBe(kaLayout);
    expect(drawing.layout.profile).toBeUndefined();
    expect(drawing.host).toEqual({ ...profileFor(me), family: expect.any(Function), menu });
    // The same object, as the page gave both before a layout could be set.
    expect(drawing.profile).toBe(drawing.host);

    render(<App me={me} />);
    expect(await screen.findByText(KA_SUGGESTION)).toBeTruthy();
    expect(screen.queryByText('Hva sier rapportene om digitalisering?')).toBeNull();
    const profile = apiProfile();
    expect(profile.assistantName).toBe('Kunnskapsassistenten');
    expect(profile.corpora?.kudos?.label).toBe('Kudos');
    expect(profile.suggestions).toEqual(profileFor(me).suggestions);
    expect(profile.settingsNote).toBe(profileFor(me).settingsNote);
  });
});
