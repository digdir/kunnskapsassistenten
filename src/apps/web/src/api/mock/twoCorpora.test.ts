import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamEvent } from '../../model';

/**
 * Mock med to korpus, som er det som gjør korpusbytte mulig å se og måle.
 *
 * Mocken hadde ett, og en velger med én oppføring tegner ingenting — så
 * bytte kunne verken ses i mock eller måles i e2e (KA CC på #129). Det som
 * måles her er at de fire tingene som skal endre seg, faktisk endrer seg:
 * korpuslinja, fasettene, svaret og kildene.
 *
 * Modulene nullstilles per test fordi korpusbutikka løser seg selv ved
 * import, slik corpusStore.test.ts gjør det.
 */
async function withCorpus(key: string) {
  vi.stubEnv('VITE_API_MODE', 'mock');
  vi.stubEnv('VITE_KA_DATASETS', '');
  vi.stubEnv('VITE_KA_DATASET_CONFIG_KEY', '');
  vi.resetModules();

  const corpus = await import('../corpus');
  corpus.setActiveCorpusKey(key);

  const { MockChatClient, mockSpeeds } = await import('./index');
  return new MockChatClient(mockSpeeds.fast);
}

/**
 * Samler en hel strøm med falsk tid.
 *
 * Falsk tid fordi Kudos-svaret er langt: selv på `fast` bruker det mer enn
 * tålmodigheten til en testkjøring. Håndtereren festes før tida spoles, slik
 * de to opplastingshjelperne lærte oss i #122 — en avvist promise som går
 * gjennom en mikrotask uten lytter feller hele kjøringa med exit 1 mens
 * summeringslinja sier at alt bestod.
 */
async function settle<T>(work: Promise<T>): Promise<T> {
  const settled = work.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );

  await vi.runAllTimersAsync();

  const outcome = await settled;
  if ('error' in outcome) throw outcome.error;
  return outcome.value;
}

async function collect(iterable: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  await settle(
    (async () => {
      for await (const event of iterable) events.push(event);
    })(),
  );
  return events;
}

function answerIn(events: StreamEvent[]): string {
  return events
    .filter((event) => event.type === 'token')
    .map((event) => (event.type === 'token' ? event.text : ''))
    .join('');
}

function sourcesIn(events: StreamEvent[]) {
  const event = events.find((candidate) => candidate.type === 'sources');
  return event?.type === 'sources' ? event : undefined;
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('fasettene kommer fra det valgte korpuset', () => {
  it('teller Kudos-dokumenter over Kudos-korpuset', async () => {
    const client = await withCorpus('mock');
    const facets = await settle(client.listFacets());

    const types = facets.find((facet) => facet.dimension === 'documentType');
    expect(types?.values.map((value) => value.value)).toContain('Årsrapport');
  });

  it('teller artikler over Wikipedia-korpuset', async () => {
    // Åtte artikler, én dokumenttype. At fasettene blir smalere er halve
    // beviset på at byttet nådde fram.
    const client = await withCorpus('norquad-mock');
    const facets = await settle(client.listFacets());

    const types = facets.find((facet) => facet.dimension === 'documentType');
    expect(types?.values.map((value) => value.value)).toEqual(['Artikkel']);

    const organisations = facets.find((facet) => facet.dimension === 'organisation');
    expect(organisations?.values.map((value) => value.value)).toEqual(['Wikipedia']);
  });
});

describe('svaret og kildene kommer fra det valgte korpuset', () => {
  it('svarer fra Kudos over Kudos-korpuset', async () => {
    const client = await withCorpus('mock');
    const events = await collect(client.ask({ query: 'Hva rapporterer Nkom?' }));

    const titles = sourcesIn(events)?.documents.map((document) => document.title) ?? [];
    expect(titles.some((title) => title.includes('Nkom') || title.includes('Nasjonal'))).toBe(true);
  });

  it('svarer fra artiklene over Wikipedia-korpuset', async () => {
    const client = await withCorpus('norquad-mock');
    const events = await collect(client.ask({ query: 'Hva handler artiklene om?' }));

    const sources = sourcesIn(events)!;
    expect(sources.documents.map((document) => document.title)).toEqual([
      'Vinter-OL 2010',
      'Skottlands historie',
      'Nordlys',
    ]);
    expect(answerIn(events)).toContain('Artikler i dette korpuset');
  });

  it('gir ingen Kudos-lenke på en artikkel, for dokumentet er oppdiktet', async () => {
    // En lenke ville sendt leseren for å sjekke et sitat som ikke finnes.
    const client = await withCorpus('norquad-mock');
    const events = await collect(client.ask({ query: 'Hva handler artiklene om?' }));

    for (const document of sourcesIn(events)!.documents) {
      expect(document.url).toBeUndefined();
      for (const excerpt of document.excerpts) expect(excerpt.kudosUrl).toBeUndefined();
    }
  });

  it('nummererer markørene i teksten mot kildene', async () => {
    const client = await withCorpus('norquad-mock');
    const events = await collect(client.ask({ query: 'Hva handler artiklene om?' }));

    const numbers = sourcesIn(events)!
      .documents.flatMap((document) => document.excerpts)
      .map((excerpt) => excerpt.citationNumber);
    expect(numbers).toEqual([1, 2, 3]);
    for (const number of numbers) expect(answerIn(events)).toContain(`[${number}]`);
  });
});
