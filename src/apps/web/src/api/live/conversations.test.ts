import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  agentIdFromToolName,
  citationCountIn,
  filterFromMessages,
  messagesFromApi,
  sourcesFromChunks,
  threadDetailFrom,
  threadFromConversation,
  type ApiConversation,
  type ApiMessage,
} from './conversations';

/**
 * A real response, recorded off the running stack on 2026-09-16.
 *
 * `GET /api/conversations/:id` after one live turn against `norquad-docs`.
 * The answer is kept whole, and that is not laziness: it was trimmed at first,
 * and the trim cut away three of its four `[n]` markers — the very thing the
 * count below is about. A fixture shortened past the property under test
 * measures nothing. Recorded rather than invented, because
 * every surprise in it is a thing the mapping has to survive and none of them
 * were in the route's name: the system prompt stored as a message, `created`
 * as epoch milliseconds, and — the one that decides what the sources panel
 * can show — `chunks: []` on an answer that had just retrieved five of them.
 */
const RECORDED = {
  conversation: {
    id: '5G7i1YoIdX432vrCDLrwk',
    topic: 'Prøvetråd fra 5k',
    agentId: 'builtin/agent-rag-agent',
    userId: 'ka-test-5k',
    tags: [],
    created: 1789543530940,
  },
  messages: [
    {
      id: 'ZSWJWJ_kRkX8FqPkqFNdo',
      text: 'You are a helpful assistant.',
      role: 'system',
      created: 1789543530940,
      tags: [],
      filterValue: null,
      chunks: [],
    },
    {
      id: 'T59ekArTAWZFtR6EeodCc',
      text: 'Hva er Norge kjent for?',
      role: 'user',
      created: 1789543552826,
      tags: [],
      filterValue: null,
      chunks: [],
    },
    {
      id: 'J6R-1phfYTQ0-kKZkyveD',
      text: 'Norge er blant annet kjent for:\n\n- En lang kyst mot Nordsjøen, Norskehavet og Barentshavet, samt store fiskefelter og petroleumsforekomster på kontinentalsokkelen. [2]  \n- Olje- og gassvirksomhet i Nordsjøen, særlig etter funnet av Ekofiskfeltet i 1969. Gassproduksjonen har økt, mens oljeproduksjonen nådde toppen i 2000 og deretter har hatt en nedadgående trend. [3]  \n- Vannkraft og et deregulert kraftmarked, med handel gjennom den nordiske kraftbørsen Nord Pool. [4]  \n- Store verneområder: 17 % av hovedlandets areal og 65 % av Svalbard var vernet, ifølge tall fra 2018. [2]  \n- Et langt og smalt hovedland på Den skandinaviske halvøya, med grense mot Sverige, Finland og Russland. [2]  \n- Et navn med gammel historie: «Norge» kan trolig rekonstrueres som *Norðrvegr*, «veien mot nord», og var opprinnelig navn på skipsleia langs vestkysten. [1]',
      role: 'assistant',
      created: 1789543570840,
      tags: [],
      filterValue: null,
      chunks: [],
    },
  ],
} as { conversation: ApiConversation; messages: ApiMessage[] };

describe('agentIdFromToolName', () => {
  it('gjør verktøynavnet om til agent-id-en', () => {
    // Samme agent, to skrivemåter, og bare én virker hvert sted. Målt på tre
    // agenter mot den lokale stakken; verktøynavnet gir «Agent not found».
    expect(agentIdFromToolName('builtin.agent-rag-agent__agent-rag-graph-bundled')).toBe(
      'builtin/agent-rag-agent',
    );
    expect(agentIdFromToolName('digdir.altinn-docs-tuned__agent-rag-graph-faithful')).toBe(
      'digdir/altinn-docs-tuned',
    );
    expect(agentIdFromToolName('builtin.ai-overview-agent__ai-overview')).toBe(
      'builtin/ai-overview-agent',
    );
  });

  it('lar et navn uten skillegraf være', () => {
    expect(agentIdFromToolName('builtin.agent-rag-agent')).toBe('builtin/agent-rag-agent');
  });
});

