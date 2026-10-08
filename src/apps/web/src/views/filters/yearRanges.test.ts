import { describe, expect, it } from 'vitest';
import {
  documentsIn,
  formatRange,
  parseYearInput,
  rangeFromKey,
  rangeKey,
  suggestPeriods,
  toRanges,
  yearsIn,
} from './yearRanges';

/** The year the two-digit rule is counted from, fixed so the tests do not age. */
const NOW = 2026;

describe('teksten leseren skriver, som periode', () => {
  it.each([
    ['2021', 2021, 2021],
    ['  2021 ', 2021, 2021],
    ['2023-2028', 2023, 2028],
    ['2023–2028', 2023, 2028],
    ['2023—2028', 2023, 2028],
    ['2023 - 2028', 2023, 2028],
    ['2023 – 2028', 2023, 2028],
    ['2023 til 2028', 2023, 2028],
    ['2023 TIL 2028', 2023, 2028],
    ['2023til2028', 2023, 2028],
    ['23-28', 2023, 2028],
    ['92-00', 1992, 2000],
    ['2023–28', 2023, 2028],
    ['1998-02', 1998, 2002],
    ['23', 2023, 2023],
    ['26', 2026, 2026],
    ['27', 1927, 1927],
    ['99', 1999, 1999],
    ['00', 2000, 2000],
    ['2028-2023', 2023, 2028],
    // Two digits at the end always end after the start: 28 is 1928 in 2026.
    ['28-23', 1928, 2023],
    ['2024-2024', 2024, 2024],
  ])('«%s» er %i–%i', (text, from, to) => {
    expect(parseYearInput(text, NOW)).toEqual({ from, to });
  });

  it.each([
    [''],
    ['   '],
    ['202'],
    ['20234'],
    ['2'],
    ['fra 2015'],
    ['til 2010'],
    ['2015-'],
    ['-2015'],
    ['2015 og 2017'],
    ['2015, 2017'],
    ['to tusen'],
    ['2023-2028-2030'],
    ['2023 / 2028'],
  ])('«%s» er ikke en periode', (text) => {
    expect(parseYearInput(text, NOW)).toBeUndefined();
  });

  it('teller to sifre fra året det er nå, så grensen flytter seg med tiden', () => {
    expect(parseYearInput('30', 2029)).toEqual({ from: 1930, to: 1930 });
    expect(parseYearInput('30', 2030)).toEqual({ from: 2030, to: 2030 });
  });
});

describe('forslag mens leseren skriver', () => {
  /* 2025 is listed with no documents, as the BFF lists every year it has. */
  const values = [
    ...[1998, 2001, 2019, 2020, 2021, 2022, 2023, 2024].map((year) => ({
      value: String(year),
      count: 1,
    })),
    { value: '2025', count: 0 },
  ];
  const offered = (text: string) => suggestPeriods(text, values, NOW).map(formatRange);
  const from2019 = ['2019–2020', '2019–2021', '2019–2022', '2019–2023', '2019–2024'];

  it.each([
    ['2', ['2024', '2023', '2022', '2021', '2020', '2019', '2001']],
    ['202', ['2024', '2023', '2022', '2021', '2020']],
    ['201', ['2019']],
    ['1', ['1998']],
    // «20» is 2020 written with two digits, and it begins the 2000s.
    ['20', ['2024', '2023', '2022', '2021', '2020', '2019', '2001']],
  ])('«%s» gir årene med dokumenter som begynner slik, nyest først', (text, expected) => {
    expect(offered(text)).toEqual(expected);
  });

  it.each([
    ['2019-', from2019],
    ['2019 –', from2019],
    ['2019 t', from2019],
    ['2019 til', from2019],
    ['2019-2', from2019],
    ['2019-20', from2019],
    ['2019-202', from2019],
    ['2019 til 202', from2019],
    ['23-2', ['2023–2024']],
    // Two digits end within a hundred years of the start: «01» is 2001.
    ['98-0', ['1998–2001']],
  ])('«%s» gir periodene som slutten kan bli, korteste først', (text, expected) => {
    expect(offered(text)).toEqual(expected);
  });

  it.each([
    ['2023', ['2023']],
    ['2019-2022', ['2019–2022']],
    ['23-24', ['2023–2024']],
    // A whole period is offered with or without documents, as before.
    ['2025', ['2025']],
    ['2030', ['2030']],
    ['2030-2031', ['2030–2031']],
  ])('«%s» er en hel periode og gir den', (text, expected) => {
    expect(offered(text)).toEqual(expected);
  });

  it.each([[''], ['   '], ['abc'], ['3'], ['2019-1'], ['20234'], ['fra 2015'], ['-2015']])(
    '«%s» gir ingenting, så feltet viser hintet',
    (text) => {
      expect(offered(text)).toEqual([]);
    },
  );

  it('regner år uten tall som år med dokumenter, som når et annet felt er valgt i bff og live', () => {
    expect(suggestPeriods('202', [{ value: '2020' }, { value: '2023' }], NOW)).toEqual([
      { from: 2023, to: 2023 },
      { from: 2020, to: 2020 },
    ]);
  });
});

