import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { FilterContext } from '../../layout/filterContext';
import { emptyFilterSelection, type FilterFacet, type FilterSelection } from '../../model';
import { FiltersView } from './FiltersView';

/**
 * `FiltersView` when the facets cannot be had, and a filter is still in force.
 *
 * The two ways it happens in live mode, as the server answers them
 * (server/facets.ts): no Typesense key, and `/api/facets` says 200 with an
 * empty list; Typesense down, and it says 502, which the client turns into a
 * rejection. Both are stood in for here by the client's `listFacets`, which is
 * what the view calls.
 *
 * Its own file because `vi.mock` is per file, the same reason
 * FiltersView.corpus.test.tsx gives.
 */
const client = vi.hoisted(() => ({
  /** What the next `listFacets` does. Replaced per test. */
  answer: (): Promise<FilterFacet[]> => Promise.resolve([]),
  asked: [] as (FilterSelection | undefined)[],
}));

vi.mock('../../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api')>();
  return {
    ...actual,
    createChatClient: () =>
      ({
        listFacets: (_signal?: AbortSignal, selection?: FilterSelection) => {
          client.asked.push(selection);
          return client.answer();
        },
      }) as unknown as ReturnType<typeof actual.createChatClient>,
  };
});

/** The key missing: 200 with nothing in it. */
const noFacets = () => Promise.resolve([]);
/** Typesense down: the client throws on the 502. */
const failing = () => Promise.reject(new Error('Filtrene svarte 502.'));

const facetsBack: FilterFacet[] = [
  {
    dimension: 'documentType',
    label: 'Dokumenttyper',
    values: [{ value: 'Årsrapport', label: 'Årsrapport', count: 3 }],
  },
  {
    dimension: 'year',
    label: 'År',
    values: [{ value: '2024', label: '2024', count: 3 }],
  },
];

const stored: FilterSelection = {
  ...emptyFilterSelection,
  documentType: ['Årsrapport'],
  year: ['2024'],
};

/**
 * The selection lives in the shell and changes when the view asks it to. A
 * bare spy would leave the view holding the value it just removed.
 */
function Harness({ initial, seen }: { initial: FilterSelection; seen: FilterSelection[] }) {
  const [selection, setSelection] = useState(initial);
  return (
    <FilterContext
      value={{
        selection,
        setSelection: (next) => {
          seen.push(next);
          setSelection(next);
        },
      }}
    >
      <AnswerSourcesContext value={inertAnswerSources}>
        <FiltersView siblingViews={['filters']} onShowView={() => {}} />
      </AnswerSourcesContext>
    </FilterContext>
  );
}

function renderView(initial: FilterSelection) {
  const seen: FilterSelection[] = [];
  const view = render(
    <MemoryRouter>
      <Harness initial={initial} seen={seen} />
    </MemoryRouter>,
  );
  return { ...view, seen };
}

function chip(value: string) {
  return screen.getByRole('button', { name: `Fjern filter: ${value}` });
}

/**
 * A field's text input, by its label. Not `getByLabelText` alone: once the
 * input has had focus, u-combobox labels its (closed) list with the same
 * label, and there are two.
 */
function fieldInput(label: string) {
  const input = screen
    .getAllByLabelText(label)
    .find((element) => element instanceof HTMLInputElement);
  if (!input) throw new Error(`Fant ikke feltet ${label}`);
  return input;
}

beforeEach(() => {
  client.answer = noFacets;
  client.asked.length = 0;
});

