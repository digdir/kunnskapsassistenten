import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

/** The chips as the reader sees them: a drawn chip hides the chip per value (filters.css, which
 * jsdom does not apply), so with one drawn, only the drawn ones. */
function chips(container: HTMLElement): string[] {
  const all = [...container.querySelectorAll('ds-suggestion > data')];
  const drawn = all.filter((chip) => chip.querySelector('.drawn-chip'));
  return (drawn.length > 0 ? drawn : all).map((chip) => chip.textContent ?? '');
}

/** The options u-combobox has ticked. */
function ticked(container: HTMLElement): string[] {
  return [...container.querySelectorAll('u-datalist u-option[selected]')].map(
    (option) => option.getAttribute('value') ?? '',
  );
}

/** The selection lives above the field, as it does in the view. */
function Years({
  initial = [] as string[],
  seen,
  said,
  facet = years,
}: {
  initial?: string[];
  seen?: string[][];
  said?: (string | undefined)[];
  facet?: FilterFacet;
}) {
  const [selected, setSelected] = useState(initial);
  return (
    <YearRangeField
      facet={facet}
      selected={selected}
      onChange={(next, text) => {
        seen?.push(next);
        said?.push(text);
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

describe('årslista ved klikk (year-ranges)', () => {
  const hint = 'Skriv et år eller en periode, som 2021 eller 2023–2028';

  it('viser årene med dokumenter før noe er skrevet, med hintet over dem', () => {
    const facet = {
      ...years,
      values: [...years.values, { value: '2018', label: '2018', count: 0 }],
    };
    const { container } = render(<Years facet={facet} />);

    expect(offered(container)).toEqual([
      '2024 (6)',
      '2023 (5)',
      '2022 (4)',
      '2021 (3)',
      '2020 (2)',
      '2019 (1)',
    ]);
    // Not an option to walk to or choose; the placeholder says the same to a screen reader.
    expect(screen.getByText(hint).closest('u-datalist')).toBeTruthy();
    expect(screen.getByText(hint).getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('button', { name: 'Valg' })).toBeTruthy();
  });

  it('krysser av de valgte årene, også inne i en periode, og setter dem først', () => {
    const { container } = render(<Years initial={['2020', '2022', '2023']} />);

    expect(chips(container)).toEqual(['2020', '2022–2023']);
    expect(ticked(container)).toEqual(['2023', '2022', '2020']);
    expect(offered(container)).toEqual([
      '2023 (5)',
      '2022 (4)',
      '2020 (2)',
      '2024 (6)',
      '2021 (3)',
      '2019 (1)',
    ]);
  });

  it('setter de valgte årene først også mens et år skrives', () => {
    const { container } = render(<Years initial={['2021']} />);

    type('202');

    expect(offered(container)).toEqual([
      '2021 (3)',
      '2024 (6)',
      '2023 (5)',
      '2022 (4)',
      '2020 (2)',
    ]);
  });

  it('tar et år ut av perioden når det velges igjen, og sier fra', () => {
    const seen: string[][] = [];
    const said: (string | undefined)[] = [];
    const { container } = render(
      <Years initial={['2022', '2023', '2024']} seen={seen} said={said} />,
    );

    choose('2023 (5)');

    expect(seen.at(-1)).toEqual(['2022', '2024']);
    expect(chips(container)).toEqual(['2022', '2024']);
    expect(said.at(-1)).toBe('Fjernet 2023');
  });

  it('sier hva som ble lagt til, også når det slår seg sammen med en periode', () => {
    const said: (string | undefined)[] = [];
    render(<Years initial={['2022']} said={said} />);

    choose('2023 (5)');
    expect(said.at(-1)).toBe('Lagt til 2023');

    type('19-21');
    choose('2019–2021 (6)');
    expect(said.at(-1)).toBe('Lagt til 2019–2021');
  });

  it('endrer ingenting når en periode som alt er valgt, velges igjen, men sier fra', () => {
    const seen: string[][] = [];
    const said: (string | undefined)[] = [];
    render(<Years initial={['2020', '2021', '2022', '2023']} seen={seen} said={said} />);

    type('20-22');
    choose('2020–2022 (9)');
    // Inside a longer period too.
    type('21-22');
    choose('2021–2022 (7)');

    const before = ['2020', '2021', '2022', '2023'];
    expect(seen).toEqual([before, before]);
    expect(said).toEqual(['2020–2022 er alt valgt.', '2021–2022 er alt valgt.']);
    expect(input().value).toBe('');
  });

  it('teller årene for skjermleseren, ikke merkelappene', () => {
    render(<Years initial={['2022', '2023', '2024']} />);

    expect(input().getAttribute('aria-description')).toBe('3 valgt, naviger bakover for å endre');
  });

  it('flytter fokus til neste periode, og så til feltet, når perioder fjernes med tastaturet', () => {
    const seen: string[][] = [];
    const said: (string | undefined)[] = [];
    render(<Years initial={['2019', '2020', '2022', '2023']} seen={seen} said={said} />);

    // Back from the field to the last period, and on to the first.
    act(() => input().focus());
    fireEvent.keyDown(input(), { key: 'ArrowLeft' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft' });
    const first = screen.getByRole('option', { name: /^2019–2020, Trykk for å fjerne/u });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'Backspace' });
    expect(seen.at(-1)).toEqual(['2022', '2023']);
    expect(said.at(-1)).toBe('Fjernet 2019–2020');
    const last = screen.getByRole('option', { name: /^2022–2023, Trykk for å fjerne/u });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(last, { key: 'Backspace' });
    expect(seen.at(-1)).toEqual([]);
    expect(document.activeElement).toBe(input());
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
  function Organisations({
    initial,
    seen,
    said,
  }: {
    initial: string[];
    seen?: string[][];
    said?: (string | undefined)[];
  }) {
    const [selected, setSelected] = useState(initial);
    return (
      <FacetField
        facet={organisations}
        selected={selected}
        onChange={(next, text) => {
          seen?.push(next);
          said?.push(text);
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

  it('krysser av hver valgte verdi i lista mens den samlede merkelappen står', () => {
    // Measured 12.10 on 220fa83: the list ticked none, as the one chip was the only one.
    setFlag('compact-filter-chips', true);
    const { container } = render(<Organisations initial={first(12)} />);

    expect(ticked(container)).toEqual(first(12));
  });

  it('tar bort én verdi når en avkrysset verdi velges igjen', () => {
    setFlag('compact-filter-chips', true);
    const seen: string[][] = [];
    const { container } = render(<Organisations initial={first(12)} seen={seen} />);

    choose('Virksomhet 3 (1)');

    expect(seen.at(-1)).toEqual(first(12).filter((value) => value !== 'Virksomhet 3'));
    expect(chips(container)).toEqual(['11 virksomheter']);
  });

  it('teller verdiene, ikke merkelappene, for skjermleseren', () => {
    setFlag('compact-filter-chips', true);
    render(<Organisations initial={first(12)} />);

    expect(input().getAttribute('aria-description')).toBe(
      '12 valgt, naviger bakover for å fjerne alle',
    );
  });

  it('sier selv fra om verdien som gjør merkelappene til én, og om den som deler dem igjen', () => {
    // u-combobox reads out a change only when one chip comes or goes, and here the drawn
    // chip comes or goes as well.
    setFlag('compact-filter-chips', true);
    const said: (string | undefined)[] = [];
    render(<Organisations initial={first(5)} said={said} />);

    choose('Virksomhet 6 (1)');
    expect(said.at(-1)).toBe('Lagt til Virksomhet 6');

    choose('Virksomhet 7 (1)');
    expect(said.at(-1)).toBeUndefined();

    choose('Virksomhet 7 (1)');
    choose('Virksomhet 6 (1)');
    expect(said.at(-1)).toBe('Fjernet Virksomhet 6');
  });

  it('flytter fokus til feltet og sier fra når den samlede merkelappen fjernes med tastaturet', () => {
    setFlag('compact-filter-chips', true);
    const seen: string[][] = [];
    const said: (string | undefined)[] = [];
    const { container } = render(<Organisations initial={first(12)} seen={seen} said={said} />);

    // Back from the empty field reaches the drawn chip, the last one, as u-combobox walks them.
    act(() => input().focus());
    fireEvent.keyDown(input(), { key: 'ArrowLeft' });
    const chip = screen.getByRole('option', { name: /^12 virksomheter, Trykk for å fjerne alle/u });
    expect(document.activeElement).toBe(chip);

    fireEvent.keyDown(chip, { key: 'Backspace' });

    expect(seen.at(-1)).toEqual([]);
    expect(said.at(-1)).toBe('Ingen virksomheter er valgt.');
    expect(chips(container)).toEqual([]);
    expect(document.activeElement).toBe(input());
  });
});

describe('«Velg alle» og «Tøm» for skjermleseren', () => {
  /** What the field gives the view's live region, one entry per change. */
  function Organisations({ initial, said }: { initial: string[]; said: (string | undefined)[] }) {
    const [selected, setSelected] = useState(initial);
    return (
      <FacetField
        facet={organisations}
        selected={selected}
        onChange={(next, text) => {
          said.push(text);
          setSelected(next);
        }}
      />
    );
  }

  function Years({ initial, said }: { initial: string[]; said: (string | undefined)[] }) {
    const [selected, setSelected] = useState(initial);
    return (
      <YearRangeField
        facet={years}
        selected={selected}
        onChange={(next, text) => {
          said.push(text);
          setSelected(next);
        }}
      />
    );
  }

  const all = organisations.values.map((value) => value.value);

  it('sier hva knappene gjorde når mange verdier endres', () => {
    const said: (string | undefined)[] = [];
    render(<Organisations initial={[]} said={said} />);

    fireEvent.click(screen.getByRole('button', { name: 'Velg alle virksomheter' }));
    expect(said.at(-1)).toBe('Alle 20 virksomheter er valgt.');

    fireEvent.click(screen.getByRole('button', { name: 'Tøm virksomheter' }));
    expect(said.at(-1)).toBe('Ingen virksomheter er valgt.');
  });

  // u-combobox reads out one chip that comes or goes («Fjernet …», «Lagt til …»); the view
  // saying it too was heard twice (measured 12.10).
  it('lar u-combobox si fra alene når bare én verdi endres', () => {
    const said: (string | undefined)[] = [];
    const { unmount } = render(<Organisations initial={all.slice(0, 1)} said={said} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tøm virksomheter' }));
    expect(said).toEqual([undefined]);
    unmount();

    render(<Organisations initial={all.slice(1)} said={said} />);
    fireEvent.click(screen.getByRole('button', { name: 'Velg alle virksomheter' }));
    expect(said).toEqual([undefined, undefined]);
  });

  it('lar u-combobox si fra alene også bak den samlede merkelappen, som blir stående', () => {
    setFlag('compact-filter-chips', true);
    const said: (string | undefined)[] = [];
    render(<Organisations initial={all.slice(1)} said={said} />);

    fireEvent.click(screen.getByRole('button', { name: 'Velg alle virksomheter' }));

    expect(said).toEqual([undefined]);
    expect(chips(document.body)).toEqual(['Alle virksomheter']);
  });

  it('sier fra når den samlede merkelappen kommer, også om bare én verdi kom til', () => {
    // Four of five: the chips are four, and «Velg alle» makes them one drawn chip.
    setFlag('compact-filter-chips', true);
    const five: FilterFacet = { ...organisations, values: organisations.values.slice(0, 5) };
    const said: (string | undefined)[] = [];
    function Five() {
      const [selected, setSelected] = useState(all.slice(0, 4));
      return (
        <FacetField
          facet={five}
          selected={selected}
          onChange={(next, text) => {
            said.push(text);
            setSelected(next);
          }}
        />
      );
    }
    render(<Five />);

    fireEvent.click(screen.getByRole('button', { name: 'Velg alle virksomheter' }));

    expect(said).toEqual(['Alle 5 virksomheter er valgt.']);
  });

  it('sier fra selv i årsfeltet, der et år og perioden det står i, er hver sin merkelapp', () => {
    // u-combobox counts the chips Suggestion holds: one per year, hidden, and one per period.
    const said: (string | undefined)[] = [];
    render(<Years initial={['2019', '2022']} said={said} />);

    fireEvent.click(screen.getByRole('button', { name: 'Velg alle år' }));
    expect(said.at(-1)).toBe('Alle 6 år er valgt.');

    // Six years and the period 2019–2024 go.
    fireEvent.click(screen.getByRole('button', { name: 'Tøm år' }));
    expect(said.at(-1)).toBe('Ingen år er valgt.');
  });

  it('sier fra i panelet også når de samme ordene kommer to ganger etter hverandre', () => {
    // A live region speaks when its text changes; the second «Ingen … er valgt.» gets a
    // no-break space so it does.
    function View() {
      const [selection, setSelection] = useState({
        ...emptyFilterSelection,
        organisation: all.slice(0, 2),
      });
      return (
        <MemoryRouter>
          <FilterContext value={{ selection, setSelection }}>
            <AnswerSourcesContext value={inertAnswerSources}>
              <FiltersView
                siblingViews={['filters']}
                onShowView={() => {}}
                facets={[organisations]}
              />
            </AnswerSourcesContext>
          </FilterContext>
        </MemoryRouter>
      );
    }
    const { container } = render(<View />);
    const region = () => container.querySelector('.filters-view > output')?.textContent;
    const field = screen.getByPlaceholderText('Søk i virksomheter') as HTMLInputElement;
    function pick(name: string) {
      const value = screen.getByRole('option', { name, hidden: true }).getAttribute('value') ?? '';
      act(() => {
        field.value = value;
        field.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            inputType: 'insertReplacementText',
            data: value,
          }),
        );
      });
    }

    fireEvent.click(screen.getByRole('button', { name: 'Tøm virksomheter' }));
    expect(region()).toBe('Ingen virksomheter er valgt.');

    // One at a time, so u-combobox tells them and the region keeps its words.
    pick('Virksomhet 3 (1)');
    pick('Virksomhet 4 (1)');
    expect(region()).toBe('Ingen virksomheter er valgt.');

    fireEvent.click(screen.getByRole('button', { name: 'Tøm virksomheter' }));
    expect(region()).toBe('Ingen virksomheter er valgt.\u00a0');
  });
});

describe('en periode som alt er valgt, i panelet', () => {
  it('sier fra i panelet uten å sette filteret på nytt, som ville hentet fasettene', () => {
    setFlag('year-ranges', true);
    const setSelection = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <FilterContext
          value={{ selection: { ...emptyFilterSelection, year: ['2022', '2023'] }, setSelection }}
        >
          <AnswerSourcesContext value={inertAnswerSources}>
            <FiltersView siblingViews={['filters']} onShowView={() => {}} facets={[years]} />
          </AnswerSourcesContext>
        </FilterContext>
      </MemoryRouter>,
    );
    const field = screen.getByPlaceholderText('Skriv et år eller en periode') as HTMLInputElement;
    act(() => {
      field.value = '22-23';
      field.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '22-23' }),
      );
    });
    const value =
      screen.getByRole('option', { name: '2022–2023 (9)', hidden: true }).getAttribute('value') ??
      '';
    act(() => {
      field.value = value;
      field.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: value }),
      );
    });

    expect(container.querySelector('.filters-view > output')?.textContent).toBe(
      '2022–2023 er alt valgt.',
    );
    expect(setSelection).not.toHaveBeenCalled();
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
