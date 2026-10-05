import { beforeEach, describe, expect, it } from 'vitest';
import {
  emptyFilterSelection,
  type FilterSelection,
  type StreamEvent,
  type Thread,
  type ThinkingStep,
} from '../../model';
import { KICKSTARTERS } from '../../views/chat/text';
import { scriptedFor } from './conversations';
import { MOCK_CLARIFICATION_QUERY, MOCK_ERROR_QUERIES, MockChatClient } from './MockChatClient';
import { mockAnswerMarkdown, nkomThinkingSteps, threads } from './fixtures';
import { resetMockThreads } from './sessionThreads';

/** No artificial delay: the test is about order and content, not timing. */
const client = new MockChatClient({
  thinkingStepMs: 0,
  firstTokenMs: 0,
  tokenMs: 0,
  sourcesMs: 0,
  requestMs: 0,
});

async function collect(iterable: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

describe('MockChatClient og de simulerte feilene', () => {
  it('gir hvert nøkkelord sin egen kode', async () => {
    for (const [query, code] of Object.entries(MOCK_ERROR_QUERIES)) {
      const events = await collect(client.ask({ query }));
      const last = events.at(-1);

      // Etter et tenkesteg, ikke med en gang: tilstanden viewene går gjennom
      // er «et svar var på vei, og så var det ikke det».
      expect(events[0]?.type, query).toBe('thinking-step');
      // `createdAt` er når turen endte. Ramma bærer den fordi to av kodene
      // ikke er feil — en stoppet tur og «ingen treff» blir begge til et svar
      // leseren kan vise tilbake til. Se StreamEvent.
      expect(last, query).toMatchObject({ type: 'error', error: { code } });
      expect(Date.parse((last as { createdAt: string }).createdAt), query).not.toBeNaN();
    }
  });

  it('tenker på spørsmålet som faktisk ble stilt', async () => {
    /*
     * Alle seks kodene sendte `nkomThinkingSteps[0]` — «Jeg deler spørsmålet i
     * to: hvordan måloppnåelse gjøres opp, og hvor målene er satt» — så
     * «Tenkte» på en feilskjerm forklarte et spørsmål ingen hadde stilt.
     * Brukerblikk runde 3, funn 4. Feilskjermene er nettopp der feiltekstene
     * vurderes, så det sto midt i det noen skulle lese.
     */
    for (const [query, code] of Object.entries(MOCK_ERROR_QUERIES)) {
      const [first] = await collect(client.ask({ query }));

      expect(first, query).toMatchObject({ type: 'thinking-step' });
      const { step } = first as { step: ThinkingStep };

      /*
       * Etiketten er den som betyr noe: den er det panelet tegner, og det var
       * den som beskrev et annet spørsmål i detalj. `queries` bærer leserens
       * egne ord ved siden av, men ingen visning tegner dem ennå.
       */
      expect(step.label, query).not.toContain('måloppnåelse');
      expect(step.queries, query).toEqual([query]);

      /*
       * «ingen treff» er den ene koden som kan si hva som kom tilbake: søket
       * ble ferdig og fant ingenting. De andre stanset inne i steget, og
       * `error`-ramma er det som sier hvor.
       */
      if (code === 'no-hits') expect(step.detail, query).toBeDefined();
      else expect(step.detail, query).toBeUndefined();
    }
  });

  it('melder ventetiden mocken faktisk bruker, ikke et tall skrevet ved siden av', async () => {
    /*
     * Andre halvdel av funn 4. En feilet tur når aldri et første token, så
     * viewets egen klokke lukkes ikke og oppsummeringen faller tilbake på det
     * steget selv meldte: uten et tall sto det «Tenkte», der et ferdig svar
     * sier «Tenkte i 2 sekunder». Et fast tall ville gjort det verre, ikke
     * bedre — «realistic» venter 3,8 s og «fast» 0,3 s på nøyaktig det samme
     * steget, så ett tall måtte vært galt for minst én av dem.
     */
    const treig = new MockChatClient({ thinkingStepMs: 0, firstTokenMs: 4200, tokenMs: 0 });
    const [first] = await collect(treig.ask({ query: 'simuler tidsavbrudd' }));

    expect((first as { step: ThinkingStep }).step.durationMs).toBe(4200);
  });

  it('er eksakte treff, ikke ord inni et ekte spørsmål', async () => {
    // «simuler feil modell» er sitt eget spørsmål og ikke et prefiks-treff på
    // «simuler feil»; et ekte spørsmål med de samme ordene skal få et ekte svar.
    const events = await collect(client.ask({ query: 'Hva er feil i rapporten?' }));

    expect(events.map((event) => event.type)).not.toContain('error');
  });
});

describe('MockChatClient.ask', () => {
  it('streams thinking steps, then text, then sources, then done', async () => {
    const events = await collect(client.ask({ query: 'Hvordan måler Nkom måloppnåelse?' }));
    const kinds = events.map((event) => event.type);

    expect(kinds.filter((kind) => kind === 'thinking-step')).toHaveLength(nkomThinkingSteps.length);
    expect(kinds.lastIndexOf('thinking-step')).toBeLessThan(kinds.indexOf('token'));
    expect(kinds.lastIndexOf('token')).toBeLessThan(kinds.indexOf('sources'));
    expect(kinds.at(-1)).toBe('done');
    expect(kinds).not.toContain('error');
  });

  it('joins the tokens back into the answer, unchanged', async () => {
    const events = await collect(client.ask({ query: 'Nkom' }));
    const text = events
      .filter((event) => event.type === 'token')
      .map((event) => event.text)
      .join('');

    expect(text).toBe(mockAnswerMarkdown);
  });

  it('resolves every [n] in the answer to an excerpt', async () => {
    const events = await collect(client.ask({ query: 'Nkom' }));
    const sources = events.find((event) => event.type === 'sources');
    if (sources?.type !== 'sources') throw new Error('ingen kilder i strømmen');

    const markers = [...mockAnswerMarkdown.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]));
    const numbers = new Set(sources.citations.map((citation) => citation.number));

    expect(markers.length).toBeGreaterThan(0);
    for (const marker of markers) {
      expect(numbers.has(marker)).toBe(true);
    }
  });

  it('ends with an aborted error instead of throwing', async () => {
    const controller = new AbortController();
    const slow = new MockChatClient({ thinkingStepMs: 5 });
    const events: StreamEvent[] = [];

    for await (const event of slow.ask({ query: 'Nkom', signal: controller.signal })) {
      events.push(event);
      controller.abort();
    }

    expect(events.at(-1)).toMatchObject({
      type: 'error',
      // No message: the text that goes on screen belongs to the code, and a
      // stopped answer never draws an alert anyway.
      error: { code: 'aborted' },
    });
  });
});

