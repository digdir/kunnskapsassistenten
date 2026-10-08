import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyFilterSelection } from '../../model';
import type { FilterSelection, StreamEvent } from '../../model';
import { LiveChatClient, resetLiveConversation } from './LiveChatClient';

/**
 * What the client actually puts on the wire.
 *
 * `datasetArguments` is tested on its own in mcp.test.ts; what is in question
 * here is that the result reaches the `tools/call` arguments beside the query,
 * which is the only place the backend looks for it.
 */
function captureRequest() {
  const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Runs one question to completion and hands back the parsed request body. */
async function askAndReadBody(
  client: LiveChatClient,
  fetchMock: ReturnType<typeof vi.fn>,
  filters?: FilterSelection,
) {
  // The stubbed 503 makes `ask` yield one error event and stop, which is all
  // this needs: the request has already been built by then.
  for await (const _event of client.ask({ query: 'Hva rapporterer Nkom?', filters })) {
    // drained on purpose
  }
  /*
   * Found by address and not by position. A first turn now makes the
   * conversation before it asks — see `#createConversation` — so the tool
   * call is the second request, and it would be the first again the day that
   * `POST` is dropped or moved. What this test is about is what reaches
   * `tools/call`, so that is what it looks for.
   */
  const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/mcp'));
  const init = call?.[1] as RequestInit;
  return JSON.parse(String(init.body)) as {
    params: { arguments: Record<string, unknown> };
  };
}

/**
 * Filtervalget, hele veien ut på tråden.
 *
 * Oversettelsen selv er målt i mcp.test.ts. Det som er spørsmålet her er at
 * resultatet når `tools/call`-argumentene, ved siden av spørsmålet og
 * datasettet, og at feltnavna kommer fra datasettet som faktisk spørres.
 */
describe('LiveChatClient og filtervalg', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** En klient som kjenner feltnavna til ett datasett, og bare det. */
  function clientWithKudosFields(datasetConfigKey: string | (() => string | undefined)) {
    return new LiveChatClient({
      tenant: 'kudos',
      datasetConfigKey,
      filterFields: (key) =>
        key === 'kudos-full'
          ? {
              documentType: { field: 'type' },
              year: { field: 'concerned_years', valueType: 'integer' },
            }
          : undefined,
    });
  }

  it('sender overrides.retrieve-filter-by ved siden av spørsmålet', async () => {
    const fetchMock = captureRequest();
    const client = clientWithKudosFields('kudos-full');

    const body = await askAndReadBody(client, fetchMock, {
      ...emptyFilterSelection,
      documentType: ['Årsrapport'],
      year: ['2024'],
    });

    expect(body.params.arguments).toMatchObject({
      query: 'Hva rapporterer Nkom?',
      tenant: 'kudos',
      dataset_config_key: 'kudos-full',
      overrides: {
        'retrieve-filter-by': {
          fields: [
            { field: 'type', 'selected-options': ['Årsrapport'] },
            {
              field: 'concerned_years',
              'selected-options': ['2024'],
              'value-type': 'integer',
            },
          ],
        },
      },
    });
  });

  it('sender ingen overrides når ingenting er huket av', async () => {
    const fetchMock = captureRequest();
    const client = clientWithKudosFields('kudos-full');

    const body = await askAndReadBody(client, fetchMock, emptyFilterSelection);

    expect(body.params.arguments).not.toHaveProperty('overrides');
  });

  it('sender ingen overrides når ingen filtre følger med spørsmålet', async () => {
    const fetchMock = captureRequest();
    const client = clientWithKudosFields('kudos-full');

    const body = await askAndReadBody(client, fetchMock);

    expect(body.params.arguments).not.toHaveProperty('overrides');
  });

  it('oversetter med feltnavna til korpuset som faktisk spørres', async () => {
    // Leseren bytter korpus mellom to spørsmål. Det andre korpuset har ikke
    // sagt hva det kaller dimensjonene, så filteret blir ikke sendt — i
    // stedet for å bli sendt med det forrige korpusets feltnavn.
    const fetchMock = captureRequest();
    let corpus = 'kudos-full';
    const client = clientWithKudosFields(() => corpus);
    const filters = { ...emptyFilterSelection, documentType: ['Årsrapport'] };

    const first = await askAndReadBody(client, fetchMock, filters);
    expect(first.params.arguments).toHaveProperty('overrides');

    corpus = 'norquad-docs';
    fetchMock.mockClear();
    const second = await askAndReadBody(client, fetchMock, filters);

    expect(second.params.arguments).toMatchObject({ dataset_config_key: 'norquad-docs' });
    expect(second.params.arguments).not.toHaveProperty('overrides');
  });
});

