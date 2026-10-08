import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetFlags, setFlag } from '../../flags/flags';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { FilterContext } from '../../layout/filterContext';
import { emptyFilterSelection, type FilterFacet } from '../../model';
import { FacetField } from './FacetField';
import { FiltersView } from './FiltersView';
import { YearRangeField } from './YearRangeField';

const years: FilterFacet = {
  dimension: 'year',
  label: 'År',
  values: [2024, 2023, 2022, 2021, 2020, 2019].map((year) => ({
    value: String(year),
    label: String(year),
    count: year - 2018,
  })),
};

const organisations: FilterFacet = {
  dimension: 'organisation',
  label: 'Virksomheter',
  values: Array.from({ length: 20 }, (_, index) => ({
    value: `Virksomhet ${index + 1}`,
    label: `Virksomhet ${index + 1}`,
    count: 1,
  })),
};

/** The chips Suggestion draws, as the reader sees them. */
function chips(container: HTMLElement): string[] {
  return [...container.querySelectorAll('ds-suggestion > data')].map(
    (chip) => chip.textContent ?? '',
  );
}

/** The selection lives above the field, as it does in the view. */
function Years({ initial = [] as string[], seen }: { initial?: string[]; seen?: string[][] }) {
  const [selected, setSelected] = useState(initial);
  return (
    <YearRangeField
      facet={years}
      selected={selected}
      onChange={(next) => {
        seen?.push(next);
        setSelected(next);
      }}
    />
  );
}

/** What the list offers, in order: the options, or the hint alone. */
function offered(container: HTMLElement): string[] {
  return [...container.querySelectorAll('u-datalist u-option')].map(
    (option) => option.textContent ?? '',
  );
}

/*
 * Typing and choosing, the way the browser tells u-combobox about them. An
 * `InputEvent` with no `inputType` is what it takes for a click in the list,
 * and it stops that one before React sees it, so typing has to say
 * `insertText`. A choice in the list is `insertReplacementText` with the
 * option's value, which is what u-datalist sends.
 *
 * The list is a popover that is closed in jsdom, so its options are found
 * with `hidden`.
 */
function input(): HTMLInputElement {
  return screen.getByRole('combobox') as HTMLInputElement;
}

function type(text: string) {
  act(() => {
    input().value = text;
    input().dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
    );
  });
}

function choose(name: string) {
  const option = screen.getByRole('option', { name, hidden: true });
  const value = option.getAttribute('value') ?? '';
  act(() => {
    input().value = value;
    input().dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: value }),
    );
  });
}

beforeEach(() => {
  localStorage.clear();
  resetFlags();
});