describe('MockChatClient reads', () => {
  it('gives every thread in the list a conversation, and an unknown id nothing', async () => {
    // It used to find «a thread with messages, and one without»: the list was
    // titles, and eleven of the twelve rows opened an empty conversation.
    // There is no thread without messages left to look for — that was the
    // whole of punkt 16 på brukerreise-lista.
    const list = await client.listThreads();
    expect(list.length).toBeGreaterThan(1);

    for (const thread of list) {
      const detail = await client.getThread(thread.id);
      expect(detail?.messages.length, `tråden «${thread.title}» skal ha en samtale`).toBe(2);
    }

    expect(await client.getThread('finnes-ikke')).toBeNull();
  });

  it('gives a scripted thread its answer, with the sources behind it', async () => {
    const thread = await client.getThread('dss-regnskap');
    const answer = thread?.messages.at(-1);

    expect(thread?.title).toBe('Regnskap og bevilgning i DSS sine årsrapporter');
    expect(answer?.role).toBe('assistant');
    expect(answer?.status).toBe('complete');
    expect(answer?.sources?.length).toBeGreaterThan(0);
    expect(answer?.thinkingSteps?.length).toBeGreaterThan(0);
    expect(answer?.retrieval).toBeDefined();

    // Every `[n]` in the answer resolves to an excerpt that is actually
    // there. A thread that cites a marker with nothing behind it draws a link
    // into an empty panel.
    const markers = new Set(
      [...(answer?.content ?? '').matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1])),
    );
    const cited = new Set(answer?.citations.map((citation) => citation.number));
    expect(markers.size).toBeGreaterThan(0);
    for (const marker of markers) expect(cited.has(marker)).toBe(true);
  });

  it('keeps the turn the agent asked back on as a finished turn, not a failed one', async () => {
    const thread = await client.getThread('udir-laererspesial');
    const answer = thread?.messages.at(-1);

    expect(answer?.status).toBe('needs-clarification');
    // Nothing was retrieved, so there is nothing behind it. That is the
    // honest empty, not a missing fixture.
    expect(answer?.sources).toEqual([]);
  });

  it('returns the three filter dimensions', async () => {
    const facets = await client.listFacets();
    expect(facets.map((facet) => facet.dimension)).toEqual([
      'documentType',
      'organisation',
      'year',
    ]);
  });
});