describe('threadFromConversation', () => {
  it('gjør epoke-millisekunder om til ISO', () => {
    const thread = threadFromConversation(RECORDED.conversation);

    expect(thread.id).toBe('5G7i1YoIdX432vrCDLrwk');
    expect(thread.title).toBe('Prøvetråd fra 5k');
    expect(Date.parse(thread.createdAt)).not.toBeNaN();
    expect(thread.conversationId).toBe(thread.id);
  });

  it('setter updatedAt lik createdAt, fordi det er alt som finnes', () => {
    /*
     * Samtalen har `created` og ingenting som flytter seg når en tur legges
     * til. Trådlista grupperer på `updatedAt`, så en samtale besvart i dag
     * men startet forrige måned havner under forrige måned. Det er et hull i
     * backenden; et gjettet tidspunkt ville plassert rader like galt uten å
     * si fra.
     */
    const thread = threadFromConversation(RECORDED.conversation);
    expect(thread.updatedAt).toBe(thread.createdAt);
  });

  it('gir en samtale uten emne et navn likevel', () => {
    expect(threadFromConversation({ id: 'x', topic: '  ' }).title).toBe('Uten tittel');
  });

  it('leser korpuset tråden ble startet i, ut av taggene', () => {
    // Skrevet av `#createConversation` da tråden ble laget. Målt mot den
    // kjørende stacken 21.09: backend tar imot `tags` og gir dem tilbake på
    // både liste og enkeltoppslag, så en tråd lest på en annen maskin vet
    // fortsatt hvilket korpus den hører til.
    const thread = threadFromConversation({ id: 'x', tags: ['corpus:kudos-pilot'] });
    expect(thread.corpusKey).toBe('kudos-pilot');
  });

  it('lar corpusKey være usatt for en tråd fra før det fantes et valg', () => {
    // Ikke satt til det som er valgt nå: et korpus er et faktum om når
    // tråden ble spurt, ikke om hva leseren har valgt i dag.
    expect(threadFromConversation({ id: 'x' }).corpusKey).toBeUndefined();
    expect(threadFromConversation({ id: 'x', tags: [] }).corpusKey).toBeUndefined();
    expect(threadFromConversation({ id: 'x', tags: ['viktig'] }).corpusKey).toBeUndefined();
  });
});

