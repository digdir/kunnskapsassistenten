import { describe, expect, test } from 'vitest';
import type { SourceDocument } from '../../model';
import { corpusKeyFor, documentSubtitle, isOwnDocument, OWN_DOCUMENT_LABEL } from './origin';

function source(extra: Partial<SourceDocument>): SourceDocument {
  return { id: 'd', title: 'Årsrapport 2025.pdf', excerpts: [], ...extra };
}

describe('isOwnDocument', () => {
  test('leses av origin, ikke av tittelen', () => {
    // Samme tittel, to forskjellige ting. Det var hele grunnen til at feltet
    // ble lagt på modellen.
    expect(isOwnDocument(source({ origin: 'user' }))).toBe(true);
    expect(isOwnDocument(source({ origin: 'corpus' }))).toBe(false);
  });

  test('uten origin er dokumentet fra korpuset', () => {
    // Alle fiksturene fra før opplasting fantes mangler feltet.
    expect(isOwnDocument(source({}))).toBe(false);
  });

  test('et filnavn som ligner et korpusdokument er fortsatt ditt', () => {
    const own = source({
      origin: 'user',
      title: 'Årsrapport Nasjonal kommunikasjonsmyndighet 2025',
    });
    expect(isOwnDocument(own)).toBe(true);
  });
});

describe('documentSubtitle', () => {
  test('et opplastet dokument sier at det er ditt', () => {
    expect(documentSubtitle(source({ origin: 'user' }))).toBe(OWN_DOCUMENT_LABEL);
  });

  test('et opplastet dokument sier det selv om det hadde hatt metadata', () => {
    // Mocken setter dem ikke, men en fremtidig backend kan komme til å gjøre
    // det. «Ditt dokument» er da fortsatt det viktigste å si.
    const own = source({ origin: 'user', documentType: 'Årsrapport', year: 2025 });
    expect(documentSubtitle(own)).toBe(OWN_DOCUMENT_LABEL);
  });

  test('et korpusdokument sier type, virksomhet og år', () => {
    const corpus = source({
      documentType: 'Årsrapport',
      organisation: 'Nasjonal kommunikasjonsmyndighet',
      year: 2025,
    });
    expect(documentSubtitle(corpus)).toBe('Årsrapport · Nasjonal kommunikasjonsmyndighet · 2025');
  });

  test('et korpusdokument uten metadata får ingen undertittel', () => {
    expect(documentSubtitle(source({}))).toBe('');
  });
});

describe('corpusKeyFor', () => {
  test('svarets korpus vinner over det valgte', () => {
    // Saken KA CC målte: en gammel Kudos-tråd åpnet mens Wikipedia er valgt.
    expect(corpusKeyFor('kudos-pilot', 'norquad-docs')).toBe('kudos-pilot');
  });

  test('det valgte brukes bare når svaret ikke sier noe', () => {
    expect(corpusKeyFor(undefined, 'norquad-docs')).toBe('norquad-docs');
  });

  test('vet ingen av dem noe, sier den det', () => {
    // `corpusDisplayNameFor` gjør undefined om til «standardkorpuset».
    expect(corpusKeyFor(undefined, undefined)).toBeUndefined();
  });
});