describe('MockChatClient og avklaring', () => {
  it('svarer med et spørsmål tilbake, og sier at det er det den gjør', async () => {
    const events = await collect(client.ask({ query: MOCK_CLARIFICATION_QUERY }));
    const last = events.at(-1);

    expect(last).toMatchObject({ type: 'done', outcome: 'needs-clarification' });

    // Ingen kilder: ingenting ble hentet. En avklaring med kilder bak seg
    // ville vært noe helt annet enn en avklaring.
    expect(events.map((event) => event.type)).not.toContain('sources');
    expect(events.some((event) => event.type === 'token')).toBe(true);
  });

  it('har sitt eget tenkesteg, ikke feilstien sitt og ikke NKOM-fixturens', async () => {
    // En avklaring er ikke en tur som brøt sammen, og steget sier hvorfor den
    // spør: svaret står to steder, og å velge for leseren ville sett ut som
    // et svar. Samme resonnement som teksten, ett steg tidligere.
    const [first] = await collect(client.ask({ query: MOCK_CLARIFICATION_QUERY }));

    expect(first).toMatchObject({ type: 'thinking-step' });
    const { step } = first as { step: ThinkingStep };

    expect(step.kind).toBe('reasoning');
    expect(step.detail).toContain('tildelingsbrevene');
    // Ikke søkesteget feilstien bruker: ingenting ble søkt etter her.
    expect(step.queries).toBeUndefined();
  });

  it('bryr seg ikke om store bokstaver eller mellomrom rundt', async () => {
    const events = await collect(client.ask({ query: '  Simuler Avklaring  ' }));
    expect(events.at(-1)).toMatchObject({ outcome: 'needs-clarification' });
  });

  it('lar et vanlig spørsmål være uendret', async () => {
    const events = await collect(client.ask({ query: 'Hva rapporterer Nkom?' }));

    // Fraværende outcome betyr «complete». Et vanlig svar skal ikke begynne å
    // bære feltet bare fordi feltet finnes.
    expect(events.at(-1)).toMatchObject({ type: 'done' });
    expect(events.at(-1)).not.toHaveProperty('outcome');
  });
});

/**
/**
 * The conversation surviving a reload, decided 2026-09-15 (rolle-5h, punkt 3).
 *
 * Reise 12 and 14 in design/brukerreiser-2026-09-15.md: a question asked on
 * `/` produced an address, and the address led to an empty conversation the
 * moment the page was reloaded. A new client on the same storage is what a
 * reload is, so that is what these build.
 */