describe('messagesFromApi', () => {
  it('lar systemmeldingen ligge', () => {
    // Stakken skriver «You are a helpful assistant.» som første melding i
    // hver samtale. Det er ledeteksten, ikke noe noen har sagt.
    const turns = messagesFromApi(RECORDED.messages);

    expect(turns.map((turn) => turn.role)).toEqual(['user', 'assistant']);
    expect(turns.some((turn) => turn.content.includes('helpful assistant'))).toBe(false);
  });

  it('tar med spørsmålet og svaret slik de ble lagret', () => {
    const [question, answer] = messagesFromApi(RECORDED.messages);

    expect(question?.content).toBe('Hva er Norge kjent for?');
    expect(answer?.content.startsWith('Norge er blant annet kjent for')).toBe(true);
    expect(Date.parse(answer!.createdAt)).not.toBeNaN();
  });

  it('gir svaret et markørtall og spørsmålet ingen', () => {
    // Bare et svar siterer. Et spørsmål med klammer i er et spørsmål med
    // klammer i.
    const [question, answer] = messagesFromApi(RECORDED.messages);

    expect(answer?.citationCount).toBe(4);
    expect(question?.citationCount).toBeUndefined();
    // Og siteringene er tomme, fordi ingen utdrag ble lagret. Det er nettopp
    // de to som kommer fra hverandre her.
    expect(answer?.citations).toEqual([]);
  });

  it('dropper en tur uten tekst', () => {
    // En tur som feilet lar en tom melding ligge igjen, og en tom boble midt
    // i en samtale leses som en tegnefeil.
    expect(messagesFromApi([{ id: 'a', role: 'assistant', text: '   ' }])).toHaveLength(0);
  });

  it('tegner backendens egen feilsetning som en mislykket tur, ikke som svaret', () => {
    // The backend stores that sentence as the assistant's message, so it comes
    // back with the conversation looking exactly like an answer. Measured
    // 2026-09-29 after a reader reloaded mid-stream.
    // See digdir/digdir-headless-rag#22.
    const [answer] = messagesFromApi([
      {
        id: 'a',
        role: 'assistant',
        text: 'LLM request failed at iteration 2: Interceptor Exception: ',
        chunks: [
          { chunkId: 'c1', docNum: '1', docTitle: 'Tildelingsbrev', contentMarkdown: 'tekst' },
        ],
      },
    ]);

    expect(answer?.status).toBe('error');
    expect(answer?.content).toBe('');
    expect(answer?.citations).toEqual([]);
    expect(answer?.citationCount).toBeUndefined();
    expect(answer?.sources).toBeUndefined();
  });

  it('lar et svar som SITERER feilsetningen midt i teksten, stå', () => {
    // The pattern is anchored on purpose. Without `^`, an answer that reports
    // what the service said would be hidden as a failure, and the reader would
    // lose a real answer (KA CC on #182).
    const [answer] = messagesFromApi([
      {
        id: 'a',
        role: 'assistant',
        text: 'Loggen viser at LLM request failed at iteration 2 er den vanligste feilen [1].',
      },
    ]);

    expect(answer?.status).toBe('complete');
    expect(answer?.content).toContain('LLM request failed');
  });

  it('lar et svar stå selv om det inneholder ordene timeout og rate limit', () => {
    // The other patterns this app reads failures by are unanchored on purpose,
    // and an answer about public documents may well contain those words. A
    // wrong match here would hide a real answer.
    const [answer] = messagesFromApi([
      {
        id: 'a',
        role: 'assistant',
        text: 'Rundskrivet nevner en timeout på 30 sekunder og en rate limit [1].',
      },
    ]);

    expect(answer?.status).toBe('complete');
    expect(answer?.content).toContain('timeout');
    expect(answer?.citationCount).toBe(1);
  });
});

describe('citationCountIn', () => {
  it('teller ingen markører i en tekst uten', () => {
    expect(citationCountIn('Norge er kjent for fjell og fisk.')).toBe(0);
    expect(citationCountIn('')).toBe(0);
    expect(citationCountIn(null)).toBe(0);
  });

  it('teller én', () => {
    expect(citationCountIn('Nkom rapporterer kvartalsvis [1].')).toBe(1);
  });

  it('teller flere, også flersifrede', () => {
    expect(citationCountIn('Ett [1], to [2], tolv [12].')).toBe(3);
  });

  it('teller den samme markøren én gang', () => {
    /*
     * Tallet er «hvor mange kilder peker svaret på», ikke «hvor mange ganger
     * peker det». Det opptakede svaret skriver [2] to ganger, og det er
     * fortsatt én kilde.
     */
    expect(citationCountIn('Kysten [2]. Verneområdene [2]. Navnet [1].')).toBe(2);
  });

  it('teller markørene i det ekte svaret', () => {
    const answer = RECORDED.messages.find((message) => message.role === 'assistant');
    // Fire distinkte markører i en tekst uten ett eneste lagret utdrag. Det er
    // hele grunnen til at tomtilstanden måtte skrives om.
    expect(citationCountIn(answer?.text)).toBe(4);
  });
});