describe('LiveChatClient og datasettvalg', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sender tenant og dataset_config_key når begge er satt', async () => {
    const fetchMock = captureRequest();
    const client = new LiveChatClient({ tenant: 'demo', datasetConfigKey: 'kudos-pilot' });

    const body = await askAndReadBody(client, fetchMock);

    expect(body.params.arguments).toMatchObject({
      query: 'Hva rapporterer Nkom?',
      tenant: 'demo',
      dataset_config_key: 'kudos-pilot',
    });
  });

  it('sender ingen av dem når ingen er satt', async () => {
    const fetchMock = captureRequest();
    const client = new LiveChatClient();

    const body = await askAndReadBody(client, fetchMock);

    // Uendret oppførsel: backend velger datasett selv.
    expect(body.params.arguments).toEqual({ query: 'Hva rapporterer Nkom?' });
    expect(body.params.arguments).not.toHaveProperty('tenant');
    expect(body.params.arguments).not.toHaveProperty('dataset_config_key');
  });

  it('sender ingen av dem når bare den ene er satt', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = captureRequest();
    const client = new LiveChatClient({ datasetConfigKey: 'kudos-pilot' });

    const body = await askAndReadBody(client, fetchMock);

    expect(body.params.arguments).toEqual({ query: 'Hva rapporterer Nkom?' });
    vi.restoreAllMocks();
  });
});

/**
 * The body of the `POST /api/conversations` this turn sent, if it sent one.
 *
 * `vi.fn()` infers no argument types, so `mock.calls` comes back as empty
 * tuples; the cast is here, once, rather than at each call site. It says what
 * fetch is actually called with.
 */
function createdConversationBody(
  fetchMock: ReturnType<typeof vi.fn>,
): { tags?: string[] } | undefined {
  const calls = fetchMock.mock.calls as unknown as [unknown, RequestInit | undefined][];
  const created = calls.find(
    ([url, init]) => String(url).endsWith('/conversations') && init?.method === 'POST',
  );
  const body = created?.[1]?.body;
  return body === undefined ? undefined : (JSON.parse(String(body)) as { tags?: string[] });
}

