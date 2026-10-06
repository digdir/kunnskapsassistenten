import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyFilterSelection } from '../../model';
import type { DatasetFilterFields } from '../filterFields';
import {
  McpStreamState,
  datasetArguments,
  filterArguments,
  parseHeadingPath,
  relevanceFromRank,
  toCitations,
  toSourceDocuments,
} from './mcp';

describe('parseHeadingPath', () => {
  it('reads the Clojure map the server sends instead of an object', () => {
    expect(parseHeadingPath('{"Header 1" "Akershus slott og festning"}')).toBe(
      'Akershus slott og festning',
    );
  });

  it('joins a nested path', () => {
    expect(parseHeadingPath('{"Header 1" "Birkebeinerne" "Header 2" "Politisk ståsted"}')).toBe(
      'Birkebeinerne › Politisk ståsted',
    );
  });

  it('gives up quietly on nothing', () => {
    expect(parseHeadingPath(undefined)).toBeUndefined();
    expect(parseHeadingPath('{}')).toBeUndefined();
  });
});

/**
 * Overskriftsstien uten rå Markdown.
 *
 * Leseren så «Europas historie 1789–1914 › Noter## Referanser## Litteratur»
 * i kildepanelet (brukerblikk 7, funn 1). Råverdiene under er målt mot den
 * kjørende stacken 2026-09-22, `norquad-docs`, på spørsmålet «Hva var
 * bakgrunnen for første verdenskrig?» — og de avgjør hva `##` er: ikke et
 * skilletegn backend valgte, men Markdown inne i ÉN verdi, der chunkeren har
 * kjørt tre søskenoverskrifter sammen uten linjeskiftene som gjorde dem til
 * overskrifter.
 */
describe('parseHeadingPath og Markdown fra chunkeren', () => {
  const MÅLT_REN =
    '{"Header 1" "Europas historie 1789–1914", "Header 2" "Stille før stormen (1900–1914)", "Header 3" "Mot krig (1911–1914)"}';
  const MÅLT_MED_MARKØRER =
    '{"Header 1" "Europas historie 1789–1914", "Header 2" "Noter## Referanser## Litteratur"}';

  it('lar en målt verdi uten markører stå urørt', () => {
    // To av de tre målte chunkene var rene. Normaliseringen skal ikke røre
    // dem: en parentes og et tankestrek er tekst, ikke Markdown.
    expect(parseHeadingPath(MÅLT_REN)).toBe(
      'Europas historie 1789–1914 › Stille før stormen (1900–1914) › Mot krig (1911–1914)',
    );
  });

  it('deler den målte verdien med markører i ledd, uten å vise markørene', () => {
    expect(parseHeadingPath(MÅLT_MED_MARKØRER)).toBe(
      'Europas historie 1789–1914 › Noter › Referanser › Litteratur',
    );
  });

  it('stryker en innledende markør', () => {
    // Formen fra rapporten: «Bakgrunn### Navn» i én verdi, og en verdi som
    // begynner med markøren.
    expect(parseHeadingPath('{"H1" "Bakgrunn### Navn"}')).toBe('Bakgrunn › Navn');
    expect(parseHeadingPath('{"H1" "### Navn"}')).toBe('Navn');
  });

  it('trimmer leddet når markøren hadde mellomrom foran seg', () => {
    // Delingen spiser mellomrommet ETTER markøren, ikke det før: «Bakgrunn
    // ### Navn» ville ellers gitt et ledd som het «Bakgrunn » med hale.
    expect(parseHeadingPath('{"H1" "Bakgrunn ### Navn"}')).toBe('Bakgrunn › Navn');
    expect(parseHeadingPath('{"H1" "  Noter  "}')).toBe('Noter');
  });

  it('lar en emneknagg i teksten være i fred', () => {
    // Det er mellomrommet etter som skiller en overskriftsmarkør fra en
    // skigard i teksten. «Kapittel #3» er ikke to overskrifter.
    expect(parseHeadingPath('{"H1" "Kapittel #3"}')).toBe('Kapittel #3');
  });

  it('dropper et ledd som bare var en markør', () => {
    // En markør uten overskrift bak er ingenting å vise, og «###» på skjermen
    // er nøyaktig feilen dette retter.
    expect(parseHeadingPath('{"H1" "###"}')).toBeUndefined();
    expect(parseHeadingPath('{"H1" "Noter" "H2" "##"}')).toBe('Noter');
  });
});

describe('relevanceFromRank', () => {
  it('ranks by position, since the server sends no score', () => {
    expect(relevanceFromRank(0, 9)).toBe('high');
    expect(relevanceFromRank(4, 9)).toBe('medium');
    expect(relevanceFromRank(8, 9)).toBe('low');
  });
});