describe('sourcesFromChunks', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('sier «ingenting er kjent» når backenden ikke lagret noe', () => {
    /*
     * Dette er tilstanden backenden faktisk er i: svaret over hadde hentet
     * fem utdrag, og kom tilbake med `chunks: []`. undefined og tom liste er
     * forskjellige svar for kildepanelet — «ingenting er kjent» mot
     * «ingenting ble funnet» — og dette er det første.
     */
    const answer = messagesFromApi(RECORDED.messages).at(-1);

    expect(answer?.sources).toBeUndefined();
    expect(sourcesFromChunks([])).toBeUndefined();
    expect(sourcesFromChunks(null)).toBeUndefined();
  });

  it('grupperer utdrag per dokument og beholder nummereringen', () => {
    const documents = sourcesFromChunks([
      { chunkId: 'c1', docNum: '7', docTitle: 'Norge', contentMarkdown: 'Første utdrag' },
      { chunkId: 'c2', docNum: '7', docTitle: 'Norge', contentMarkdown: 'Andre utdrag' },
      { chunkId: 'c3', docNum: '9', docTitle: 'Nordsjøen', contentMarkdown: 'Tredje utdrag' },
    ]);

    expect(documents).toHaveLength(2);
    expect(documents?.[0]?.excerpts.map((excerpt) => excerpt.citationNumber)).toEqual([1, 2]);
    expect(documents?.[1]?.excerpts[0]?.citationNumber).toBe(3);
    // Teksten finnes her og ikke i strømmen: lagrede utdrag bærer
    // contentMarkdown, mens structuredContent.chunks bare har id og tittel.
    expect(documents?.[0]?.excerpts[0]?.text).toBe('Første utdrag');
    // Ingen adresse å sende leseren til. Panelet tegner utdraget uten lenke.
    expect(documents?.[0]?.url).toBeUndefined();
    expect(documents?.[0]?.excerpts[0]?.kudosUrl).toBeUndefined();
  });

  it('bygger lenka fra docNum for trådens korpus (issue 92)', () => {
    // En lagret bit har heller ingen adresse, bare nummeret. Malen for
    // datasettet tråden ble spurt mot, gir lenka, som i strømmen.
    vi.stubEnv('VITE_KA_DOCUMENT_URLS', 'kudos-full=https://kudos.dfo.no/documents/{doc_num}');
    const documents = sourcesFromChunks(
      [{ chunkId: 'c1', docNum: 372017, docTitle: 'Årsrapport', contentMarkdown: 'Utdrag' }],
      'kudos-full',
    );

    expect(documents?.[0]?.url).toBe('https://kudos.dfo.no/documents/372017');
    expect(documents?.[0]?.excerpts[0]?.kudosUrl).toBe('https://kudos.dfo.no/documents/372017');
  });
});

describe('lenkene i en lagret tråd', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('bruker malen til trådens korpus, ikke reserven', () => {
    // To korpus med hver sin mal, og reserven er det andre. Uten trådens
    // korpus ville lenka gått til feil sted.
    vi.stubEnv('VITE_KA_DATASET_CONFIG_KEY', 'norquad-docs');
    vi.stubEnv(
      'VITE_KA_DOCUMENT_URLS',
      'kudos-pilot=https://kudos.test/documents/{doc_num};norquad-docs=https://wiki.test/{doc_num}',
    );
    const [, answer] = messagesFromApi(
      [
        { id: 'm1', role: 'user', text: 'Hva rapporterer Nkom?' },
        {
          id: 'm2',
          role: 'assistant',
          text: 'Svar [1].',
          chunks: [{ chunkId: 'c1', docNum: 7, docTitle: 'Årsrapport', contentMarkdown: 'Utdrag' }],
        },
      ],
      'kudos-pilot',
    );

    expect(answer?.sources?.[0]?.url).toBe('https://kudos.test/documents/7');
  });
});

describe('lenkemalen som ikke er http(s)', () => {
  afterEach(() => vi.unstubAllEnvs());

  /*
   * Adressen i en lagret tråd bygges av vår egen mal, ikke av backenden, så
   * sjekken her vokter en feilkonfigurasjon og ikke en utrygg kilde. Den står
   * likevel: malen leses av miljøet, og den ene regelen for hva som kan bli
   * en `href`, gjelder uansett hvor adressen ble til (anmeldelsen av #129).
   */
  it('gir ingen lenke når malen ikke er en http(s)-adresse', () => {
    vi.stubEnv('VITE_KA_DOCUMENT_URLS', 'kudos-pilot=javascript:alert({doc_num})');
    const [, answer] = messagesFromApi(
      [
        { id: 'm1', role: 'user', text: 'Hva rapporterer Nkom?' },
        {
          id: 'm2',
          role: 'assistant',
          text: 'Svar [1].',
          chunks: [{ chunkId: 'c1', docNum: 7, docTitle: 'Årsrapport', contentMarkdown: 'Utdrag' }],
        },
      ],
      'kudos-pilot',
    );

    expect(answer?.sources?.[0]?.url).toBeUndefined();
    expect(answer?.sources?.[0]?.excerpts[0]?.kudosUrl).toBeUndefined();
    // Kilden står: den ble hentet, og utdraget er lest tilbake.
    expect(answer?.sources?.[0]?.excerpts[0]?.text).toBe('Utdrag');
  });
});

