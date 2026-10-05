import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFilterFields } from './filterFields';

/**
 * Oversettelsen fra designets tre dimensjoner til korpusets feltnavn.
 *
 * Det som måles her er PARSINGA, den rene halvdelen. `filterFieldsFor` leser
 * miljøet når modulen importeres, på samme måte som det aktive korpuset i
 * corpus.ts, og kan derfor ikke leses om per test uten å nullstille moduler —
 * det står nederst, i én test som gjør nettopp det.
 *
 * Poenget med hele fila: ingen Kudos-feltnavn skal finnes i `src/`. De står i
 * testene, for det er her de hører hjemme — som et eksempel på en
 * konfigurasjon, ikke som kode appen kjører.
 */
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseFilterFields', () => {
  it('leser felt per dimensjon for ett datasett', () => {
    expect(parseFilterFields('kudos-full=documentType:type|organisation:orgs_long')).toEqual({
      'kudos-full': {
        documentType: { field: 'type' },
        organisation: { field: 'orgs_long' },
      },
    });
  });

  it('leser verditypen som tredje ledd', () => {
    // Målt av dirigenten 2026-09-24: `concerned_years = 2024` UTEN
    // value-type gir 0 treff. Typesense avviser et sitert tall på et
    // tallfelt, så heltallet er påkrevd og ikke pynt.
    expect(parseFilterFields('kudos-full=year:concerned_years:integer')).toEqual({
      'kudos-full': { year: { field: 'concerned_years', valueType: 'integer' } },
    });
  });

  it('holder datasettene fra hverandre', () => {
    const config = parseFilterFields(
      'kudos-full=documentType:type;annet-korpus=documentType:dokumenttype',
    );

    expect(config['kudos-full']).toEqual({ documentType: { field: 'type' } });
    expect(config['annet-korpus']).toEqual({ documentType: { field: 'dokumenttype' } });
  });

  it('trimmer rundt hvert ledd, så variabelen kan brytes over linjer', () => {
    expect(parseFilterFields(' kudos-full = year : concerned_years : integer ')).toEqual({
      'kudos-full': { year: { field: 'concerned_years', valueType: 'integer' } },
    });
  });

  it('er tom når variabelen ikke er satt eller er blank', () => {
    expect(parseFilterFields(undefined)).toEqual({});
    expect(parseFilterFields('')).toEqual({});
    expect(parseFilterFields('   ')).toEqual({});
  });

  it('tar med de dimensjonene som er der, og bare dem', () => {
    // Et korpus uten årstall er ikke et oppsett som er feil. Da filtreres
    // det ikke på år, og de to andre virker som før.
    const config = parseFilterFields('lite-korpus=documentType:type');

    expect(config['lite-korpus']).toEqual({ documentType: { field: 'type' } });
    expect(config['lite-korpus'].year).toBeUndefined();
  });

  it('hopper over en dimensjon den ikke kjenner', () => {
    // «documenttype» er ikke dimensjonen vår. Uten denne sjekken ville en
    // skrivefeil blitt et filter som aldri nådde backenden, og som ingen
    // kunne se at ikke virket.
    const config = parseFilterFields('kudos-full=documenttype:type|year:concerned_years');

    expect(config['kudos-full']).toEqual({ year: { field: 'concerned_years' } });
  });

  it('hopper over en dimensjon uten feltnavn', () => {
    const config = parseFilterFields('kudos-full=documentType:|year:concerned_years');

    expect(config['kudos-full']).toEqual({ year: { field: 'concerned_years' } });
  });

  it('dropper et datasett uten likhetstegn eller uten nøkkel', () => {
    const config = parseFilterFields('ingen-likhetstegn;=documentType:type;a=year:aar');

    expect(config).toEqual({ a: { year: { field: 'aar' } } });
  });

  it('dropper et datasett der alt var ugyldig, i stedet for å beholde et tomt skall', () => {
    // Et tomt skall ville fått `filterFieldsFor` til å svare med et objekt
    // som ikke oversetter noe. Fraværende og tomt betyr det samme, og da er
    // det bedre å være fraværende.
    expect(parseFilterFields('kudos-full=noesomhelst:type')).toEqual({});
  });

  it('lar den første vinne når en nøkkel eller en dimensjon står to ganger', () => {
    expect(parseFilterFields('a=year:foerste;a=year:andre')).toEqual({
      a: { year: { field: 'foerste' } },
    });
    expect(parseFilterFields('a=year:foerste|year:andre')).toEqual({
      a: { year: { field: 'foerste' } },
    });
  });

  it('sier fra om en gjentatt nøkkel og en gjentatt dimensjon', () => {
    // Kommentaren i koden lovte «høyt», og koden var taus (KA CC på #164).
    // Den andre oppføringa er den som nevnes: det er den som ikke slo inn.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    parseFilterFields('a=year:foerste;a=year:andre');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('a=year:andre');

    warn.mockClear();
    parseFilterFields('a=year:foerste|year:andre');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('year:andre');
  });

  it('dropper en verditype backenden ikke skiller på', () => {
    /*
     * `format-filter-value` i backendens rag/filters.cljc sammenligner typen
     * med den ene strengen «integer». En feilstavet «integr» avvises ikke
     * der; den leses stille som streng, Typesense får et sitert tall på et
     * tallfelt, og leseren får 0 treff på et spørsmål korpuset kan svare på.
     * Hele dimensjonen droppes, ikke bare typen: et felt uten sin `integer`
     * er nettopp det stille null-treffet.
     */
    expect(parseFilterFields('kudos-full=year:concerned_years:integr')).toEqual({});
    expect(parseFilterFields('kudos-full=year:concerned_years:Integer')).toEqual({});
  });

  it('godtar begge typene backenden faktisk skiller på', () => {
    expect(parseFilterFields('a=year:aar:integer|documentType:type:string')).toEqual({
      a: {
        year: { field: 'aar', valueType: 'integer' },
        documentType: { field: 'type', valueType: 'string' },
      },
    });
  });

  it('sier fra om verditypen den droppet, og hvilke som finnes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    parseFilterFields('kudos-full=documentType:type|year:concerned_years:integr');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('year:concerned_years:integr');
    expect(warn.mock.calls[0][0]).toContain('integer');
  });

  it('sier fra i konsollen om det den hoppet over', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    parseFilterFields('a=documenttype:type|year:aar');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('VITE_KA_FILTER_FIELDS');
    expect(warn.mock.calls[0][0]).toContain('documenttype:type');
  });

  it('sier ingenting når alt er i orden', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    parseFilterFields('a=documentType:type|organisation:orgs|year:aar:integer');

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('filterFieldsFor', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /** Modulen leses på nytt, siden den leser miljøet ved import. */
  async function withEnv(raw: string | undefined) {
    vi.resetModules();
    if (raw === undefined) vi.stubEnv('VITE_KA_FILTER_FIELDS', '');
    else vi.stubEnv('VITE_KA_FILTER_FIELDS', raw);
    return import('./filterFields');
  }

  it('gir feltene for datasettet som spørres', async () => {
    const { filterFieldsFor } = await withEnv('kudos-full=year:concerned_years:integer');

    expect(filterFieldsFor('kudos-full')).toEqual({
      year: { field: 'concerned_years', valueType: 'integer' },
    });
  });

  it('gir ingenting for et datasett ingen har beskrevet', async () => {
    const { filterFieldsFor } = await withEnv('kudos-full=year:concerned_years');

    expect(filterFieldsFor('norquad-docs')).toBeUndefined();
  });

  it('gir ingenting når datasettet er ukjent for oss', async () => {
    // Live uten tenant og datasettnøkkel: backenden velger datasett selv, og
    // ingenting på denne sida vet hvilket. Da finnes det ingen feltnavn å
    // oversette med, og gjetting er utelukket.
    const { filterFieldsFor } = await withEnv('kudos-full=year:concerned_years');

    expect(filterFieldsFor(undefined)).toBeUndefined();
  });
});
