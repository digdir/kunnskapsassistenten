import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
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

describe('the year field with periods', () => {
  it('shows consecutive years as one chip, and a gap as two', () => {
    const { container } = render(<Years initial={['2022', '2023', '2024', '2019']} />);

    expect(chips(container)).toEqual(['2019', '2022–2024']);
    expect(screen.getByText('4 år valgt')).toBeTruthy();
  });

  it('suggests the period from the text, with the years in it that have documents', () => {
    render(<Years />);

    type('20-22');

    // 2020, 2021 and 2022 hold 2, 3 and 4 documents, which may be the same document.
    expect(
      screen.getByRole('option', { name: '2020–2022 (3 år med dokumenter)', hidden: true }),
    ).toBeTruthy();
  });

  it('suggests a year without documents with 0, and it can be chosen', () => {
    const seen: string[][] = [];
    const { container } = render(<Years seen={seen} />);

    type('2030');
    choose('2030 (0)');

    expect(seen.at(-1)).toEqual(['2030']);
    expect(chips(container)).toEqual(['2030']);
  });

  it('still sends a list of years, and joins a period that touches another', () => {
    const seen: string[][] = [];
    const { container } = render(<Years initial={['2019', '2020']} seen={seen} />);

    type('21-23');
    choose('2021–2023 (3 år med dokumenter)');

    expect(seen.at(-1)).toEqual(['2019', '2020', '2021', '2022', '2023']);
    expect(chips(container)).toEqual(['2019–2023']);
  });

  it('chooses the period with Enter, straight from the typed text', () => {
    // u-combobox chooses on Enter the option whose label is what the field
    // holds, so the option's label is the text as typed.
    const seen: string[][] = [];
    const { container } = render(<Years seen={seen} />);

    type('23-24');
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(seen.at(-1)).toEqual(['2023', '2024']);
    expect(chips(container)).toEqual(['2023–2024']);
  });

  it('clears the text after a choice, so the next period can be typed', () => {
    render(<Years />);

    type('2024');
    choose('2024 (6)');

    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('');
  });

  it('removes a period as one', () => {
    const seen: string[][] = [];
    const { container } = render(<Years initial={['2019', '2022', '2023', '2024']} seen={seen} />);

    fireEvent.click(screen.getByRole('option', { name: /^2022–2024, Trykk for å fjerne/u }));

    expect(seen.at(-1)).toEqual(['2019']);
    expect(chips(container)).toEqual(['2019']);
  });

  it('suggests the years with documents while a year is typed, and one can be chosen', () => {
    const seen: string[][] = [];
    const { container } = render(<Years seen={seen} />);

    // Newest first, as the facets list them.
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

  it('suggests the periods while the end is typed', () => {
    const seen: string[][] = [];
    const { container } = render(<Years seen={seen} />);

    type('2020-2');
    expect(offered(container)).toEqual([
      '2020–2021 (2 år med dokumenter)',
      '2020–2022 (3 år med dokumenter)',
      '2020–2023 (4 år med dokumenter)',
      '2020–2024 (5 år med dokumenter)',
    ]);

    choose('2020–2022 (3 år med dokumenter)');
    expect(seen.at(-1)).toEqual(['2020', '2021', '2022']);
  });

  it('keeps the text when Enter is pressed and nothing matches, as the other fields do', () => {
    // Enter chooses the option whose label is the text, and the hint carries
    // the text as its label with the value ''. That emptied the field.
    const seen: string[][] = [];
    render(<Years initial={['2024']} seen={seen} />);

    type('abc');
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(seen).toEqual([]);
    expect(input().value).toBe('abc');
  });

  it('shows the hint only when nothing matches', () => {
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

  it('gives a hint instead of a guess when the text is not a period', () => {
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

  it('has «Velg alle» and «Tøm» as the other fields do', () => {
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

describe('the year list on a click', () => {
  const hint = 'Skriv et år eller en periode, som 2021 eller 2023–2028';

  it('shows the years with documents before anything is typed, with the hint above them', () => {
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

  it('ticks the chosen years, also inside a period, and puts them first', () => {
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

  it('puts the chosen years first also while a year is typed', () => {
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

  it('takes a year out of its period when it is chosen again, and says so', () => {
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

  it('says what was added, also when it joins a period', () => {
    const said: (string | undefined)[] = [];
    render(<Years initial={['2022']} said={said} />);

    choose('2023 (5)');
    expect(said.at(-1)).toBe('Lagt til 2023');

    type('19-21');
    choose('2019–2021 (3 år med dokumenter)');
    expect(said.at(-1)).toBe('Lagt til 2019–2021');
  });

  it('changes nothing when a period already chosen is chosen again, but says so', () => {
    const seen: string[][] = [];
    const said: (string | undefined)[] = [];
    render(<Years initial={['2020', '2021', '2022', '2023']} seen={seen} said={said} />);

    type('20-22');
    choose('2020–2022 (3 år med dokumenter)');
    // Inside a longer period too.
    type('21-22');
    choose('2021–2022 (2 år med dokumenter)');

    const before = ['2020', '2021', '2022', '2023'];
    expect(seen).toEqual([before, before]);
    expect(said).toEqual(['2020–2022 er alt valgt.', '2021–2022 er alt valgt.']);
    expect(input().value).toBe('');
  });

  it('takes only the years in a period that the field lists, not every calendar year', () => {
    const seen: string[][] = [];
    const facet = {
      ...years,
      values: [...years.values, { value: '1950', label: '1950', count: 2 }],
    };
    const { container } = render(<Years facet={facet} seen={seen} />);

    type('1800-2020');
    choose('1800–2020 (3 år med dokumenter)');

    expect(seen.at(-1)).toEqual(['1950', '2019', '2020']);
    expect(chips(container)).toEqual(['1950', '2019–2020']);
  });

  it('keeps a long period under the limit of values a field can send', () => {
    const seen: string[][] = [];
    render(<Years seen={seen} />);

    type('1800-2200');
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(seen.at(-1)).toEqual(['2019', '2020', '2021', '2022', '2023', '2024']);
    expect(screen.queryByText(/Høyst/u)).toBeNull();
  });

  it('keeps a chosen year the list does not have when a period is added', () => {
    const seen: string[][] = [];
    render(<Years initial={['2030']} seen={seen} />);

    type('23-24');
    choose('2023–2024 (2 år med dokumenter)');

    expect(seen.at(-1)).toEqual(['2023', '2024', '2030']);
  });

  it('counts a period in years with documents, never a sum that can pass the documents there are', () => {
    const { container } = render(<Years />);

    type('2019-2024');

    // The counts per year add up to 21, but a document with several years is in several.
    expect(offered(container)).toEqual(['2019–2024 (6 år med dokumenter)']);
  });

  it('says a period with no listed years has no documents, and chooses nothing on Enter', () => {
    const seen: string[][] = [];
    const { container } = render(<Years seen={seen} />);

    type('1700-1750');
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(offered(container)).toEqual(['Ingen dokumenter i 1700–1750.']);
    expect(seen).toEqual([]);
    expect(input().value).toBe('1700-1750');
  });

  it('counts the years for the screen reader, not the chips', () => {
    render(<Years initial={['2022', '2023', '2024']} />);

    expect(input().getAttribute('aria-description')).toBe('3 valgt, naviger bakover for å endre');
  });

  it('moves focus to the next period, then to the field, when periods are removed with the keyboard', () => {
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

describe('the year field when the list has fewer years than are chosen', () => {
  it('says all are chosen when every listed year is chosen, also with a year outside', () => {
    // 2030 holds no documents (question 4), and the six listed years are all
    // ticked: the question leaves the field out, and the field says the same.
    render(<Years initial={['2019', '2020', '2021', '2022', '2023', '2024', '2030']} />);

    expect(screen.getByText('Alle 6 valgt, altså ingen avgrensning')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Velg alle år' })).toBeNull();
  });

  it('adds with «Velg alle» and keeps years not in the list', () => {
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

describe('one chip for many chosen values', () => {
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

  it('draws one «Alle virksomheter» chip after «Velg alle», not one per value', () => {
    const { container } = render(<Organisations initial={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Velg alle virksomheter' }));

    expect(chips(container)).toEqual(['Alle virksomheter']);
  });

  it('keeps a lone chosen value as its own chip when it is the only one listed', () => {
    const one: FilterFacet = { ...organisations, values: organisations.values.slice(0, 1) };
    const { container } = render(
      <FacetField facet={one} selected={first(1)} onChange={() => {}} />,
    );

    expect(chips(container)).toEqual(first(1));
  });

  it('clears the field when the «Alle virksomheter» chip is removed', () => {
    const seen: string[][] = [];
    const { container } = render(<Organisations initial={first(20)} seen={seen} />);

    fireEvent.click(
      screen.getByRole('option', { name: /^Alle virksomheter, Trykk for å fjerne alle/u }),
    );

    expect(seen.at(-1)).toEqual([]);
    expect(chips(container)).toEqual([]);
  });

  it('shows many chosen values as one chip without any flag', () => {
    const { container } = render(<Organisations initial={first(12)} />);

    expect(chips(container)).toEqual(['12 virksomheter']);
  });

  it('says «Alle» when all are chosen', () => {
    const { container } = render(<Organisations initial={first(20)} />);

    expect(chips(container)).toEqual(['Alle virksomheter']);
  });

  it('keeps a few chosen values as a chip each', () => {
    const { container } = render(<Organisations initial={first(5)} />);

    expect(chips(container)).toEqual(first(5));
  });

  it('removes the whole choice when the one chip is removed', () => {
    const seen: string[][] = [];
    const { container } = render(<Organisations initial={first(12)} seen={seen} />);

    fireEvent.click(screen.getByRole('option', { name: /^12 virksomheter, Trykk for å fjerne/u }));

    expect(seen.at(-1)).toEqual([]);
    expect(chips(container)).toEqual([]);
  });

  it('adds a new value to the choice behind the one chip', () => {
    const seen: string[][] = [];
    const { container } = render(<Organisations initial={first(12)} seen={seen} />);

    choose('Virksomhet 13 (1)');

    expect(seen.at(-1)).toEqual(first(13));
    expect(chips(container)).toEqual(['13 virksomheter']);
  });

  it('ticks every chosen value in the list while the one chip stands', () => {
    // Measured 12.10 on 220fa83: the list ticked none, as the one chip was the only one.
    const { container } = render(<Organisations initial={first(12)} />);

    expect(ticked(container)).toEqual(first(12));
  });

  it('removes one value when a ticked value is chosen again', () => {
    const seen: string[][] = [];
    const { container } = render(<Organisations initial={first(12)} seen={seen} />);

    choose('Virksomhet 3 (1)');

    expect(seen.at(-1)).toEqual(first(12).filter((value) => value !== 'Virksomhet 3'));
    expect(chips(container)).toEqual(['11 virksomheter']);
  });

  it('counts the values for the screen reader, not the chips', () => {
    render(<Organisations initial={first(12)} />);

    expect(input().getAttribute('aria-description')).toBe(
      '12 valgt, naviger bakover for å fjerne alle',
    );
  });

  it('tells itself of the value that makes the chips one, and of the one that splits them again', () => {
    // u-combobox reads out a change only when one chip comes or goes, and here the drawn
    // chip comes or goes as well.
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

  it('moves focus to the field and says so when the one chip is removed with the keyboard', () => {
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

describe('«Velg alle» and «Tøm» for the screen reader', () => {
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

  it('says what the buttons did when many values change', () => {
    const said: (string | undefined)[] = [];
    render(<Organisations initial={[]} said={said} />);

    fireEvent.click(screen.getByRole('button', { name: 'Velg alle virksomheter' }));
    expect(said.at(-1)).toBe('Alle 20 virksomheter er valgt.');

    fireEvent.click(screen.getByRole('button', { name: 'Tøm virksomheter' }));
    expect(said.at(-1)).toBe('Ingen virksomheter er valgt.');
  });

  // u-combobox reads out one chip that comes or goes («Fjernet …», «Lagt til …»); the view
  // saying it too was heard twice (measured 12.10).
  it('lets u-combobox alone tell «Tøm» that removes one value', () => {
    const said: (string | undefined)[] = [];
    render(<Organisations initial={all.slice(0, 1)} said={said} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tøm virksomheter' }));
    expect(said).toEqual([undefined]);
  });

  it('lets u-combobox alone tell it also behind the one chip, which stays', () => {
    const said: (string | undefined)[] = [];
    render(<Organisations initial={all.slice(1)} said={said} />);

    fireEvent.click(screen.getByRole('button', { name: 'Velg alle virksomheter' }));

    expect(said).toEqual([undefined]);
    expect(chips(document.body)).toEqual(['Alle virksomheter']);
  });

  it('says so when the one chip comes, even if only one value was added', () => {
    // Four of five: the chips are four, and «Velg alle» makes them one drawn chip.
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

  it('says so itself in the year field, where a year and its period are a chip each', () => {
    // u-combobox counts the chips Suggestion holds: one per year, hidden, and one per period.
    const said: (string | undefined)[] = [];
    render(<Years initial={['2019', '2022']} said={said} />);

    fireEvent.click(screen.getByRole('button', { name: 'Velg alle år' }));
    expect(said.at(-1)).toBe('Alle 6 år er valgt.');

    // Six years and the period 2019–2024 go.
    fireEvent.click(screen.getByRole('button', { name: 'Tøm år' }));
    expect(said.at(-1)).toBe('Ingen år er valgt.');
  });

  it('says so in the panel also when the same words come twice in a row', () => {
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

describe('a period already chosen, in the panel', () => {
  it('says so in the panel without setting the filter again, which would fetch the facets', () => {
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
      screen
        .getByRole('option', { name: '2022–2023 (2 år med dokumenter)', hidden: true })
        .getAttribute('value') ?? '';
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

describe('the year field in the panel', () => {
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

  it('takes a period without any flag', () => {
    renderView();

    expect(screen.getByPlaceholderText('Skriv et år eller en periode')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Søk i år')).toBeNull();
  });
});
