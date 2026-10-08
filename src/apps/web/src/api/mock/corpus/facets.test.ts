import { describe, expect, it } from 'vitest';
import { emptyFilterSelection, type FilterSelection } from '../../../model';
import { documentsMatching, facetsFor } from './facets';
import { corpusDocuments, type CorpusDocument } from './index';

/** A small corpus, so the arithmetic is checkable by eye. */
const documents: CorpusDocument[] = [
  {
    id: '1',
    title: 'A',
    type: 'Årsrapport',
    organisation: 'Digdir',
    year: 2024,
    summary: '',
    url: '',
  },
  {
    id: '2',
    title: 'B',
    type: 'Årsrapport',
    organisation: 'Digdir',
    year: 2023,
    summary: '',
    url: '',
  },
  {
    id: '3',
    title: 'C',
    type: 'Årsrapport',
    organisation: 'Nkom',
    year: 2024,
    summary: '',
    url: '',
  },
  {
    id: '4',
    title: 'D',
    type: 'Evaluering',
    organisation: 'Nkom',
    year: 2024,
    summary: '',
    url: '',
  },
  {
    id: '5',
    title: 'E',
    type: 'Evaluering',
    organisation: 'Digdir',
    year: 2022,
    summary: '',
    url: '',
  },
];

const select = (patch: Partial<FilterSelection>): FilterSelection => ({
  ...emptyFilterSelection,
  ...patch,
});

const facet = (selection: FilterSelection, dimension: string) =>
  facetsFor(selection, documents).find((f) => f.dimension === dimension)!;

const counts = (selection: FilterSelection, dimension: string) =>
  Object.fromEntries(facet(selection, dimension).values.map((v) => [v.value, v.count]));

describe('facetsFor', () => {
  it('teller hele korpuset når ingenting er valgt', () => {
    expect(counts(emptyFilterSelection, 'documentType')).toEqual({ Årsrapport: 3, Evaluering: 2 });
    expect(counts(emptyFilterSelection, 'organisation')).toEqual({ Digdir: 3, Nkom: 2 });
    expect(counts(emptyFilterSelection, 'year')).toEqual({ '2024': 3, '2023': 1, '2022': 1 });
  });

  it('lar en dimensjon ikke snevre inn sine egne tellere', () => {
    // Dette er hele regelen. Huker du av «Årsrapport», skal «Evaluering»
    // fortsatt stå der med 2 — ellers ser lista ut som om det ikke finnes
    // noe annet, når sannheten er at du ikke har bedt om noe annet ennå.
    const selection = select({ documentType: ['Årsrapport'] });
    expect(counts(selection, 'documentType')).toEqual({ Årsrapport: 3, Evaluering: 2 });
  });

  it('lar de andre dimensjonene snevre inn', () => {
    // Med «Årsrapport» valgt teller årene bare årsrapporter: 2022 hadde bare
    // en evaluering og forsvinner.
    const selection = select({ documentType: ['Årsrapport'] });
    expect(counts(selection, 'year')).toEqual({ '2024': 2, '2023': 1 });
    expect(counts(selection, 'organisation')).toEqual({ Digdir: 2, Nkom: 1 });
  });

  it('kombinerer valg på tvers av dimensjoner', () => {
    const selection = select({ documentType: ['Årsrapport'], organisation: ['Digdir'] });
    expect(counts(selection, 'year')).toEqual({ '2024': 1, '2023': 1 });
    // Fortsatt ikke sin egen dimensjon, men nå betinget av Digdir.
    expect(counts(selection, 'documentType')).toEqual({ Årsrapport: 2, Evaluering: 1 });
  });

  it('beholder et valgt tomt treff i lista', () => {
    // Uten dette forsvinner den eneste kontrollen som kan angre valget som
    // tømte den.
    const selection = select({ documentType: ['Evaluering'], year: ['2023'] });
    expect(counts(selection, 'documentType')).toMatchObject({ Evaluering: 0 });
  });

  it('sorterer år nyest først og resten etter antall', () => {
    expect(facet(emptyFilterSelection, 'year').values.map((v) => v.value)).toEqual([
      '2024',
      '2023',
      '2022',
    ]);
    expect(facet(emptyFilterSelection, 'organisation').values.map((v) => v.value)).toEqual([
      'Digdir',
      'Nkom',
    ]);
  });

  it('tilbyr ikke år som ikke har kommet ennå', () => {
    // Issue 75, som i tynnserveren og BFF-en. Mock-korpuset har to
    // budsjettforslag «for 2027», og de er fortsatt søkbare. Men 2027 er ikke
    // noe å avgrense til i 2026.
    const withPlan = [...documents, { ...documents[0]!, id: '6', year: 2027 }];
    const years = facetsFor(emptyFilterSelection, withPlan, 2026)
      .find((f) => f.dimension === 'year')!
      .values.map((v) => v.value);
    expect(years).toEqual(['2024', '2023', '2022']);
  });

  it('beholder et framtidig år som alt er valgt, så valget kan angres', () => {
    const withPlan = [...documents, { ...documents[0]!, id: '6', year: 2027 }];
    const years = facetsFor(select({ year: ['2027'] }), withPlan, 2026).find(
      (f) => f.dimension === 'year',
    )!.values;
    expect(years.find((v) => v.value === '2027')?.count).toBe(1);
  });
});