describe('korpuset leseren har valgt, per spørsmål', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('leser valget på nytt for hvert spørsmål', async () => {
    // Hele poenget med at korpus er et kjøretidsvalg. Klienten bygges én gang
    // av `createChatClient()`, så en verdi løst i konstruktøren ville bundet
    // appen til det som var valgt ved oppstart — og et bytte ville ikke nådd
    // backend før sida ble lastet på nytt.
    let valgt = 'norquad-docs';
    const fetchMock = captureRequest();
    const client = new LiveChatClient({ tenant: 'demo', datasetConfigKey: () => valgt });

    const first = await askAndReadBody(client, fetchMock);
    expect(first.params.arguments).toMatchObject({ dataset_config_key: 'norquad-docs' });

    valgt = 'kudos-pilot';
    fetchMock.mockClear();
    const second = await askAndReadBody(client, fetchMock);
    expect(second.params.arguments).toMatchObject({ dataset_config_key: 'kudos-pilot' });
  });

  it('merker den nye tråden med korpuset den ble startet i', async () => {
    // Tråden bindes til korpuset sitt: svarene i den siterer dokumenter som
    // bare finnes der. Målt mot den kjørende stacken 21.09 at backend tar
    // imot `tags` på POST og gir dem tilbake på både liste og enkeltoppslag.
    const fetchMock = captureRequest();
    const client = new LiveChatClient({ tenant: 'demo', datasetConfigKey: () => 'kudos-pilot' });

    await askAndReadBody(client, fetchMock);

    const body = createdConversationBody(fetchMock);
    expect(body?.tags).toEqual(['corpus:kudos-pilot']);
  });

  it('merker ingenting når det ikke er noe korpus å merke med', async () => {
    // Uten tenant faller `datasetArguments` tilbake til ingenting, og da er
    // det ingen nøkkel å skrive på tråden heller. En tom `corpus:`-tagg ville
    // vært verre enn ingen: den ville sett ut som et korpus som het tomt.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = captureRequest();
    const client = new LiveChatClient({ datasetConfigKey: () => 'kudos-pilot' });

    await askAndReadBody(client, fetchMock);

    const body = createdConversationBody(fetchMock);
    expect(body?.tags).toBeUndefined();
    vi.restoreAllMocks();
  });

  it('spør og merker med det samme korpuset, selv om valget endres underveis', async () => {
    // Nøkkelen løses én gang per spørsmål og brukes til begge kallene. To
    // oppslag kunne vært uenige, og en tråd som søkte i ett korpus men ble
    // arkivert under et annet er en tråd der kildene ikke stemmer med
    // merkelappen.
    let valgt = 'norquad-docs';
    const fetchMock = vi.fn(async (url: unknown) => {
      // Byttet skjer mellom de to kallene, som er det verste tilfellet.
      if (String(url).endsWith('/conversations')) valgt = 'kudos-pilot';
      return new Response(null, { status: 503 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new LiveChatClient({ tenant: 'demo', datasetConfigKey: () => valgt });
    const body = await askAndReadBody(client, fetchMock);

    const createdBody = createdConversationBody(fetchMock);

    expect(createdBody?.tags).toEqual(['corpus:norquad-docs']);
    expect(body.params.arguments).toMatchObject({ dataset_config_key: 'norquad-docs' });
  });
});

/**
 * A finished answer as the server sends it: one SSE frame carrying the
 * `tools/call` result. `_meta.status` is the field under test.
 */
function finalFrame(meta: Record<string, unknown>): Response {
  const body = {
    result: {
      content: [{ type: 'text', text: 'Svar.' }],
      structuredContent: { chunks: [] },
      _meta: meta,
    },
  };
  return new Response(`data: ${JSON.stringify(body)}\n\n`, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

async function askWith(meta: Record<string, unknown>): Promise<StreamEvent[]> {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => finalFrame(meta)),
  );
  const events: StreamEvent[] = [];
  for await (const event of new LiveChatClient().ask({ query: 'Hva rapporterer Nkom?' })) {
    events.push(event);
  }
  return events;
}

describe('LiveChatClient og needs-clarification', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('leser statusen agenten sender i _meta', async () => {
    const events = await askWith({ conversation_id: 'c1', status: 'needs-clarification' });

    expect(events.at(-1)).toMatchObject({
      type: 'done',
      conversationId: 'c1',
      outcome: 'needs-clarification',
    });
  });

  it('lar et vanlig svar være uten outcome', async () => {
    // Fraværende betyr «complete». Et svar som alltid bar feltet ville tvunget
    // hver leser til å håndtere det.
    const events = await askWith({ conversation_id: 'c1', status: 'complete' });

    expect(events.at(-1)).toMatchObject({ type: 'done' });
    expect(events.at(-1)).not.toHaveProperty('outcome');
  });

  it('finner seg i at feltet mangler helt', async () => {
    const events = await askWith({ conversation_id: 'c1' });
    expect(events.at(-1)).not.toHaveProperty('outcome');
  });
});

/** Runs one question against a stubbed `fetch` and collects what comes out. */
async function askAgainst(response: () => Response | Promise<Response>): Promise<StreamEvent[]> {
  vi.stubGlobal('fetch', vi.fn(response));
  const events: StreamEvent[] = [];
  for await (const event of new LiveChatClient().ask({ query: 'Hva rapporterer Nkom?' })) {
    events.push(event);
  }
  return events;
}

/** One SSE frame with whatever payload the test wants to send. */
function frameWith(payload: unknown): Response {
  return new Response(`data: ${JSON.stringify(payload)}\n\n`, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function errorOf(events: StreamEvent[]) {
  const last = events.at(-1);
  return last?.type === 'error' ? last.error : undefined;
}

describe('LiveChatClient og feilkoder', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('leser det statuskoden faktisk slår fast', async () => {
    for (const [status, code] of [
      [401, 'unauthorized'],
      [403, 'unauthorized'],
      [408, 'timeout'],
      [504, 'timeout'],
      [429, 'rate-limited'],
    ] as const) {
      const events = await askAgainst(() => new Response(null, { status }));
      expect(errorOf(events)?.code, String(status)).toBe(code);
      vi.unstubAllGlobals();
    }
  });

  it('gjetter ikke modell mot korpus på en 5xx', async () => {
    const events = await askAgainst(() => new Response(null, { status: 503 }));

    // «Språkmodellen svarer ikke» og «korpuset er nede» ber brukeren om hver
    // sin ting, og statuskoden sier ikke hvilken det var. A16 er bestillingen
    // som skal gjøre den forskjellen mulig.
    expect(errorOf(events)?.code).toBe('unknown');
    expect(errorOf(events)?.message).toContain('503');
  });

  it('sier at kontakten manglet når fetch aldri kom fram', async () => {
    const events = await askAgainst(() => {
      throw new TypeError('Failed to fetch');
    });

    expect(errorOf(events)).toEqual({
      code: 'unknown',
      message: 'Fikk ikke kontakt med tjenesten.',
    });
  });

  it('leser error.code fra backend når den kommer', async () => {
    const events = await askAgainst(() =>
      frameWith({
        error: { message: 'Søket svarte ikke.', data: { code: 'retrieval-unavailable' } },
      }),
    );

    expect(errorOf(events)?.code).toBe('retrieval-unavailable');
  });

  it('sier hva som må endres når backenden avviser filteret', async () => {
    // The frame headless-rag main 1c65865 sends for 101 values in one field,
    // with the progressToken this client sets. Measured 5.10 against :8093.
    const events = await askAgainst(() =>
      frameWith({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32602,
          message: 'Invalid `retrieve-filter-by`: A filter field takes at most 100 options.',
          data: { code: 'invalid_overrides' },
        },
      }),
    );

    expect(errorOf(events)).toEqual({
      code: 'filter-refused',
      message: 'Filteret har mer enn 100 verdier valgt i ett felt. Velg høyst 100, eller alle.',
    });
  });

  it('tar en ukjent kode som unknown i stedet for å krasje', async () => {
    const events = await askAgainst(() =>
      frameWith({ error: { message: 'Noe nytt.', data: { code: 'kvote-brukt-opp' } } }),
    );

    expect(errorOf(events)).toEqual({ code: 'unknown' });
  });

  // Backendens egen tekst, fra agent-løkka og strømvakten i digdir-headless-rag.
  const streamStall =
    'LLM request failed at iteration 2: LLM streaming: no event received for 30000ms. ' +
    'The provider stream stalled, or ended without a [DONE] terminator. ' +
    'Raise LLM_STREAM_IDLE_TIMEOUT_MS if a healthy stream legitimately pauses this long.';

  it('viser ikke teksten i en JSON-RPC-feil, men leser den for kode', async () => {
    const events = await askAgainst(() =>
      frameWith({ jsonrpc: '2.0', id: 1, error: { code: -32603, message: streamStall } }),
    );

    expect(errorOf(events)).toEqual({ code: 'model-unavailable' });
    expect(console.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ text: streamStall }),
    );
  });

  it('viser ikke agentens tekst når verktøyet feilet, men leser den for kode', async () => {
    const events = await askAgainst(() =>
      frameWith({
        jsonrpc: '2.0',
        id: 1,
        result: {
          isError: true,
          content: [{ type: 'text', text: streamStall }],
          _meta: { conversation_id: 'c1', status: 'error' },
        },
      }),
    );

    expect(errorOf(events)).toEqual({ code: 'model-unavailable' });
  });

  it('leser backendens egen kode i _meta.code når verktøyet feilet', async () => {
    // Uten tekst: backendens tekst for denne koden gir samme svar alene, og da
    // ville testen stått grønn om _meta.code ikke ble lest.
    const events = await askAgainst(() =>
      frameWith({
        jsonrpc: '2.0',
        id: 1,
        result: { isError: true, content: [], _meta: { code: 'dataset_not_authorized' } },
      }),
    );

    expect(errorOf(events)).toEqual({ code: 'unauthorized' });
  });

  it('melder tomt søk med tomt svar som no-hits', async () => {
    const events = await askAgainst(() =>
      frameWith({ result: { content: [], structuredContent: { chunks: [] }, _meta: {} } }),
    );

    // Ikke en feil: agenten søkte og fant ingenting, som er et svar med tom
    // kildeliste. Ingen `sources` og ingen `done`, for chatten gjør denne om
    // til en ferdig tur selv.
    expect(errorOf(events)).toEqual({ code: 'no-hits' });
  });

  it('lar et svar uten kilder være et svar', async () => {
    const events = await askAgainst(() =>
      frameWith({
        result: {
          content: [{ type: 'text', text: 'Dette står i ingen av dokumentene.' }],
          structuredContent: { chunks: [] },
          _meta: {},
        },
      }),
    );

    // Tekst uten utdrag er fortsatt et svar. Bare begge deler tomme er
    // «fant ingenting».
    expect(events.map((event) => event.type)).toEqual(['token', 'sources', 'done']);
  });
});

