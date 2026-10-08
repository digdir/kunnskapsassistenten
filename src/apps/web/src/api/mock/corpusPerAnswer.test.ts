import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamEvent } from '../../model';
import type { AskParams } from '../chatClient';

/**
 * Korpuset følger svaret, i mock.
 *
 * Fraskrivelsen og kildepanelet beskrev korpuset som er valgt NÅ. Byttet
 * leseren korpus med et ferdig svar på skjermen, sto «fra Kudos» over en
 * Wikipedia-kilde (KA CC på #129). Turen må derfor bære nøkkelen den ble
 * hentet fra, både i strømmen og i det som skrives ned.
 *
 * Modulene nullstilles per test fordi korpusbutikka løser seg selv ved
 * import, slik twoCorpora.test.ts og corpusStore.test.ts gjør det.
 */
type Mock = {
  ask: (params: AskParams) => AsyncIterable<StreamEvent>;
  getThread: (id: string) => Promise<{ messages: { corpusKey?: string; role: string }[] } | null>;
  openThread?: (thread: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  }) => void;
};

async function withCorpus(key: string): Promise<Mock> {
  vi.stubEnv('VITE_API_MODE', 'mock');
  vi.stubEnv('VITE_KA_DATASETS', '');
  vi.stubEnv('VITE_KA_DATASET_CONFIG_KEY', '');
  vi.resetModules();

  const corpus = await import('../corpus');
  corpus.setActiveCorpusKey(key);

  const { MockChatClient, mockSpeeds } = await import('./index');
  return new MockChatClient(mockSpeeds.fast) as unknown as Mock;
}

/**
 * Samler en hel strøm med falsk tid, med feilhåndtereren festet før tida
 * spoles: en avvist promise som går gjennom en mikrotask uten lytter feller
 * kjøringa med exit 1 mens summeringslinja sier at alt bestod (#122).
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

/** Den siste ramma, den som avslutter turen. Det er den som bærer nøkkelen. */
function lastFrame(events: StreamEvent[]): Extract<StreamEvent, { type: 'done' | 'error' }> {
  const last = events.at(-1);
  if (last?.type !== 'done' && last?.type !== 'error') {
    throw new Error(`Strømmen endte på ${String(last?.type)}, ikke på done eller error.`);
  }
  return last;
}