describe('toSourceDocuments', () => {
  afterEach(() => vi.unstubAllEnvs());

  const chunks = [
    { chunk_id: 'c1', doc_num: 'd1', title: 'Årsrapport 2022', url: null, metadata: '{"H" "Mål"}' },
    { chunk_id: 'c2', doc_num: 'd2', title: 'Årsrapport 2023', url: 'https://kudos/2023' },
    { chunk_id: 'c3', doc_num: 'd1', title: 'Årsrapport 2022', url: null },
  ];

  it('leser tittelen uansett hvilket av de tre navnene den kom under', () => {
    /*
     * Målt 21.09 og lest i backend-koden: et live `tools/call` mot
     * kudos-pilot sender `title`, lagrede meldinger fra /api/conversations
     * sender `docTitle`, og andre stier gir `doc_title`. Ingenting nedstrøms
     * kan skille «ingen tittel» fra «en tittel under et navn vi ikke leste»,
     * så alle tre leses her.
     */
    const [fraTitle, fraSnake, fraCamel] = toSourceDocuments([
      { chunk_id: 'a', doc_num: 'd1', title: 'Fra title' },
      { chunk_id: 'b', doc_num: 'd2', doc_title: 'Fra doc_title' },
      { chunk_id: 'c', doc_num: 'd3', docTitle: 'Fra docTitle' },
    ]);

    expect(fraTitle.title).toBe('Fra title');
    expect(fraSnake.title).toBe('Fra doc_title');
    expect(fraCamel.title).toBe('Fra docTitle');
  });

  it('lar title vinne når flere navn står på samme chunk', () => {
    const [document] = toSourceDocuments([
      { chunk_id: 'a', doc_num: 'd1', title: 'Fra title', doc_title: 'Fra doc_title' },
    ]);
    expect(document.title).toBe('Fra title');
  });

  it('sier «Uten tittel» når ingen av dem har noe, også når feltet er blankt', () => {
    // En tittel på «   » tegner en tom linje i kildepanelet, som leses som en
    // feil heller enn som et dokument uten navn.
    const [ingen, blank] = toSourceDocuments([
      { chunk_id: 'a', doc_num: 'd1' },
      { chunk_id: 'b', doc_num: 'd2', title: '   ', docTitle: '' },
    ]);
    expect(ingen.title).toBe('Uten tittel');
    expect(blank.title).toBe('Uten tittel');
  });

  it('groups excerpts per document and keeps the citation numbers', () => {
    const documents = toSourceDocuments(chunks);

    expect(documents.map((document) => document.id)).toEqual(['d1', 'd2']);
    expect(documents[0].excerpts.map((excerpt) => excerpt.citationNumber)).toEqual([1, 3]);
    expect(documents[1].excerpts[0].citationNumber).toBe(2);
  });

  it('reads the heading out of the metadata string', () => {
    expect(toSourceDocuments(chunks)[0].excerpts[0].heading).toBe('Mål');
  });

  it('bygger lenka fra doc_num når bitene ikke har url (Simens issue 92)', () => {
    vi.stubEnv('VITE_KA_DOCUMENT_URLS', 'kudos-full=https://kudos.dfo.no/documents/{doc_num}');
    const [document] = toSourceDocuments(
      [{ chunk_id: 'c1', doc_num: '372017', title: 'Årsrapport', url: null }],
      'kudos-full',
    );

    expect(document.url).toBe('https://kudos.dfo.no/documents/372017');
    expect(document.excerpts[0].kudosUrl).toBe('https://kudos.dfo.no/documents/372017');
  });

  it('lar en url på biten vinne over malen', () => {
    vi.stubEnv('VITE_KA_DOCUMENT_URLS', 'kudos-full=https://kudos.dfo.no/documents/{doc_num}');
    const [document] = toSourceDocuments(
      [{ chunk_id: 'c1', doc_num: '1', url: 'https://kudos/egen' }],
      'kudos-full',
    );

    expect(document.url).toBe('https://kudos/egen');
  });

  it('leaves the link out when the corpus has no URL', () => {
    const documents = toSourceDocuments(chunks);

    expect(documents[0].url).toBeUndefined();
    expect(documents[0].excerpts[0].kudosUrl).toBeUndefined();
    expect(documents[1].excerpts[0].kudosUrl).toBe('https://kudos/2023');
  });

  it('numbers citations so [n] lands on chunk n-1', () => {
    const citations = toCitations(toSourceDocuments(chunks));
    expect(citations.map((citation) => citation.number).sort()).toEqual([1, 2, 3]);
    expect(citations.find((citation) => citation.number === 2)?.documentId).toBe('d2');
  });
});