/**
 * Hvilket korpus som svarte, rapportert av klienten.
 *
 * Klienten er det eneste som vet hva som gikk på tråden: nøkkelen løses én
 * gang per spørsmål, og den som skriver turen ned skal ikke måtte lese
 * butikka en gang til og risikere et annet svar (KA CC på #129).
 */
async function askForCorpus(
  options: { tenant?: string; datasetConfigKey?: string },
  response: () => Response,
): Promise<StreamEvent[]> {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response()),
  );
  const events: StreamEvent[] = [];
  for await (const event of new LiveChatClient(options).ask({ query: 'Hva rapporterer Nkom?' })) {
    events.push(event);
  }
  return events;
}

function endOf(events: StreamEvent[]): Extract<StreamEvent, { type: 'done' | 'error' }> {
  const last = events.at(-1);
  if (last?.type !== 'done' && last?.type !== 'error') {
    throw new Error(`Strømmen endte på ${String(last?.type)}, ikke på done eller error.`);
  }
  return last;
}

describe('korpuset svaret ble hentet fra', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('står på done-ramma, lik nøkkelen kallet bar', async () => {
    const events = await askForCorpus({ tenant: 'demo', datasetConfigKey: 'kudos-pilot' }, () =>
      finalFrame({}),
    );

    const end = endOf(events);
    expect(end.type).toBe('done');
    expect(end.corpusKey).toBe('kudos-pilot');
  });

  it('står på en feilramme også, for et stoppet svar blir liggende', async () => {
    const events = await askForCorpus(
      { tenant: 'demo', datasetConfigKey: 'norquad-docs' },
      () => new Response(null, { status: 503 }),
    );

    const end = endOf(events);
    expect(end.type).toBe('error');
    expect(end.corpusKey).toBe('norquad-docs');
  });

  it('sier ingenting når kallet ikke sa noe: da valgte backend selv', async () => {
    // Uten tenant utelater `datasetArguments` begge verdiene, og ingenting på
    // denne sida vet hvilket datasett backend landet på. Undefined er «ikke
    // kjent», ikke «standardkorpuset».
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const events = await askForCorpus({ datasetConfigKey: 'kudos-pilot' }, () => finalFrame({}));

    expect(endOf(events).corpusKey).toBeUndefined();
    vi.restoreAllMocks();
  });

  it('lenker kildene med malen til korpuset turen spurte, ikke reserven', async () => {
    // To korpus med hver sin mal. Reserven er det andre, så en klient som
    // glemte turens datasett, ville gitt en lenke til feil sted.
    vi.stubEnv('VITE_KA_DATASET_CONFIG_KEY', 'norquad-docs');
    vi.stubEnv(
      'VITE_KA_DOCUMENT_URLS',
      'kudos-pilot=https://kudos.test/documents/{doc_num};norquad-docs=https://wiki.test/{doc_num}',
    );
    const events = await askForCorpus({ tenant: 'demo', datasetConfigKey: 'kudos-pilot' }, () =>
      frameWith({
        result: {
          content: [{ type: 'text', text: 'Svar [1].' }],
          structuredContent: { chunks: [{ chunk_id: 'c1', doc_num: '7', title: 'Årsrapport' }] },
          _meta: {},
        },
      }),
    );

    const sources = events.find((event) => event.type === 'sources');
    expect(sources?.type === 'sources' && sources.documents[0]?.url).toBe(
      'https://kudos.test/documents/7',
    );
  });
});