/** En åpen tråd, som er det som gjør at turen skrives ned i det hele tatt. */
function openThread(client: Mock, id: string): void {
  const now = new Date().toISOString();
  client.openThread?.({ id, title: 'Prøvetråd', createdAt: now, updatedAt: now });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('strømmen sier hvilket korpus som svarte', () => {
  it('bærer nøkkelen på done', async () => {
    const client = await withCorpus('norquad-mock');
    const events = await collect(client.ask({ query: 'Hva handler artiklene om?' }));

    const frame = lastFrame(events);
    expect(frame.type).toBe('done');
    expect(frame.corpusKey).toBe('norquad-mock');
  });

  it('bærer det andre korpuset når det er det som er valgt', async () => {
    // Halve poenget: det er ikke en konstant, det er hva som faktisk svarte.
    const client = await withCorpus('mock');
    const events = await collect(client.ask({ query: 'Hva rapporterer Nkom?' }));

    expect(lastFrame(events).corpusKey).toBe('mock');
  });

  it('bærer nøkkelen på en tur uten treff', async () => {
    // `no-hits` og et stoppet svar er ferdige turer som blir liggende på
    // skjermen, så de må kunne svare på «fra hvilket korpus» de også.
    const client = await withCorpus('norquad-mock');
    const events = await collect(client.ask({ query: 'simuler ingen treff' }));

    const frame = lastFrame(events);
    expect(frame.type).toBe('error');
    expect(frame.corpusKey).toBe('norquad-mock');
  });

  it('bærer nøkkelen på et svar leseren stoppet', async () => {
    const client = await withCorpus('mock');
    const controller = new AbortController();
    const events: StreamEvent[] = [];

    await settle(
      (async () => {
        for await (const event of client.ask({
          query: 'Hva rapporterer Nkom?',
          signal: controller.signal,
        })) {
          events.push(event);
          if (event.type === 'token') controller.abort();
        }
      })(),
    );

    const frame = lastFrame(events);
    expect(frame.type).toBe('error');
    expect(frame.corpusKey).toBe('mock');
  });
});

describe('turen som skrives ned bærer korpuset sitt', () => {
  it('gir svaret nøkkelen det ble hentet fra, etter en oppfriskning', async () => {
    // Det lagrede svaret er det fraskrivelsen beskriver etter en reload. Uten
    // nøkkelen her ville den lest korpusvelgeren i stedet.
    const client = await withCorpus('norquad-mock');
    openThread(client, 'traad-1');
    await collect(client.ask({ query: 'Hva handler artiklene om?' }));

    const detail = await settle(client.getThread('traad-1'));
    const answer = detail?.messages.find((message) => message.role === 'assistant');

    expect(answer?.corpusKey).toBe('norquad-mock');
  });

  it('lar spørsmålet være uten nøkkel', async () => {
    // Korpuset er der svaret ble hentet fra. Et spørsmål ble ikke hentet noe
    // sted, og en nøkkel på det ville vært et svar på et spørsmål ingen stilte.
    const client = await withCorpus('mock');
    openThread(client, 'traad-2');
    await collect(client.ask({ query: 'Hva rapporterer Nkom?' }));

    const detail = await settle(client.getThread('traad-2'));
    const question = detail?.messages.find((message) => message.role === 'user');

    expect(question?.corpusKey).toBeUndefined();
  });

  it('skriver ned korpuset som svarte, ikke det som er valgt etterpå', async () => {
    // Nøyaktig funnet fra #129: leseren bytter med et ferdig svar på skjermen.
    // Svaret skal fortsatt si hvor det kom fra.
    const client = await withCorpus('norquad-mock');
    openThread(client, 'traad-3');
    await collect(client.ask({ query: 'Hva handler artiklene om?' }));

    const corpus = await import('../corpus');
    corpus.setActiveCorpusKey('mock');

    const detail = await settle(client.getThread('traad-3'));
    const answer = detail?.messages.find((message) => message.role === 'assistant');

    expect(corpus.activeCorpusKey()).toBe('mock');
    expect(answer?.corpusKey).toBe('norquad-mock');
  });
});

/**
 * Fixturtrådene bærer korpuset sitt de også.
 *
 * De elleve skriptede trådene var de eneste radene i lista uten korpus på
 * seg, mens hver rad leseren hadde laget bar et — som leser som «disse hører
 * ikke til noe korpus» i stedet for «disse er eldre» (KA CC kan 2 på #133).
 * Alt i dem er Kudos-dokumenter, så det er Kudos-mocken de sier.
 */
async function fixtures() {
  vi.stubEnv('VITE_API_MODE', 'mock');
  vi.stubEnv('VITE_KA_DATASETS', '');
  vi.stubEnv('VITE_KA_DATASET_CONFIG_KEY', '');
  vi.resetModules();
  return await import('./fixtures');
}

describe('fixturtrådene og korpuset', () => {
  it('gir hver rad i lista en korpusnøkkel', async () => {
    const { threads } = await fixtures();

    // Tolv rader: den håndskrevne NKOM-tråden og de elleve skriptede.
    expect(threads.length).toBeGreaterThan(1);
    for (const thread of threads) expect(thread.corpusKey).toBe('mock');
  });

  it('gir svaret i en skriptet tråd samme nøkkel', async () => {
    // Slik at fraskrivelsen over en åpnet fixturtråd sier Kudos selv om
    // leseren står i Wikipedia-mocken når den åpnes.
    const { findThread } = await fixtures();
    const answer = findThread('dss-regnskap')?.messages.find(
      (message) => message.role === 'assistant',
    );

    expect(answer?.corpusKey).toBe('mock');
  });

  it('gir svaret i den håndskrevne tråden samme nøkkel', async () => {
    const { findThread } = await fixtures();
    const answer = findThread('nkom-maaloppnaaelse')?.messages.find(
      (message) => message.role === 'assistant',
    );

    expect(answer?.corpusKey).toBe('mock');
  });

  it('lar spørsmålene være uten', async () => {
    const { findThread } = await fixtures();
    const questions = (findThread('dss-regnskap')?.messages ?? []).filter(
      (message) => message.role === 'user',
    );

    expect(questions).toHaveLength(1);
    for (const question of questions) expect(question.corpusKey).toBeUndefined();
  });
});
