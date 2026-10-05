import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { FilterContext } from '../../layout/filterContext';
import { emptyFilterSelection, type FilterFacet, type FilterSelection } from '../../model';
import { FiltersView } from './FiltersView';

/**
 * The corpus chooser in `FiltersView`: the corpus line, when there is more
 * than one corpus to search.
 *
 * Its own file rather than more tests in `FiltersView.test.tsx`, because
 * `vi.mock` is per file: the hook has to be replaced here, and the other file
 * should keep testing the view against the real corpus store. Named after the
 * component it mounts — there is no `CorpusSelect.tsx`, and a test file that
 * names a component nobody can open sends the next reader looking for it
 * (KA CC on #106).
 *
 * `useCorpus` is the shell's (#5), and it reads a module store fixed at
 * startup from the environment — so the only way to see both states in a test
 * is to stand in for the hook. What is asserted here is this view's half: that
 * the chooser appears only when there is a choice, that picking one asks the
 * shell to switch, and that a screen reader is told which corpus it landed on.
 */
const corpus = vi.hoisted(() => ({
  options: [
    { key: 'norquad-docs', label: 'Wikipedia (NorQuAD)', description: '351 artikler.' },
    { key: 'kudos-pilot', label: 'Kudos-pilot', description: 'Fem årsrapporter.' },
  ],
  active: 'norquad-docs',
  choosable: true,
  // Skallet bytter for ekte: ny tråd og ny adresse. Her er det bare
  // butikken som flytter seg, som er den delen dette viewet ser.
  set: vi.fn((key: string) => {
    corpus.active = key;
  }),

  /**
   * Fasetter per korpus, og de har ingen dimensjon felles utenom
   * dokumenttype: det er nettopp det som gjør at «Virksomheter» fra det ene
   * korpuset er synlig feil i det andre.
   */
  facets: {
    'norquad-docs': [
      {
        dimension: 'documentType',
        label: 'Dokumenttype',
        values: [{ value: 'evaluering', label: 'Evaluering', count: 351 }],
      },
      {
        dimension: 'organisation',
        label: 'Virksomheter',
        values: [{ value: 'wikipedia', label: 'Wikipedia', count: 351 }],
      },
    ],
    'kudos-pilot': [
      {
        dimension: 'documentType',
        label: 'Dokumenttype',
        values: [{ value: 'arsrapport', label: 'Årsrapport', count: 5 }],
      },
      {
        dimension: 'year',
        label: 'År',
        values: [{ value: '2024', label: '2024', count: 5 }],
      },
    ],
  } as Record<string, FilterFacet[]>,

  /** Hver spørring, så testen ser hvilket korpus og hvilket utvalg den gikk med. */
  asked: [] as { corpus: string; selection?: FilterSelection }[],
}));

/**
 * Klienten leser aktivt korpus når den bygger spørringen (src/api/corpus.ts),
 * så samme kall gir nye fasetter etter et bytte. Mocken gjør det samme.
 */
vi.mock('../../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api')>();
  return {
    ...actual,
    createChatClient: () =>
      ({
        listFacets: async (_signal?: AbortSignal, selection?: FilterSelection) => {
          corpus.asked.push({ corpus: corpus.active, selection });
          return corpus.facets[corpus.active] ?? [];
        },
      }) as unknown as ReturnType<typeof actual.createChatClient>,
  };
});

vi.mock('../../layout/useCorpus', () => ({
  useCorpus: () => ({
    options: corpus.options,
    active: corpus.active,
    option: corpus.options.find((option) => option.key === corpus.active),
    choosable: corpus.choosable,
    set: corpus.set,
  }),
}));

function renderView() {
  return render(
    <MemoryRouter>
      <FilterContext value={{ selection: emptyFilterSelection, setSelection: () => {} }}>
        <AnswerSourcesContext value={inertAnswerSources}>
          <FiltersView siblingViews={['filters']} onShowView={() => {}} facets={[]} />
        </AnswerSourcesContext>
      </FilterContext>
    </MemoryRouter>,
  );
}

/**
 * Samme view, men uten `facets`-overstyringen: her henter det selv, som i
 * appen. Det er den veien fasettene kan bli stående på feil korpus.
 */