/**
 * Hvem som navngir en tråd i live.
 *
 * Appen skrev `/threads/<uuid klienten fant paa>` mens `POST
 * /api/conversations` svarte med sin egen id, saa adressen navnga en samtale
 * ingen kunne aapne - heller ikke den som lagde den (brukerblikk 8).
 */
function backendCreating(id: string) {
  const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
    void init;
    if (String(url).endsWith('/conversations')) {
      return new Response(JSON.stringify({ conversation: { id } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(null, { status: 503 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const standIn = {
  id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  title: 'Hva rapporterer Nkom?',
  createdAt: '2026-09-23T08:00:00.000Z',
  updatedAt: '2026-09-23T08:00:00.000Z',
};

describe('tråden heter det backenden kaller den', () => {
  beforeEach(() => resetLiveConversation());
  afterEach(() => vi.unstubAllGlobals());

  /*
   * Filteret tråden startes med, lagret med samtalen, så den låses som bak
   * BFF-en (issue 90). Målt mot den lokale stacken 05.10: backenden
   * tar vare på `filter-value` fra opprettelsen, men ikke på filteret et
   * spørsmål stilles med.
   */
  it('lagrer filteret tråden startes med', async () => {
    const fetchMock = backendCreating('rskfhAR3otaiib3NJiKfQ');
    const client = new LiveChatClient({ tenant: 'demo', datasetConfigKey: 'kudos-pilot' });

    await client.createThread({
      ...standIn,
      filter: { documentType: ['Årsrapport'], organisation: [], year: ['2023'] },
    });

    const body = createdConversationBody(fetchMock) as { 'filter-value'?: unknown };
    expect(body['filter-value']).toEqual({
      documentType: ['Årsrapport'],
      organisation: [],
      year: ['2023'],
    });
  });

  it('lagrer ikke et tomt filter, som ikke låser noe', async () => {
    const fetchMock = backendCreating('rskfhAR3otaiib3NJiKfQ');
    const client = new LiveChatClient({ tenant: 'demo', datasetConfigKey: 'kudos-pilot' });

    await client.createThread({
      ...standIn,
      filter: { documentType: [], organisation: [], year: [] },
    });
    await client.createThread(standIn);

    const calls = fetchMock.mock.calls as unknown as [unknown, RequestInit | undefined][];
    for (const [, init] of calls) {
      expect(JSON.parse(String(init?.body ?? '{}'))).not.toHaveProperty('filter-value');
    }
  });

  it('gir tråden backendens id, ikke klientens stedfortreder', async () => {
    backendCreating('rskfhAR3otaiib3NJiKfQ');
    const client = new LiveChatClient({ tenant: 'demo', datasetConfigKey: 'kudos-pilot' });

    const real = await client.createThread(standIn);

    expect(real?.id).toBe('rskfhAR3otaiib3NJiKfQ');
    expect(real?.conversationId).toBe('rskfhAR3otaiib3NJiKfQ');
    // Alt annet er stedfortrederens: tittelen er spørsmålet leseren stilte.
    expect(real?.title).toBe('Hva rapporterer Nkom?');
  });

  it('lager ikke en samtale til når spørsmålet kommer etterpå', async () => {
    // To opprettere ville gitt to samtaler: adressen peker på den ene og
    // svaret lander i den andre.
    const fetchMock = backendCreating('rskfhAR3otaiib3NJiKfQ');
    const client = new LiveChatClient({ tenant: 'demo', datasetConfigKey: 'kudos-pilot' });

    await client.createThread(standIn);
    fetchMock.mockClear();
    const body = await askAndReadBody(client, fetchMock);

    const created = fetchMock.mock.calls.filter(
      ([url, init]) =>
        String(url).endsWith('/conversations') &&
        (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(created).toHaveLength(0);
    expect(body.params.arguments).toMatchObject({ conversation_id: 'rskfhAR3otaiib3NJiKfQ' });
  });

  it('lar et spørsmål i samme øyeblikk vente på den samme opprettelsen', async () => {
    /*
     * `createThread` og det første `ask` starter innenfor samme tikk.
     * Publiseres ikke opprettelsen før den ventes på, lager de hver sin
     * samtale — og da er adressen og svaret i hver sin.
     */
    const fetchMock = backendCreating('rskfhAR3otaiib3NJiKfQ');
    const client = new LiveChatClient({ tenant: 'demo', datasetConfigKey: 'kudos-pilot' });

    const [, body] = await Promise.all([
      client.createThread(standIn),
      askAndReadBody(client, fetchMock),
    ]);

    const created = fetchMock.mock.calls.filter(
      ([url, init]) =>
        String(url).endsWith('/conversations') &&
        (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(created).toHaveLength(1);
    expect(body.params.arguments).toMatchObject({ conversation_id: 'rskfhAR3otaiib3NJiKfQ' });
  });

  it('lar stedfortrederen stå når samtalen ikke ble laget', async () => {
    // Uendret oppførsel: `ask` prøver selv, som den gjorde før dette fantes.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    const client = new LiveChatClient({ tenant: 'demo', datasetConfigKey: 'kudos-pilot' });

    expect(await client.createThread(standIn)).toBeUndefined();
  });

  it('husker samtale-id-en på tråden, ikke tråd-id-en', async () => {
    /*
     * I live er de to den samme strengen for en tråd som finnes, og helt
     * ulike for en stedfortreder: den har en uuid backenden aldri har sett.
     * Å lese id-en ville sendt den som `conversation_id`.
     */
    const fetchMock = backendCreating('skal-ikke-lages');
    const client = new LiveChatClient({ tenant: 'demo', datasetConfigKey: 'kudos-pilot' });

    client.openThread({
      ...standIn,
      id: 'rskfhAR3otaiib3NJiKfQ',
      conversationId: 'rskfhAR3otaiib3NJiKfQ',
    });
    const body = await askAndReadBody(client, fetchMock);

    expect(body.params.arguments).toMatchObject({ conversation_id: 'rskfhAR3otaiib3NJiKfQ' });
  });

  it('glemmer samtalen når en tråd uten en åpnes', async () => {
    // En ny tråd skal ikke fortsette samtalen leseren nettopp forlot.
    const fetchMock = backendCreating('ny-samtale');
    const client = new LiveChatClient({ tenant: 'demo', datasetConfigKey: 'kudos-pilot' });

    client.openThread({ ...standIn, conversationId: 'gammel-samtale' });
    client.openThread(standIn);
    const body = await askAndReadBody(client, fetchMock);

    expect(body.params.arguments).toMatchObject({ conversation_id: 'ny-samtale' });
  });
});

/**
 * Fasettene i live, fra vår egen server (server/facets.ts). Formatet er det
 * generiske fra src/decisions/0004, det samme BFF-en svarer med, så mappingen er den samme.
 */
describe('fasettene i live', () => {
  afterEach(() => vi.unstubAllGlobals());

  const FACETS = {
    facets: [
      { field: 'type', label: 'dokumenttyper', options: [{ value: 'Årsrapport', count: 1418 }] },
      { field: 'concerned_years', label: 'år', options: [{ value: '2024', count: 1883 }] },
      // Et felt ingen dimensjon peker på, skal ikke bli en nedtrekksliste.
      { field: 'title', label: 'titler', options: [{ value: 'x', count: 1 }] },
    ],
  };

  function answering(status: number, body: unknown = FACETS) {
    const fetchMock = vi.fn(
      async (_url: unknown, _init?: RequestInit) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function client(datasetConfigKey: string | undefined, { withTenant = true } = {}) {
    return new LiveChatClient({
      tenant: withTenant ? 'kudos' : undefined,
      datasetConfigKey,
      filterFields: (key) =>
        key === 'kudos-full'
          ? {
              documentType: { field: 'type' },
              year: { field: 'concerned_years', valueType: 'integer' },
            }
          : undefined,
    });
  }

  it('spør serverens egen rute for datasettet, og tegner det som nedtrekkslister', async () => {
    const fetchMock = answering(200);

    const facets = await client('kudos-full').listFacets();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/facets?dataset=kudos-full');
    expect(facets).toEqual([
      {
        dimension: 'documentType',
        label: 'Dokumenttyper',
        values: [{ value: 'Årsrapport', label: 'Årsrapport', count: 1418 }],
      },
      {
        dimension: 'year',
        label: 'År',
        values: [{ value: '2024', label: '2024', count: 1883 }],
      },
    ]);
  });

  it('dropper antallet i en dimensjon når en annen er avgrenset', async () => {
    // Tallene gjelder hele korpuset, og er ikke svaret under et filter.
    answering(200);

    const facets = await client('kudos-full').listFacets(undefined, {
      ...emptyFilterSelection,
      year: ['2024'],
    });

    expect(facets.find((facet) => facet.dimension === 'documentType')?.values).toEqual([
      { value: 'Årsrapport', label: 'Årsrapport' },
    ]);
    // Egen dimensjon snevrer aldri inn sine egne tall.
    expect(facets.find((facet) => facet.dimension === 'year')?.values[0]?.count).toBe(1883);
  });

  it('spør ikke, og svarer ingen, uten datasettpar eller uten feltnavn', async () => {
    const fetchMock = answering(200);
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await client(undefined).listFacets()).toEqual([]);
    expect(await client('kudos-pilot').listFacets()).toEqual([]);
    // Bare datasettet, uten tenant: backend velger selv, og ingen her vet hva.
    expect(await client('kudos-full', { withTenant: false }).listFacets()).toEqual([]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warned).toHaveBeenCalled();
  });

  it('kaster når serveren ikke kan svare, så panelet kan tilby å prøve igjen', async () => {
    answering(502, { error: 'Fikk ikke hentet filtrene.' });

    await expect(client('kudos-full').listFacets()).rejects.toThrow();
  });

  it('sender avbruddet videre', async () => {
    const fetchMock = answering(200);
    const abort = new AbortController();

    await client('kudos-full').listFacets(abort.signal);

    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(abort.signal);
  });
});