describe('threadDetailFrom', () => {
  it('lar siste tur si når tråden sist var i bruk', () => {
    // Bedre enn `created` når det finnes en tur. Lista kan ikke gjøre dette:
    // den får ingen meldinger, så bare en åpnet tråd vet det.
    const detail = threadDetailFrom(RECORDED.conversation, RECORDED.messages);
    const last = detail.messages.at(-1);

    expect(detail.messages).toHaveLength(2);
    expect(detail.updatedAt).toBe(last?.createdAt);
    expect(Date.parse(detail.updatedAt)).toBeGreaterThan(Date.parse(detail.createdAt));
  });

  it('gir en tom samtale tidspunktet den ble laget', () => {
    const detail = threadDetailFrom(RECORDED.conversation, []);
    expect(detail.updatedAt).toBe(detail.createdAt);
    expect(detail.messages).toEqual([]);
  });

  it('bærer filteret samtalen ble laget med, som låser den', () => {
    const detail = threadDetailFrom(RECORDED.conversation, [
      ...RECORDED.messages,
      { id: 'f', role: null, filterValue: { 'document-type': ['Årsrapport'] } },
    ]);
    expect(detail.filter?.documentType).toEqual(['Årsrapport']);
  });

  it('har ikke noe filter når samtalen ble laget uten', () => {
    expect(threadDetailFrom(RECORDED.conversation, RECORDED.messages).filter).toBeUndefined();
  });
});

/**
 * Filteret en samtale ble laget med (issue 90).
 *
 * Målt mot den lokale stacken 05.10: `filter-value` på opprettelsen kommer
 * tilbake på en egen melding med `role: null`, og nøklene i kebab-case.
 * Filteret et spørsmål ble stilt med, lagres ikke: `filterValue` er null på
 * hver tur.
 */
describe('filterFromMessages', () => {
  it('leser nøklene slik backenden gir dem tilbake, i kebab-case', () => {
    const filter = filterFromMessages([
      { id: 's', role: 'system', filterValue: null },
      {
        id: 'f',
        role: null,
        filterValue: { 'document-type': ['Årsrapport'], organisation: [], year: ['2023'] },
      },
      { id: 'u', role: 'user', text: 'Hva sier rapporten?', filterValue: null },
    ]);

    expect(filter).toEqual({ documentType: ['Årsrapport'], organisation: [], year: ['2023'] });
  });

  it('leser også navnene slik vi sendte dem', () => {
    expect(
      filterFromMessages([{ id: 'f', role: null, filterValue: { documentType: ['Evaluering'] } }])
        ?.documentType,
    ).toEqual(['Evaluering']);
  });

  it('gir ingenting for et tomt filter, som ikke låser noe', () => {
    expect(
      filterFromMessages([{ id: 'f', role: null, filterValue: { 'document-type': [] } }]),
    ).toBeUndefined();
  });

  it('gir ingenting når ingen melding har et filter', () => {
    expect(filterFromMessages([{ id: 'u', role: 'user', filterValue: null }])).toBeUndefined();
    expect(filterFromMessages(undefined)).toBeUndefined();
  });

  it('hopper over det som ikke er en liste med tekst', () => {
    const filter = filterFromMessages([
      { id: 'f', role: null, filterValue: { 'document-type': ['Årsrapport', 3], year: '2023' } },
    ]);
    expect(filter).toEqual({ documentType: ['Årsrapport'], organisation: [], year: [] });
  });
});