describe('McpStreamState', () => {
  it('holds a delta back until something says what it was', () => {
    const state = new McpStreamState();

    // Measured: every delta this agent streams is its own plan, and the
    // answer arrives whole in the final frame. So a delta is not an answer
    // token until nothing has claimed it.
    expect(state.progress({ event: 'response/chunk', delta: 'Nkom ' })).toEqual([]);
    expect(state.answerText).toBe('');

    state.progress({ event: 'response/chunk', delta: 'rapporterer' });
    expect(state.flushPending()).toEqual([
      { type: 'token', text: 'Nkom ' },
      { type: 'token', text: 'rapporterer' },
    ]);
    expect(state.answerText).toBe('Nkom rapporterer');
  });

  it('throws away the deltas that turned out to be the agent talking to itself', () => {
    const state = new McpStreamState();

    state.progress({ event: 'response/chunk', delta: 'Jeg vil slå opp kilder om ' });
    state.progress({ event: 'response/chunk', delta: 'birkebeinerne.' });
    const [event] = state.progress({
      event: 'agent/thinking',
      reasoning: 'Jeg vil slå opp kilder om birkebeinerne.',
    });

    if (event.type !== 'thinking-step') throw new Error('forventet et tenkesteg');
    expect(event.step.label).toBe('Jeg vil slå opp kilder om birkebeinerne.');
    expect(state.flushPending()).toEqual([]);
    expect(state.answerText).toBe('');
  });

  it('releases held-back text when the agent finalizes', () => {
    const state = new McpStreamState();

    state.progress({ event: 'response/chunk', delta: 'Svaret.' });
    const events = state.progress({ event: 'agent/finalized', iteration: 3 });

    expect(events[0]).toEqual({ type: 'token', text: 'Svaret.' });
    expect(events[1].type).toBe('thinking-step');
  });

  it('keeps every search it ran, not just the last', () => {
    const state = new McpStreamState();

    state.progress({
      event: 'agent/turn-completed',
      'tool-calls': [{ tool: 'search', args: { queries: ['birkebeinerne navn', 'Håkon'] } }],
    });
    state.progress({
      event: 'agent/turn-completed',
      'tool-calls': [{ tool: 'search', args: { queries: ['Håkon', 'hva var birkebeinerne'] } }],
    });

    expect(state.keywords).toEqual(['birkebeinerne navn', 'Håkon', 'hva var birkebeinerne']);
  });

  it('turns a search into a thinking step and keeps the search words', () => {
    const state = new McpStreamState();
    const events = state.progress({
      event: 'agent/turn-completed',
      'tool-calls': [
        { tool: 'search', args: { queries: ['måloppnåelse Nkom'] }, 'duration-ms': 41 },
      ],
    });

    expect(events).toHaveLength(1);
    const [event] = events;
    if (event.type !== 'thinking-step') throw new Error('forventet et tenkesteg');
    expect(event.step.kind).toBe('search');
    expect(event.step.queries).toEqual(['måloppnåelse Nkom']);
    expect(state.keywords).toEqual(['måloppnåelse Nkom']);
  });

  it('sees reading chunks as reading, not searching', () => {
    const state = new McpStreamState();
    const [event] = state.progress({
      event: 'agent/turn-completed',
      'tool-calls': [{ tool: 'read_chunks', args: { chunk_ids: ['c1'] } }],
    });

    if (event.type !== 'thinking-step') throw new Error('forventet et tenkesteg');
    expect(event.step.kind).toBe('read');
  });

  it('drops the frames that say nothing to a reader', () => {
    const state = new McpStreamState();
    expect(state.progress({ event: 'agent/iteration-started', iteration: 2 })).toEqual([]);
    expect(state.progress({ event: 'response/chunk' })).toEqual([]);
  });
});

describe('datasetArguments', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends nothing when nothing is configured', () => {
    // The behaviour up to now, and the one this must not disturb: no dataset
    // in the arguments means the backend chooses, which on the local stack is
    // the demo corpus.
    expect(datasetArguments(undefined, undefined)).toEqual({});
  });

  it('sends both, in the snake case the server reads', () => {
    expect(datasetArguments('demo', 'kudos-pilot')).toEqual({
      tenant: 'demo',
      dataset_config_key: 'kudos-pilot',
    });
  });

  it('sends neither when only one is set, and says so', () => {
    // The backend builds the scope with `(when (and tenant
    // dataset_config_key) ...)`, so a lone one is dropped there instead and
    // the answer comes from the default corpus. Sending it would look like it
    // did something.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(datasetArguments('demo', undefined)).toEqual({});
    expect(datasetArguments(undefined, 'kudos-pilot')).toEqual({});

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain('VITE_KA_TENANT');
  });

  it('treats an empty string as unset', () => {
    // `VITE_KA_TENANT=` in an .env file arrives as '', not as undefined, and
    // an empty tenant is not a tenant.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(datasetArguments('', '')).toEqual({});
    expect(warn).not.toHaveBeenCalled();
  });

  it('says nothing when nothing is configured', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    datasetArguments(undefined, undefined);
    expect(warn).not.toHaveBeenCalled();
  });
});