describe('MockChatClient husker samtalen', () => {
  beforeEach(() => resetMockThreads());

  const started: Thread = {
    id: 'tråd-fra-nettleseren',
    title: 'Hvordan måler Nkom måloppnåelse?',
    titleFromQuestion: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('gir samtalen tilbake på samme adresse etter en ny start', async () => {
    client.openThread(started);
    await collect(client.ask({ query: 'Hvordan måler Nkom måloppnåelse?' }));

    // A new client, the way a reload builds one. Nothing is carried over in
    // memory; everything comes back out of sessionStorage.
    const reloaded = new MockChatClient({ requestMs: 0 });
    const thread = await reloaded.getThread(started.id);

    expect(thread?.title).toBe(started.title);
    expect(thread?.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(thread?.messages[1]?.content).toBe(mockAnswerMarkdown);
    // «id, tittel, meldinger, kilder» — the sources are what the sources panel
    // draws again on the other side of the reload.
    expect(thread?.messages[1]?.sources?.length).toBeGreaterThan(0);
  });

  /**
   * Hvorfor stegene pushes til `stepsSent` på de to nye stiene.
   *
   * Feilstien og avklaringsstien lagrer ingenting selv — de ender uten
   * `done`. Det eneste stedet `stepsSent` leses er den stoppede turen: rekker
   * leseren å trykke stopp mellom tenkesteget og enden, er det den lista som
   * gir kortet sitt tenkepanel tilbake etter en oppfriskning (#82, funn 6).
   * Uten pushene ser det ut til å virke helt til noen stopper akkurat der.
   */
  async function stopEtterTenkesteget(query: string): Promise<void> {
    // Vindu nok til å rekke det: `firstTokenMs` er hele tenkefasen her.
    const sakte = new MockChatClient({ thinkingStepMs: 0, firstTokenMs: 400, tokenMs: 0 });
    const controller = new AbortController();

    try {
      for await (const event of sakte.ask({ query, signal: controller.signal })) {
        if (event.type === 'thinking-step') controller.abort();
      }
    } catch {
      // `wait` avviser med avbruddsgrunnen. Turen er lagret i generatorens
      // egen catch før det, og det er den som er under test.
    }
  }

  it('lar en stoppet feiltur beholde tenkesteget sitt', async () => {
    client.openThread(started);
    await stopEtterTenkesteget('simuler ingen treff');

    const reloaded = new MockChatClient({ requestMs: 0 });
    const answer = (await reloaded.getThread(started.id))?.messages.at(-1);

    expect(answer?.status).toBe('aborted');
    expect(answer?.thinkingSteps).toHaveLength(1);
    expect(answer?.thinkingSteps?.[0]?.label).toBe('Jeg søker i korpuset');
  });

  it('lar en stoppet avklaring beholde sitt', async () => {
    client.openThread(started);
    await stopEtterTenkesteget('simuler avklaring');

    const reloaded = new MockChatClient({ requestMs: 0 });
    const answer = (await reloaded.getThread(started.id))?.messages.at(-1);

    expect(answer?.status).toBe('aborted');
    // Avklaringens eget steg, ikke feilstien sitt.
    expect(answer?.thinkingSteps?.[0]?.label).toBe('Jeg leser spørsmålet');
  });

  it('viser den i trådlista', async () => {
    client.openThread(started);
    await collect(client.ask({ query: 'Hvordan måler Nkom måloppnåelse?' }));

    const listed = await new MockChatClient({ requestMs: 0 }).listThreads();

    expect(listed.map((thread) => thread.id)).toContain(started.id);
    // The fixtures are still there; this is added to them, not instead.
    expect(listed.length).toBe(threads.length + 1);
  });

  it('legger et oppfølgingssvar til en tråd fra fixturene, uten å skrive den av', async () => {
    const fixture = threads.find((thread) => thread.id === 'nkom-maaloppnaaelse');
    if (!fixture) throw new Error('fant ikke fixture-tråden');

    const before = await client.getThread(fixture.id);
    client.openThread(fixture);
    await collect(client.ask({ query: 'Og hva med 2024?' }));

    const after = await new MockChatClient({ requestMs: 0 }).getThread(fixture.id);

    expect(after?.messages).toHaveLength((before?.messages.length ?? 0) + 2);
    expect(after?.messages[0]?.id).toBe(before?.messages[0]?.id);
    // The follow-up moves the thread in the list's period grouping.
    expect(after?.updatedAt).not.toBe(fixture.updatedAt);
  });

  it('husker ingenting når ingen tråd er åpnet', async () => {
    await collect(client.ask({ query: 'Nkom' }));

    expect(await new MockChatClient({ requestMs: 0 }).listThreads()).toHaveLength(threads.length);
  });

  it('svarer null på en tråd ingen kjenner', async () => {
    expect(await client.getThread('finnes-ikke')).toBeNull();
  });

  /**
   * Det som blir skrevet ned må være turen som faktisk ble strømmet.
   *
   * Sammenslåingen med #37 gikk rent i git og var likevel gal her: det som
   * ble lagret sto med fikstureringens egne verdier, så en reload byttet et
   * Bufdir-svars kilder mot NKOM sine, og et filtrert svars kilder mot hele
   * det ufiltrerte settet. Ingenting fanget det.
   */
  it('husker et scriptet svar med sine egne kilder, ikke standardsvarets', async () => {
    client.openThread(started);
    await collect(client.ask({ query: dssKickstarter! }));

    const thread = await new MockChatClient({ requestMs: 0 }).getThread(started.id);
    const answer = thread?.messages[1];
    const script = scriptedFor(dssKickstarter!);

    expect(answer?.sources?.map((document) => document.id)).toEqual(
      script?.documents.map((document) => document.id),
    );
    expect(answer?.retrieval?.keywords).toEqual(script?.retrieval.keywords);
    expect(answer?.content).toBe(script?.answer);
  });

  it('husker det filteret faktisk ga, ikke hele settet', async () => {
    client.openThread(started);
    await collect(
      client.ask({
        query: dssKickstarter!,
        filters: { ...emptyFilterSelection, documentType: ['Årsrapport'] },
      }),
    );

    const thread = await new MockChatClient({ requestMs: 0 }).getThread(started.id);
    const answer = thread?.messages[1];

    expect(answer?.sources).toHaveLength(1);
    expect(answer?.citations.map((citation) => citation.number)).toEqual([1, 2]);
    expect(answer?.content).not.toContain('[3]');
  });

  it('husker en scriptet avklaring som en avklaring', async () => {
    client.openThread(started);
    await collect(client.ask({ query: clarificationKickstarter! }));

    const thread = await new MockChatClient({ requestMs: 0 }).getThread(started.id);
    const answer = thread?.messages[1];

    expect(answer?.status).toBe('needs-clarification');
    expect(answer?.sources).toBeUndefined();
  });

  it('gir hvert svar sin egen id, også to i samme millisekund', async () => {
    client.openThread(started);
    await collect(client.ask({ query: 'Nkom' }));
    await collect(client.ask({ query: 'Nkom igjen' }));

    const thread = await new MockChatClient({ requestMs: 0 }).getThread(started.id);
    const ids = thread?.messages.map((message) => message.id) ?? [];

    // Klokka alene holdt ikke: to spørsmål innenfor samme millisekund ga
    // samme id, og den lagrede tråden fikk meldinger React ikke kunne skille.
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });
});

/**
 * The filter and the scripted conversations, together.
 *
 * Eleven of the twelve questions the mock can answer are scripted, and three
 * of them are the kickstarters — the road a first-time user actually takes.
 * Until this branch met #38 none of them went through `narrowToSelection`, so
 * the filter worked on exactly one question, the unscripted NKOM answer, and
 * the «control with no effect» of reise 8 was back on the main road. KA CC
 * found it; these hold it.
 *
 * Written against the real `KICKSTARTERS` strings and not against a question
 * copied in here. The matching is deliberately loose, but it is still
 * matching: the day one of the three is reworded past the threshold, this is
 * what has to go red. A test file reaching into a view for one constant is
 * the point — nothing in `src/api/` does.
 */
const [dssKickstarter, clarificationKickstarter] = KICKSTARTERS;

function withSelection(partial: Partial<FilterSelection>): FilterSelection {
  return { ...emptyFilterSelection, ...partial };
}

function sourcesIn(events: StreamEvent[]) {
  return events.find((event) => event.type === 'sources');
}

function answerIn(events: StreamEvent[]): string {
  return events
    .filter((event) => event.type === 'token')
    .map((event) => event.text)
    .join('');
}

describe('filteret og de scriptede samtalene', () => {
  it('har en scriptet samtale bak hver kickstarter', () => {
    for (const question of KICKSTARTERS) {
      expect(scriptedFor(question), question).toBeDefined();
    }
  });

  it('lar en kickstarter uten filter beholde alle kildene sine', async () => {
    const events = await collect(client.ask({ query: dssKickstarter! }));
    const sources = sourcesIn(events);
    if (sources?.type !== 'sources') throw new Error('ingen kilder i strømmen');

    expect(sources.documents).toHaveLength(2);
    expect(sources.citations.map((citation) => citation.number)).toEqual([1, 2, 3, 4]);
    expect(answerIn(events)).toContain('[4]');
  });

  it('snevrer kildene, markørene og henvisningene til en kickstarter', async () => {
    // «Årsrapport» lar det ene av de to dokumentene stå igjen. Det andre er
    // et tildelingsbrev, og markørene som pekte inn i det må forsvinne med
    // det: en død [3] i prosaen sier «frontenden er ødelagt», ikke «det
    // dokumentet er utenfor utvalget».
    const events = await collect(
      client.ask({
        query: dssKickstarter!,
        filters: withSelection({ documentType: ['Årsrapport'] }),
      }),
    );
    const sources = sourcesIn(events);
    if (sources?.type !== 'sources') throw new Error('ingen kilder i strømmen');

    expect(sources.documents).toHaveLength(1);
    expect(sources.documents[0]?.documentType).toBe('Årsrapport');
    expect(sources.citations.map((citation) => citation.number)).toEqual([1, 2]);
    expect(sources.retrieval.documentCount).toBe(1);

    const answer = answerIn(events);
    expect(answer).toContain('[1]');
    expect(answer).not.toContain('[3]');
    expect(answer).not.toContain('[4]');
  });

  it('sender kilder med tom liste når utvalget ikke slipper noe gjennom', async () => {
    // Ikke det samme som en avklaring, og derfor ikke samme vei ut av
    // løkka: kildepanelet må få beskjed om at utvalget er tomt, ellers står
    // det igjen med forrige svars kilder.
    const events = await collect(
      client.ask({
        query: dssKickstarter!,
        filters: withSelection({ organisation: ['Virksomheten som ikke finnes'] }),
      }),
    );
    const sources = sourcesIn(events);
    if (sources?.type !== 'sources') throw new Error('kildehendelsen skal komme, også tom');

    expect(sources.documents).toHaveLength(0);
    expect(sources.citations).toHaveLength(0);
    expect(sources.retrieval.documentCount).toBe(0);
    expect(answerIn(events)).not.toContain('[1]');
  });

  it('lar en avklaring være en avklaring, også med filter på', async () => {
    // Vakten leser scriptets egen liste og ikke den filtrerte. En samtale som
    // aldri hentet noe skal hoppe over hele kildehendelsen, uansett hva som
    // står i filteret.
    const events = await collect(
      client.ask({
        query: clarificationKickstarter!,
        filters: withSelection({ documentType: ['Årsrapport'] }),
      }),
    );

    expect(sourcesIn(events)).toBeUndefined();
    expect(events.at(-1)).toMatchObject({ type: 'done', outcome: 'needs-clarification' });
  });
});

describe('markørene og kildene peker på det samme', () => {
  /*
   * Et sitatnummer ER utdragets plass i svarets flate liste, så å sette
   * leserens eget dokument først flytter hvert senere nummer — og markørene i
   * TEKSTEN må flytte med. Uten det pekte hver påstand ett dokument for
   * tidlig, og den siste kilden hadde ingen markør i det hele tatt. Funnet av
   * KA CC på #117.
   */
  async function askWithOwnDocument() {
    const { resetUserDocumentsForTest, uploadUserDocument } = await import('../userDocuments');
    const { resetUploadClientForTest } = await import('../uploadFactory');
    localStorage.clear();
    resetUserDocumentsForTest();
    resetUploadClientForTest();

    const file = new File(['x'], 'Egen rapport.pdf');
    const document = await uploadUserDocument(file);

    return collect(
      client.ask({ query: 'Hva står i dokumentet mitt?', attachments: [document.id] }),
    );
  }

  function numbersIn(markdown: string): number[] {
    return [...markdown.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]));
  }

  it('gir hver kilde en markør og hver markør en kilde', async () => {
    const events = await askWithOwnDocument();
    const sources = sourcesIn(events)!;

    const inText = new Set(numbersIn(answerIn(events)));
    const inPanel = new Set(
      sources.documents.flatMap((document) =>
        document.excerpts
          .map((excerpt) => excerpt.citationNumber)
          .filter((number): number is number => number !== undefined),
      ),
    );

    expect([...inPanel].sort((a, b) => a - b)).toEqual([...inText].sort((a, b) => a - b));
  });

  it('flytter korpusets markører like langt som numrene flyttet seg', async () => {
    // Ett vedlagt utdrag foran, så korpusets 1–5 blir 2–6.
    const events = await askWithOwnDocument();

    expect(numbersIn(answerIn(events))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('lar det vedlagte dokumentet være det markøren [1] peker på', async () => {
    const events = await askWithOwnDocument();
    const sources = sourcesIn(events)!;

    const first = sources.documents.find((document) =>
      document.excerpts.some((excerpt) => excerpt.citationNumber === 1),
    );

    expect(first?.origin).toBe('user');
    expect(first?.title).toBe('Egen rapport.pdf');
    expect(answerIn(events)).toContain('[1]');
  });

  it('lar teksten være urørt når ingenting er vedlagt', async () => {
    const events = await collect(client.ask({ query: 'Hvordan jobber Nkom med måloppnåelse?' }));

    expect(numbersIn(answerIn(events))).toEqual([1, 2, 3, 4, 5]);
    expect(answerIn(events)).toBe(mockAnswerMarkdown);
  });
});