/**
 * En tråd lest tilbake bærer korpuset sitt ned på svarene.
 *
 * Butikka lagrer ikke korpus per melding og trenger ikke det: en tråd kan
 * ikke fortsettes i et annet korpus — bytte starter en ny — så alle turene i
 * den ble hentet fra det samme. Uten stempelet her ville et gjenopprettet
 * svar lånt korpusnavnet fra velgeren i stedet (KA CC på #129).
 */
describe('korpuset på en tur lest tilbake', () => {
  const tagged: ApiConversation = { ...RECORDED.conversation, tags: ['corpus:kudos-pilot'] };

  it('stempler svarene med trådens korpus', () => {
    const detail = threadDetailFrom(tagged, RECORDED.messages);
    const answer = detail.messages.find((message) => message.role === 'assistant');

    expect(detail.corpusKey).toBe('kudos-pilot');
    expect(answer?.corpusKey).toBe('kudos-pilot');
  });

  it('lar spørsmålet være uten, for det ble ikke hentet noe sted', () => {
    const detail = threadDetailFrom(tagged, RECORDED.messages);
    const question = detail.messages.find((message) => message.role === 'user');

    expect(question?.corpusKey).toBeUndefined();
  });

  it('stempler ingenting når tråden ikke bærer noe merke', () => {
    // Hver tråd fra før det fantes et valg. «Ikke kjent» er svaret, og et
    // gjettet korpus ville vært verre enn ingen.
    const detail = threadDetailFrom(RECORDED.conversation, RECORDED.messages);

    for (const message of detail.messages) expect(message.corpusKey).toBeUndefined();
  });

  it('gir messagesFromApi nøkkelen direkte, uten en samtale rundt', () => {
    const turns = messagesFromApi(RECORDED.messages, 'norquad-docs');

    expect(turns.find((turn) => turn.role === 'assistant')?.corpusKey).toBe('norquad-docs');
  });
});

describe('messagesFromApi, et forsøk som ble prøvd på nytt', () => {
  const question = (id: string, text = 'Hva skriver Nkom om måloppnåelse?'): ApiMessage => ({
    id,
    role: 'user',
    text,
  });
  const answer = (id: string, text: string): ApiMessage => ({ id, role: 'assistant', text });
  const shape = (messages: ApiMessage[]) =>
    messagesFromApi(messages).map((message) => `${message.role}:${message.status}`);

  it('tar ut forsøket som feilet når det samme spørsmålet kom rett etter', () => {
    expect(
      shape([
        question('q1'),
        answer('a1', 'LLM request failed at iteration 4: Interceptor Exception: '),
        question('q2'),
        answer('a2', 'Nkom skriver at målene er nådd.'),
      ]),
    ).toEqual(['user:complete', 'assistant:complete']);
  });

  it('tar ut et spørsmål som ikke fikk noe svar lagret, når det ble stilt igjen', () => {
    expect(
      shape([question('q1'), question('q2'), answer('a2', 'Nkom skriver at målene er nådd.')]),
    ).toEqual(['user:complete', 'assistant:complete']);
  });

  it('lar et forsøk som feilet stå når ingen prøvde igjen', () => {
    expect(
      shape([
        question('q1'),
        answer('a1', 'LLM request failed at iteration 4: Interceptor Exception: '),
      ]),
    ).toEqual(['user:complete', 'assistant:error']);
  });

  it('lar det samme spørsmålet stå to ganger når begge fikk svar', () => {
    expect(
      shape([
        question('q1'),
        answer('a1', 'Første svar.'),
        question('q2'),
        answer('a2', 'Andre svar.'),
      ]),
    ).toEqual(['user:complete', 'assistant:complete', 'user:complete', 'assistant:complete']);
  });

  it('lar et forsøk som feilet stå når det neste spørsmålet er et annet', () => {
    expect(
      shape([
        question('q1'),
        answer('a1', 'LLM request failed at iteration 4: Interceptor Exception: '),
        question('q2', 'Og i 2023?'),
        answer('a2', 'I 2023 …'),
      ]),
    ).toEqual(['user:complete', 'assistant:error', 'user:complete', 'assistant:complete']);
  });
});