describe('an active filter without facets', () => {
  describe('while the facets load', () => {
    it('draws no chips, since the fields are on their way', () => {
      // An answer that never comes: the view stays in its loading state.
      client.answer = () => new Promise(() => {});
      const { container } = renderView(stored);

      expect(container.querySelector('.filters-view__loading')).not.toBeNull();
      expect(screen.queryByRole('heading', { name: 'Avgrenset til' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Fjern filter: 2024' })).toBeNull();
    });
  });

  describe('when the list comes back empty', () => {
    it('shows every value in force, under «Avgrenset til»', async () => {
      renderView(stored);

      expect(await screen.findByRole('heading', { name: 'Avgrenset til' })).toBeTruthy();
      expect(chip('Årsrapport')).toBeTruthy();
      expect(chip('2024')).toBeTruthy();
    });

    it('says the filter can be removed, and changed once the filters can be fetched', async () => {
      renderView(stored);

      expect(
        await screen.findByText(
          'Filteret gjelder fortsatt for spørsmålene dine. Du kan fjerne det, men ikke endre det før filtrene kan hentes.',
        ),
      ).toBeTruthy();
    });

    it('still says that filtering is not available, without claiming nothing is narrowed', async () => {
      renderView(stored);

      expect(
        await screen.findByRole('heading', { name: 'Filtrering er ikke tilgjengelig ennå' }),
      ).toBeTruthy();
      expect(screen.queryByText('Du kan stille spørsmål uten å avgrense dokumentene.')).toBeNull();
    });

    it('removes one value and keeps the rest', async () => {
      const { seen } = renderView(stored);

      fireEvent.click(await screen.findByRole('button', { name: 'Fjern filter: 2024' }));

      expect(seen.at(-1)).toEqual({ ...stored, year: [] });
      expect(screen.queryByRole('button', { name: 'Fjern filter: 2024' })).toBeNull();
      expect(chip('Årsrapport')).toBeTruthy();
    });

    it('moves focus to the next chip, not to the body', async () => {
      renderView(stored);

      const first = await screen.findByRole('button', { name: 'Fjern filter: Årsrapport' });
      first.focus();
      fireEvent.click(first);

      expect(document.activeElement).toBe(chip('2024'));
    });

    it('tells the live region what went', async () => {
      const { container } = renderView(stored);

      fireEvent.click(await screen.findByRole('button', { name: 'Fjern filter: 2024' }));

      expect(container.querySelector('output')?.textContent).toBe('Fjernet fra filteret: 2024');
    });

    it('clears the whole filter with «Tøm», and the empty state is back as it was', async () => {
      const { seen } = renderView(stored);

      fireEvent.click(await screen.findByRole('button', { name: 'Tøm avgrensningen' }));

      expect(seen.at(-1)).toEqual(emptyFilterSelection);
      expect(screen.queryByRole('heading', { name: 'Avgrenset til' })).toBeNull();
      expect(screen.getByText('Du kan stille spørsmål uten å avgrense dokumentene.')).toBeTruthy();
    });

    it('lands focus on the empty state when the last chip goes', async () => {
      renderView({ ...emptyFilterSelection, year: ['2024'] });

      const last = await screen.findByRole('button', { name: 'Fjern filter: 2024' });
      last.focus();
      fireEvent.click(last);

      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement?.textContent).toContain('Filtrering er ikke tilgjengelig ennå');
    });

    it('shows nothing extra when nothing is chosen', async () => {
      renderView(emptyFilterSelection);

      expect(
        await screen.findByText('Du kan stille spørsmål uten å avgrense dokumentene.'),
      ).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Avgrenset til' })).toBeNull();
    });
  });

  describe('when the facets come back without a dimension', () => {
    /* Types and years, and no organisations: the server drops an empty field. */
    beforeEach(() => {
      client.answer = () => Promise.resolve(facetsBack);
    });

    const withOrganisation: FilterSelection = {
      ...stored,
      organisation: ['Advokattilsynet'],
    };

    it('shows the value of the missing dimension, and only that one', async () => {
      renderView(withOrganisation);

      expect(
        await screen.findByRole('button', { name: 'Fjern filter: Advokattilsynet' }),
      ).toBeTruthy();
      // The two with fields are chips inside their fields, not here as well.
      expect(screen.queryByRole('button', { name: 'Fjern filter: Årsrapport' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Fjern filter: 2024' })).toBeNull();
      expect(
        screen.queryByRole('heading', { name: 'Filtrering er ikke tilgjengelig ennå' }),
      ).toBeNull();
    });

    it('says there is no field for it, not that the filters cannot be fetched', async () => {
      renderView(withOrganisation);

      expect(
        await screen.findByText(
          'Det finnes ikke noe felt for dette, men det gjelder fortsatt for spørsmålene dine. Du kan fjerne det.',
        ),
      ).toBeTruthy();
      expect(screen.queryByText(/før filtrene kan hentes/)).toBeNull();
    });

    it('hands focus to the first field when the last chip goes, not to an empty region', async () => {
      renderView(withOrganisation);

      const last = await screen.findByRole('button', { name: 'Fjern filter: Advokattilsynet' });
      last.focus();
      fireEvent.click(last);

      expect(document.activeElement).toBe(fieldInput('Dokumenttyper'));
    });

    it('empties only what it shows with «Tøm», and leaves the fields alone', async () => {
      const { seen } = renderView(withOrganisation);

      fireEvent.click(await screen.findByRole('button', { name: 'Tøm avgrensningen' }));

      expect(seen.at(-1)).toEqual(stored);
    });

    it('draws nothing extra when every chosen dimension has its field', async () => {
      renderView(stored);

      await screen.findByLabelText('Dokumenttyper');
      expect(screen.queryByRole('heading', { name: 'Avgrenset til' })).toBeNull();
    });
  });

  describe('when the fetch fails', () => {
    beforeEach(() => {
      client.answer = failing;
    });

    it('shows the error and the values in force beside it', async () => {
      renderView(stored);

      expect(await screen.findByText('Klarte ikke å hente filtrene.')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Avgrenset til' })).toBeTruthy();
      expect(chip('Årsrapport')).toBeTruthy();
      expect(chip('2024')).toBeTruthy();
    });

    it('removes a value, and the next question goes without it', async () => {
      const { seen } = renderView(stored);

      await screen.findByText('Klarte ikke å hente filtrene.');
      fireEvent.click(chip('Årsrapport'));

      expect(seen.at(-1)).toEqual({ ...stored, documentType: [] });
      await waitFor(() => expect(client.asked.at(-1)).toEqual({ ...stored, documentType: [] }));
    });

    it('hands focus to «Prøv igjen» when the last chip goes', async () => {
      renderView({ ...emptyFilterSelection, year: ['2024'] });

      await screen.findByText('Klarte ikke å hente filtrene.');
      const last = chip('2024');
      last.focus();
      await act(async () => {
        fireEvent.click(last);
      });

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Prøv igjen' }));
    });

    it('does not announce a removal again when «Prøv igjen» has loaded', async () => {
      const { container } = renderView(stored);
      const region = () => container.querySelector('output')?.textContent;

      await screen.findByText('Klarte ikke å hente filtrene.');
      fireEvent.click(chip('2024'));
      expect(region()).toBe('Fjernet fra filteret: 2024');

      // The retry is held open, so the region is seen while it loads. Two
      // calls wait on it: the facets, and the corpus line's own fetch, which
      // a load that restored a filter makes too.
      const waiting: ((facets: FilterFacet[]) => void)[] = [];
      client.answer = () =>
        new Promise((resolve) => {
          waiting.push(resolve);
        });
      fireEvent.click(screen.getByRole('button', { name: 'Prøv igjen' }));
      expect(region()).toBe('Henter filtre');

      await act(async () => {
        for (const answer of waiting) answer(facetsBack);
      });
      expect(region()).toBe('');
    });

    it('draws nothing but the error when nothing is chosen', async () => {
      renderView(emptyFilterSelection);

      expect(await screen.findByText('Klarte ikke å hente filtrene.')).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Avgrenset til' })).toBeNull();
    });

    it('drops the error and keeps focus in the panel when the refetch succeeds', async () => {
      renderView(stored);

      await screen.findByText('Klarte ikke å hente filtrene.');
      // Typesense is back by the time the reader removes something.
      client.answer = () => Promise.resolve(facetsBack);
      const first = chip('Årsrapport');
      first.focus();
      await act(async () => {
        fireEvent.click(first);
      });

      // The fields are back, so the chips went with the block. Focus was on
      // «2024», and the first field is where it goes.
      await waitFor(() => expect(fieldInput('Dokumenttyper')).toBeTruthy());
      expect(screen.queryByText('Klarte ikke å hente filtrene.')).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Avgrenset til' })).toBeNull();
      expect(document.activeElement).toBe(fieldInput('Dokumenttyper'));
    });
  });
});