/**
 * Leserens filtervalg, i backendens eget filterformat.
 *
 * Feltnavna under er Kudos sine, og de står HER med vilje: i en test er de et
 * eksempel på en konfigurasjon, mens i `src/` ville de vært en frontend som
 * bare virker mot ett korpus (src/decisions/0004).
 */
const kudosFields: DatasetFilterFields = {
  documentType: { field: 'type' },
  organisation: { field: 'orgs_long' },
  year: { field: 'concerned_years', valueType: 'integer' },
};

describe('filterArguments', () => {
  it('oversetter én dimensjon til feltet korpuset kaller det', () => {
    expect(
      filterArguments({ ...emptyFilterSelection, documentType: ['Årsrapport'] }, kudosFields),
    ).toEqual({
      overrides: {
        'retrieve-filter-by': {
          fields: [{ field: 'type', 'selected-options': ['Årsrapport'] }],
        },
      },
    });
  });

  it('sender verditypen der konfigurasjonen gir en', () => {
    // Målt 2026-09-24: uten `value-type` gir `concerned_years = 2024` 0
    // treff. Verdien er fortsatt en streng — typen står ved siden av, den
    // skrives ikke om.
    expect(filterArguments({ ...emptyFilterSelection, year: ['2024'] }, kudosFields)).toEqual({
      overrides: {
        'retrieve-filter-by': {
          fields: [
            { field: 'concerned_years', 'selected-options': ['2024'], 'value-type': 'integer' },
          ],
        },
      },
    });
  });

  it('sender flere felt og flere verdier, i designets rekkefølge', () => {
    // Backenden AND-er felt og OR-er verdiene i ett felt. Rekkefølgen er
    // `filterDimensions` sin og ikke nøkkelrekkefølgen i objektet, så samme
    // valg gir samme forespørsel hver gang.
    const selection = {
      year: ['2023', '2024'],
      documentType: ['Årsrapport'],
      organisation: ['Digitaliseringsdirektoratet'],
    };

    const args = filterArguments(selection, kudosFields);

    expect('overrides' in args && args.overrides['retrieve-filter-by'].fields).toEqual([
      { field: 'type', 'selected-options': ['Årsrapport'] },
      { field: 'orgs_long', 'selected-options': ['Digitaliseringsdirektoratet'] },
      {
        field: 'concerned_years',
        'selected-options': ['2023', '2024'],
        'value-type': 'integer',
      },
    ]);
  });

  it('sender ingen overrides når ingenting er huket av', () => {
    // Tomt valg er «hele korpuset», ikke «et tomt filter». Et tomt override
    // ville overstyrt det datasettet selv er satt opp med.
    expect(filterArguments(emptyFilterSelection, kudosFields)).toEqual({});
    expect(filterArguments(undefined, kudosFields)).toEqual({});
  });

  it('utelater en dimensjon uten valg', () => {
    const args = filterArguments(
      { ...emptyFilterSelection, documentType: ['Årsrapport'], year: [] },
      kudosFields,
    );

    expect('overrides' in args && args.overrides['retrieve-filter-by'].fields).toHaveLength(1);
  });

  it('utelater en dimensjon korpuset ikke har sagt hva heter', () => {
    // Gjetter aldri. Et gjettet feltnavn er et filter på et felt Typesense
    // ikke har, og leseren ville sett «ingen treff» for et korpus som har
    // dokumentene.
    const args = filterArguments(
      { ...emptyFilterSelection, documentType: ['Årsrapport'], year: ['2024'] },
      { documentType: { field: 'type' } },
    );

    expect(args).toEqual({
      overrides: {
        'retrieve-filter-by': { fields: [{ field: 'type', 'selected-options': ['Årsrapport'] }] },
      },
    });
  });

  it('sender ingenting når datasettet ikke er beskrevet i det hele tatt', () => {
    expect(filterArguments({ ...emptyFilterSelection, year: ['2024'] }, undefined)).toEqual({});
    expect(filterArguments({ ...emptyFilterSelection, year: ['2024'] }, {})).toEqual({});
  });

  it('dropper en blank verdi i stedet for å filtrere på tomt', () => {
    expect(filterArguments({ ...emptyFilterSelection, documentType: ['  '] }, kudosFields)).toEqual(
      {},
    );
  });
});