function FetchingHarness({
  initial,
  onSelection,
}: {
  initial: FilterSelection;
  onSelection: (next: FilterSelection) => void;
}) {
  // Utvalget bor i skallet i appen, og det endrer seg når viewet ber om det.
  // En ren spion ville latt viewet stå igjen med valget det nettopp fjernet.
  const [selection, setSelection] = useState(initial);
  return (
    <FilterContext
      value={{
        selection,
        setSelection: (next) => {
          onSelection(next);
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

function renderFetchingView(
  selection: FilterSelection = emptyFilterSelection,
  onSelection: (next: FilterSelection) => void = () => {},
) {
  return render(
    <MemoryRouter>
      <FetchingHarness initial={selection} onSelection={onSelection} />
    </MemoryRouter>,
  );
}

function switchTo(label: string) {
  const key = corpus.options.find((option) => option.label === label)?.key;
  fireEvent.change(screen.getByRole('combobox', { name: 'Korpus' }), {
    target: { value: key },
  });
}

beforeEach(() => {
  corpus.active = 'norquad-docs';
  corpus.choosable = true;
  corpus.set.mockClear();
  corpus.asked.length = 0;
});

describe('korpusvelgeren', () => {
  it('er en nedtrekksliste med etiketten «Korpus» og korpuset som er valgt', () => {
    renderView();

    const select = screen.getByRole('combobox', { name: 'Korpus' });
    expect((select as HTMLSelectElement).value).toBe('norquad-docs');
    expect(screen.getByRole('option', { name: 'Kudos-pilot' })).toBeTruthy();
  });

  it('viser beskrivelsen av korpuset under velgeren', () => {
    // Live har ingen fasetter å regne ut en setning fra (A2), så korpusets
    // egne ord er det linja har. Navnet står, resten ligger bak «Vis mer»
    // (N2).
    renderView();

    expect(screen.getByText('Dokumenter fra Wikipedia (NorQuAD)')).toBeTruthy();
    // `hidden`, ikke fjernet: `aria-controls` peker på det, og et element
    // som ikke er i dokumentet kan ingen skjermleser følge pekeren til.
    expect(screen.getByText('351 artikler.').hasAttribute('hidden')).toBe(true);
    expect(screen.getByRole('button', { name: 'Vis mer om korpuset' })).toBeTruthy();
  });

  it('ber skallet bytte, og annonserer hvilket korpus det ble', () => {
    const { container } = renderView();

    fireEvent.change(screen.getByRole('combobox', { name: 'Korpus' }), {
      target: { value: 'kudos-pilot' },
    });

    // Bytte er skallets sak: ny tråd og ny adresse hører til der, ikke her.
    expect(corpus.set).toHaveBeenCalledWith('kudos-pilot');
    // Og den ene tingen som endret seg er den ingen ser: skjermbildet tegnes
    // om, men ingenting sier hva som nå blir søkt i.
    expect(container.querySelector('output.ds-sr-only')?.textContent).toBe('Korpus: Kudos-pilot');
  });

  it('teller fasettene på nytt når korpuset byttes', async () => {
    // Funnet (KA CC på #131): fasettene fulgte sidelastingen, ikke byttet.
    // Etter bytte til Kudos tilbød «Virksomheter» fortsatt Wikipedia-verdien,
    // og «Vis mer» sa 351 dokumenter. Først etter omlasting stemte det.
    renderFetchingView();

    expect(await screen.findByLabelText('Virksomheter')).toBeTruthy();
    expect(screen.getByText('351 dokumenter, evalueringer')).toBeTruthy();

    switchTo('Kudos-pilot');

    expect(await screen.findByLabelText('År')).toBeTruthy();
    // Dimensjonen det nye korpuset ikke har, er borte – ikke stående med
    // verdier fra det forrige.
    expect(screen.queryByLabelText('Virksomheter')).toBeNull();
    expect(screen.getByText('5 dokumenter, årsrapporter, 2024')).toBeTruthy();
    expect(corpus.asked.map((call) => call.corpus)).toEqual(['norquad-docs', 'kudos-pilot']);
  });

  it('nullstiller valg fra det forrige korpuset, og sier fra', async () => {
    const setSelection = vi.fn();
    // Et valg tatt i Wikipedia-korpuset: verdien finnes ikke i Kudos, og uten
    // nullstilling går den med neste spørsmål.
    renderFetchingView({ ...emptyFilterSelection, organisation: ['wikipedia'] }, setSelection);
    await screen.findByLabelText('Virksomheter');

    switchTo('Kudos-pilot');

    expect(setSelection).toHaveBeenCalledWith(emptyFilterSelection);
    // Spørringen for det nye korpuset går med tomt utvalg, ikke med verdien
    // fra det forrige.
    await screen.findByLabelText('År');
    expect(corpus.asked.at(-1)).toEqual({ corpus: 'kudos-pilot', selection: emptyFilterSelection });
  });

  it('sier i live-området at filteret ble nullstilt', async () => {
    const { container } = renderFetchingView({
      ...emptyFilterSelection,
      organisation: ['wikipedia'],
    });
    await screen.findByLabelText('Virksomheter');

    switchTo('Kudos-pilot');
    await screen.findByLabelText('År');

    // Byttet er stille på skjermen: panelet tegnes om, og ingenting sier at
    // avgrensningen de satte er borte.
    expect(container.querySelector('output.ds-sr-only')?.textContent).toBe(
      'Korpus: Kudos-pilot. Filteret er nullstilt fordi korpuset ble byttet.',
    );
  });

  it('tegner ingen velger når det bare finnes ett korpus', () => {
    corpus.choosable = false;
    renderView();

    expect(screen.queryByRole('combobox', { name: 'Korpus' })).toBeNull();
    // Linja står som før: navnet på én linje, resten bak «Vis mer».
    expect(screen.getByText('Dokumenter fra Wikipedia (NorQuAD)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vis mer om korpuset' })).toBeTruthy();
  });
});