describe('årsfilteret med perioder (year-ranges)', () => {
  it('viser år på rad som én merkelapp, og et hull som to', () => {
    const { container } = render(<Years initial={['2022', '2023', '2024', '2019']} />);

    expect(chips(container)).toEqual(['2019', '2022–2024']);
    expect(screen.getByText('4 år valgt')).toBeTruthy();
  });

  it('foreslår perioden fra teksten, med antall dokumenter fra fasettene', () => {
    render(<Years />);

    type('20-22');

    // 2020, 2021 and 2022 hold 2, 3 and 4 documents.
    expect(screen.getByRole('option', { name: '2020–2022 (9)', hidden: true })).toBeTruthy();
  });

  it('foreslår et år uten dokumenter med 0, og det kan velges', () => {
    const seen: string[][] = [];
    const { container } = render(<Years seen={seen} />);

    type('2030');
    choose('2030 (0)');

    expect(seen.at(-1)).toEqual(['2030']);
    expect(chips(container)).toEqual(['2030']);
  });

  it('sender fortsatt en liste med år, og samler en periode som henger sammen med en annen', () => {
    const seen: string[][] = [];
    const { container } = render(<Years initial={['2019', '2020']} seen={seen} />);

    type('21-23');
    choose('2021–2023 (12)');

    expect(seen.at(-1)).toEqual(['2019', '2020', '2021', '2022', '2023']);
    expect(chips(container)).toEqual(['2019–2023']);
  });

  it('velger perioden med Enter, rett fra teksten som ble skrevet', () => {
    // u-combobox chooses on Enter the option whose label is what the field
    // holds, so the option's label is the text as typed.
    const seen: string[][] = [];
    const { container } = render(<Years seen={seen} />);

    type('23-24');
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(seen.at(-1)).toEqual(['2023', '2024']);
    expect(chips(container)).toEqual(['2023–2024']);
  });

  it('tømmer teksten etter et valg, så neste periode kan skrives', () => {
    render(<Years />);

    type('2024');
    choose('2024 (6)');

    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('');
  });

  it('fjerner en periode som én', () => {
    const seen: string[][] = [];
    const { container } = render(<Years initial={['2019', '2022', '2023', '2024']} seen={seen} />);

    fireEvent.click(screen.getByRole('option', { name: /^2022–2024, Trykk for å fjerne/u }));

    expect(seen.at(-1)).toEqual(['2019']);
    expect(chips(container)).toEqual(['2019']);
  });

  it('foreslår årene med dokumenter mens et år skrives, og et kan velges', () => {
    const seen: string[][] = [];
    const { container } = render(<Years seen={seen} />);

    // Newest first, as the year field without the flag.
    type('2');
    expect(offered(container)).toEqual([
      '2024 (6)',
      '2023 (5)',
      '2022 (4)',
      '2021 (3)',
      '2020 (2)',
      '2019 (1)',
    ]);

    type('202');
    expect(offered(container)).toEqual([
      '2024 (6)',
      '2023 (5)',
      '2022 (4)',
      '2021 (3)',
      '2020 (2)',
    ]);

    choose('2021 (3)');
    expect(seen.at(-1)).toEqual(['2021']);
    expect(chips(container)).toEqual(['2021']);
  });

  it('foreslår periodene mens slutten skrives', () => {
    const seen: string[][] = [];
    const { container } = render(<Years seen={seen} />);

    type('2020-2');
    expect(offered(container)).toEqual([
      '2020–2021 (5)',
      '2020–2022 (9)',
      '2020–2023 (14)',
      '2020–2024 (20)',
    ]);

    choose('2020–2022 (9)');
    expect(seen.at(-1)).toEqual(['2020', '2021', '2022']);
  });

  it('lar teksten stå når Enter trykkes og ingenting passer, som de andre feltene', () => {
    // Enter chooses the option whose label is the text, and the hint carries
    // the text as its label with the value ''. That emptied the field.
    const seen: string[][] = [];
    render(<Years initial={['2024']} seen={seen} />);

    type('abc');
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(seen).toEqual([]);
    expect(input().value).toBe('abc');
  });

  it('viser hintet bare når ingenting passer', () => {
    const hint =
      'Ikke et år eller en periode. Skriv et år eller en periode, som 2021 eller 2023–2028.';
    const { container } = render(<Years />);

    for (const text of ['abc', '3', '2019-1']) {
      type(text);
      expect(offered(container), text).toEqual([hint]);
    }
    type('2');
    expect(screen.queryByText(hint)).toBeNull();
  });

  it('gir et hint i stedet for en gjetning når teksten ikke er en periode', () => {
    render(<Years />);

    expect(screen.getByText('Skriv et år eller en periode, som 2021 eller 2023–2028')).toBeTruthy();

    type('fra 2015');

    expect(screen.queryByRole('option', { name: /2015/u, hidden: true })).toBeNull();
    expect(
      screen.getByText(
        'Ikke et år eller en periode. Skriv et år eller en periode, som 2021 eller 2023–2028.',
      ),
    ).toBeTruthy();
  });

  it('har «Velg alle» og «Tøm» som de andre feltene', () => {
    const seen: string[][] = [];
    const { container } = render(<Years seen={seen} />);

    fireEvent.click(screen.getByRole('button', { name: 'Velg alle år' }));
    expect(chips(container)).toEqual(['2019–2024']);
    expect(screen.getByText('Alle 6 valgt, altså ingen avgrensning')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tøm år' }));
    expect(seen.at(-1)).toEqual([]);
    expect(screen.getByText('Ingen avgrensning')).toBeTruthy();
  });
});

describe('årsfeltet når lista har færre år enn det som er valgt', () => {
  it('sier at alle er valgt når hvert år i lista er valgt, også med et år utenfor', () => {
    // 2030 holds no documents (question 4), and the six listed years are all
    // ticked: the question leaves the field out, and the field says the same.
    render(<Years initial={['2019', '2020', '2021', '2022', '2023', '2024', '2030']} />);

    expect(screen.getByText('Alle 6 valgt, altså ingen avgrensning')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Velg alle år' })).toBeNull();
  });

  it('legger til med «Velg alle» og beholder år som ikke står i lista', () => {
    const seen: string[][] = [];
    render(<Years initial={['2030']} seen={seen} />);

    fireEvent.click(screen.getByRole('button', { name: 'Velg alle år' }));

    expect([...(seen.at(-1) ?? [])].sort()).toEqual([
      '2019',
      '2020',
      '2021',
      '2022',
      '2023',
      '2024',
      '2030',
    ]);
  });
});

describe('samlede merkelapper (compact-filter-chips)', () => {
  function Organisations({ initial, seen }: { initial: string[]; seen?: string[][] }) {
    const [selected, setSelected] = useState(initial);
    return (
      <FacetField
        facet={organisations}
        selected={selected}
        onChange={(next) => {
          seen?.push(next);
          setSelected(next);
        }}
      />
    );
  }
  const first = (count: number) => organisations.values.slice(0, count).map((v) => v.value);

  it('viser én merkelapp per verdi når flagget er av', () => {
    const { container } = render(<Organisations initial={first(12)} />);

    expect(chips(container)).toHaveLength(12);
  });

  it('samler mange valgte verdier i én merkelapp', () => {
    setFlag('compact-filter-chips', true);
    const { container } = render(<Organisations initial={first(12)} />);

    expect(chips(container)).toEqual(['12 virksomheter']);
  });

  it('sier «Alle» når alle er valgt', () => {
    setFlag('compact-filter-chips', true);
    const { container } = render(<Organisations initial={first(20)} />);

    expect(chips(container)).toEqual(['Alle virksomheter']);
  });

  it('lar noen få valgte verdier stå hver for seg', () => {
    setFlag('compact-filter-chips', true);
    const { container } = render(<Organisations initial={first(5)} />);

    expect(chips(container)).toEqual(first(5));
  });

  it('fjerner hele valget når den samlede merkelappen fjernes', () => {
    setFlag('compact-filter-chips', true);
    const seen: string[][] = [];
    const { container } = render(<Organisations initial={first(12)} seen={seen} />);

    fireEvent.click(screen.getByRole('option', { name: /^12 virksomheter, Trykk for å fjerne/u }));

    expect(seen.at(-1)).toEqual([]);
    expect(chips(container)).toEqual([]);
  });

  it('legger en ny verdi til valget bak den samlede merkelappen', () => {
    setFlag('compact-filter-chips', true);
    const seen: string[][] = [];
    const { container } = render(<Organisations initial={first(12)} seen={seen} />);

    choose('Virksomhet 13 (1)');

    expect(seen.at(-1)).toEqual(first(13));
    expect(chips(container)).toEqual(['13 virksomheter']);
  });
});

describe('panelet med flaggene', () => {
  /* As FiltersView.test.tsx mounts it. */
  function renderView() {
    return render(
      <MemoryRouter>
        <FilterContext value={{ selection: emptyFilterSelection, setSelection: () => {} }}>
          <AnswerSourcesContext value={inertAnswerSources}>
            <FiltersView siblingViews={['filters']} onShowView={() => {}} facets={[years]} />
          </AnswerSourcesContext>
        </FilterContext>
      </MemoryRouter>,
    );
  }

  it('har årsfeltet som før når flagget er av', () => {
    renderView();

    expect(screen.getByPlaceholderText('Søk i år')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Skriv et år eller en periode')).toBeNull();
  });

  it('bytter til perioder når year-ranges er på', () => {
    setFlag('year-ranges', true);
    renderView();

    expect(screen.getByPlaceholderText('Skriv et år eller en periode')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Søk i år')).toBeNull();
  });
});