describe('et sett med år, som perioder', () => {
  it('samler år på rad i én periode', () => {
    expect(toRanges([2022, 2023, 2024])).toEqual([{ from: 2022, to: 2024 }]);
  });

  it('lar et enkeltår stå alene, og starter en ny periode etter et hull', () => {
    expect(toRanges([1992, 1993, 2000, 2019, 2008, 2009, 2010])).toEqual([
      { from: 1992, to: 1993 },
      { from: 2000, to: 2000 },
      { from: 2008, to: 2010 },
      { from: 2019, to: 2019 },
    ]);
  });

  it('tar årene som strenger, som filteret holder dem, og bryr seg ikke om rekkefølge eller dobbelt', () => {
    expect(toRanges(['2024', '2022', '2023', '2023'])).toEqual([{ from: 2022, to: 2024 }]);
  });

  it('hopper over det som ikke er et helt år', () => {
    expect(toRanges(['2024', 'abc', '2023.5', ''])).toEqual([{ from: 2024, to: 2024 }]);
  });

  it('gir ingen perioder for ingen år', () => {
    expect(toRanges([])).toEqual([]);
  });

  it('kommer tilbake til de samme årene', () => {
    const years = [1992, 1993, 1994, 2000, 2008, 2009, 2020];
    expect(toRanges(years).flatMap(yearsIn)).toEqual(years);
  });
});

describe('periodens tekst og nøkkel', () => {
  it('skriver et enkeltår som året og en periode med tankestrek', () => {
    expect(formatRange({ from: 2019, to: 2019 })).toBe('2019');
    expect(formatRange({ from: 2022, to: 2024 })).toBe('2022–2024');
  });

  it('har en nøkkel som leses tilbake til samme periode', () => {
    const range = { from: 1992, to: 2000 };
    expect(rangeKey(range)).toBe('1992-2000');
    expect(rangeFromKey(rangeKey(range))).toEqual(range);
    expect(rangeFromKey('2019-2019')).toEqual({ from: 2019, to: 2019 });
  });

  it('leser ikke noe annet som en nøkkel', () => {
    expect(rangeFromKey('2024')).toBeUndefined();
    expect(rangeFromKey('2028-2023')).toBeUndefined();
    expect(rangeFromKey('årsrapport')).toBeUndefined();
  });
});

describe('dokumentene i en periode', () => {
  const values = [
    { value: '2024', count: 10 },
    { value: '2023', count: 5 },
    { value: '2020', count: 2 },
  ];

  it('summerer tallene fra fasettene', () => {
    expect(documentsIn({ from: 2022, to: 2024 }, values)).toBe(15);
  });

  it('gir 0 for år uten dokumenter, så perioden likevel kan velges', () => {
    expect(documentsIn({ from: 2030, to: 2031 }, values)).toBe(0);
  });

  it('gir ingen tall når fasettene ikke har tall, som i live', () => {
    expect(documentsIn({ from: 2022, to: 2024 }, [{ value: '2024' }])).toBeUndefined();
  });
});
