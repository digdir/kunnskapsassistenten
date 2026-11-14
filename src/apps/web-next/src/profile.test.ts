import {
  sourceFromWire,
  useAssistant,
  type AssistantApi,
  type AssistantStorage,
  type FieldSpec,
} from '@genai/ui-assembly';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { layout } from './App';
import { profileFor } from './profile';

const ME = {
  name: 'Testperson',
  signOut: '/auth/logout',
  model: 'kunnskapsassistenten__default',
  service: 'kunnskapsassistenten',
  tenant: 'digdir',
  writes: true,
};

describe('the suggestions', () => {
  const profile = profileFor(ME);
  const collection = profile.corpora?.kudos?.label ?? '';

  it('name the collection, because the model is not told which one it searches', () => {
    expect(collection).toBe('Kudos');
    expect(profile.suggestions).toHaveLength(3);
    for (const question of profile.suggestions ?? []) expect(question).toContain(collection);
  });

  it('never ask about «denne samlingen», which the model asks back about', () => {
    for (const question of profile.suggestions ?? [])
      expect(question).not.toMatch(/denne samlingen/i);
  });
});

describe('the experiments', () => {
  it('offer the narrower filter beside the threads, under the id genki’s assembly reads', () => {
    const narrower = profileFor(ME).experiments?.find(({ id }) => id === 'compact-filter');
    expect(narrower?.title).toBe('Smalere filter');
    expect(narrower?.description).toBe('Filteret tar mindre plass, og tråder får resten.');
  });

  it('no longer offer years as periods or gathered chips: they are the standard', () => {
    const ids = (profileFor(ME).experiments ?? []).map(({ id }) => id);
    expect(ids).not.toContain('year-ranges');
    expect(ids).not.toContain('compact-filter-chips');
  });
});

// genki's assembly keeps a year field to the bounds the profile gives it, and the year it is in
// Norway; KA gives 1990, as the classic client's server does.
describe('the year list', () => {
  const noisy = ['12', '1985', '1990', '2019', '2026', '2027', '2252'];
  const profile = profileFor(ME);

  const yearsShown = async (now: string, chosen?: Record<string, string[]>) => {
    const api: AssistantApi = {
      loadModels: vi.fn(async () => [
        {
          id: 'kunnskapsassistenten__default',
          _service: 'kunnskapsassistenten',
          _pickable: true,
          _chat: true,
          _datasets: [
            {
              tenant: 'digdir',
              'dataset-config-key': 'kudos',
              filters: [{ field: 'concerned_years', kinds: ['multiselect'] }],
            },
          ],
        },
      ]),
      loadThreads: vi.fn(async () => []),
      loadThread: vi.fn(async () => ({ title: '', turns: [] })),
      loadCorpora: vi.fn(async () => []),
      loadFields: vi.fn(async () => profile.corpora?.kudos?.fields ?? []),
      loadFacets: vi.fn(async (_selection, _dataset, fields: readonly FieldSpec[]) =>
        fields.map((field) => ({
          id: field.id,
          label: field.label,
          ...(field.kind ? { kind: field.kind } : {}),
          options: noisy.map((value) => ({ value, count: 1 })),
        })),
      ),
      loadAbout: vi.fn(async () => undefined),
      ask: async function* () {},
    };
    const kept = new Map<string, unknown>();
    const storage: AssistantStorage = {
      read: (key) => kept.get(key),
      write: (key, value) => void kept.set(key, value),
      remove: (key) => void kept.delete(key),
    };
    // Made once: the hook reads a new api or layout as a new setup.
    const options = {
      api,
      layout,
      service: 'kunnskapsassistenten',
      tenant: 'digdir',
      profile,
      storage,
      now: () => new Date(now),
    };
    const { result, unmount } = renderHook(() => useAssistant(options));
    const years = () =>
      result.current.facets
        ?.find((field) => field.id === 'concerned_years')
        ?.options.map((option) => option.value);
    await waitFor(() => expect(years()).toBeDefined());
    // Chosen on the page: a new thread starts with no filter, whatever the browser kept.
    if (chosen) {
      act(() => result.current.setSelection(chosen));
      await waitFor(() =>
        expect(years()).toEqual(expect.arrayContaining(Object.values(chosen).flat())),
      );
    }
    const shown = years();
    unmount();
    return shown;
  };

  it('offers the years from 1990 to this year, newest first, whatever else Kudos holds', async () => {
    expect(await yearsShown('2026-11-14T12:00:00Z')).toEqual(['2026', '2019', '1990']);
  });

  it('keeps a chosen year outside the bounds, so its chip can be removed', async () => {
    expect(await yearsShown('2026-11-14T12:00:00Z', { concerned_years: ['2252'] })).toEqual([
      '2252',
      '2026',
      '2019',
      '1990',
    ]);
  });

  it('ends at the year it is in Oslo, not on the machine clock', async () => {
    // 23:30 UTC on New Year's Eve is 00:30 on 1 January in Oslo.
    expect(await yearsShown('2026-12-31T23:30:00Z')).toEqual(['2027', '2026', '2019', '1990']);
  });
});

describe('the document links', () => {
  const kudos = profileFor(ME).corpora?.kudos;
  const linkOf = (documentId: string) =>
    sourceFromWire({ title: 'Et dokument', document_id: documentId }, kudos).url;

  it('go to the document in Kudos, by the kind of number', () => {
    expect(linkOf('42')).toBe('https://kudos.dfo.no/documents/42');
    expect(linkOf('0f8fad5b-d9cb-469f-a165-70867728950e')).toBe(
      'https://kudos.dfo.no/dokument/0f8fad5b-d9cb-469f-a165-70867728950e',
    );
    expect(linkOf('0F8FAD5B-D9CB-469F-A165-70867728950E')).toBe(
      'https://kudos.dfo.no/dokument/0F8FAD5B-D9CB-469F-A165-70867728950E',
    );
  });

  it('are not made for any other number', () => {
    expect(linkOf('A-42')).toBeUndefined();
    expect(linkOf('42/1')).toBeUndefined();
  });
});