describe('documentsMatching', () => {
  it('lar en tom dimensjon bety «ingen begrensning»', () => {
    expect(documentsMatching(emptyFilterSelection, documents)).toHaveLength(5);
  });

  it('snevrer inn på hver dimensjon som har et valg', () => {
    expect(documentsMatching(select({ organisation: ['Nkom'] }), documents)).toHaveLength(2);
    // Nkom har to dokumenter, begge fra 2024, så året endrer ingenting her.
    expect(
      documentsMatching(select({ organisation: ['Nkom'], year: ['2024'] }), documents),
    ).toHaveLength(2);
    // Men et år Nkom ikke har noe i, tømmer treffet.
    expect(
      documentsMatching(select({ organisation: ['Nkom'], year: ['2022'] }), documents),
    ).toHaveLength(0);
  });
});

describe('det ekte korpuset', () => {
  it('er hentet, ikke tomt', () => {
    expect(corpusDocuments.length).toBeGreaterThan(500);
  });

  it('har de fem dokumenttypene oppdraget ber om', () => {
    const types = new Set(corpusDocuments.map((d) => d.type));
    for (const type of [
      'Årsrapport',
      'Evaluering',
      'Tildelingsbrev',
      'Statusrapport',
      'Strategi/plan',
    ]) {
      expect(types, `korpuset mangler ${type}`).toContain(type);
    }
  });

  it('har sammendrag å sitere fra, og lenke til Kudos eller en grunn til at den mangler', () => {
    for (const document of corpusDocuments) {
      expect(document.summary.length).toBeGreaterThanOrEqual(200);
      if (document.url === undefined) {
        expect(document.urlMissing, `${document.id} mangler både lenke og grunn`).toMatch(/404/);
      } else {
        expect(document.url).toMatch(/^https:\/\/kudos\.dfo\.no\/dokument\//);
      }
      expect(document.year).toBeGreaterThanOrEqual(2020);
    }
  });

  it('lenker ikke til NKOM-årsrapporten for 2025, som Kudos svarer 404 på', () => {
    // Målt 30.09: 404 på nettstedet og i API-et. Panelet skal si «ingen
    // offentlig lenke» heller enn sende leseren til en feilside.
    const nkom = corpusDocuments.find((d) => d.id === 'a1c6feb9-3a47-4889-b049-92adae575b9f');
    expect(nkom?.url).toBeUndefined();
    expect(nkom?.urlMissing).toMatch(/404/);
  });
});
