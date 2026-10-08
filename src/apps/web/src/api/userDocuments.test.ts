import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockChatClient, mockSpeeds } from './mock';
import { DOCUMENTS_STORAGE_KEY } from './mock/MockUploadClient';
import { resetUploadClientForTest } from './uploadFactory';
import {
  loadUserDocuments,
  removeUserDocument,
  resetUserDocumentsForTest,
  subscribeToUserDocuments,
  uploadUserDocument,
  userDocuments,
} from './userDocuments';
import type { StreamEvent } from '../model';

/**
 * Butikken tre views deler, og hva et spørsmål med vedlegg får til svar.
 *
 * Butikken ligger utenfor React fordi partene står forskjellige steder:
 * skrivefeltet (#3) laster opp, «Dine dokumenter» (#2) tegner lista, og
 * kildepanelet (#4) leser hva et svar siterte.
 */
function fileOf(name: string, size = 1024): File {
  const file = new File(['x'], name);
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/**
 * Kjører en opplasting ferdig med falsk tid.
 *
 * Håndtereren festes FØR tida spoles, og det er hele poenget med
 * rekkefølgen her. `runAllTimersAsync` lar opplastingen bli ferdig — eller
 * avvist — mens ingen ennå lytter på `work`, og en avvist promise som går
 * gjennom en mikrotask uten feilhåndterer blir en uhåndtert rejection. Den
 * feller hele kjøringa med exit-kode 1 selv om hver eneste test står som
 * bestått, som er nettopp den formen en slik feil kommer i: grønn
 * summeringslinje, rød CI. Funnet av KA CC på main etter #117.
 *
 * `then` med begge grenene og ikke `catch`: det som skal videre er både
 * verdien og feilen, uendret, og bare etter at tida er spolt.
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

beforeEach(() => {
  localStorage.clear();
  resetUserDocumentsForTest();
  resetUploadClientForTest();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('butikken', () => {
  it('legger rada inn med en gang, før klienten er ferdig', async () => {
    // Det er dette som gjør ventinga lesbar: en leser som valgte en fil ser
    // den lande der og da, med en bar som beveger seg.
    const pending = uploadUserDocument(fileOf('Rapport.pdf'));

    expect(userDocuments()).toHaveLength(1);
    expect(userDocuments()[0]).toMatchObject({ status: 'uploading', progress: 0 });

    await settle(pending);
    expect(userDocuments()[0]).toMatchObject({ status: 'ready', progress: 100 });
  });

  it('bytter ut rada i stedet for å legge til en ny', async () => {
    // Klienten lager sin egen id; rada som alt står der beholder plassen, så
    // det ferdige dokumentet tar den ventende sin id og ikke dukker opp to
    // ganger.
    await settle(uploadUserDocument(fileOf('Rapport.pdf')));

    expect(userDocuments()).toHaveLength(1);
  });

  it('varsler den som lytter, og slutter når de melder seg av', async () => {
    const heard = vi.fn();
    const off = subscribeToUserDocuments(heard);

    await settle(uploadUserDocument(fileOf('Rapport.pdf')));
    expect(heard).toHaveBeenCalled();

    off();
    const before = heard.mock.calls.length;
    await settle(uploadUserDocument(fileOf('To.pdf')));
    expect(heard.mock.calls.length).toBe(before);
  });

  it('beholder en avvist fil i lista, med koden sin', async () => {
    // Den må vises: en leser som slapp en 40 MB-fil trenger å se hvilken fil
    // som ble avvist og hvorfor.
    await settle(uploadUserDocument(fileOf('Skjermbilde.png')));

    expect(userDocuments()[0]).toMatchObject({ status: 'failed', errorCode: 'wrong-type' });
  });

  it('tar rada bort når leseren avbryter', async () => {
    const controller = new AbortController();
    const pending = uploadUserDocument(fileOf('Rapport.pdf'), controller.signal);
    controller.abort();

    await expect(settle(pending)).rejects.toBeDefined();
    // En avbrutt opplasting er ikke en feil å lese om; den er noe leseren
    // ombestemte seg om.
    expect(userDocuments()).toEqual([]);
  });

  it('leser det som er lagret, én gang uansett hvor mange som spør', async () => {
    localStorage.setItem(
      DOCUMENTS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'a',
          name: 'Fra i går.pdf',
          type: 'pdf',
          size: 10,
          status: 'ready',
          progress: 100,
          uploadedAt: '2026-09-20T10:00:00.000Z',
        },
      ]),
    );

    await Promise.all([loadUserDocuments(), loadUserDocuments(), loadUserDocuments()]);

    expect(userDocuments()).toHaveLength(1);
  });

  it('fjerner både fra lista og fra lageret', async () => {
    const document = await settle(uploadUserDocument(fileOf('Rapport.pdf')));

    await removeUserDocument(document.id);

    expect(userDocuments()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(DOCUMENTS_STORAGE_KEY) ?? '[]')).toEqual([]);
  });
});

describe('et spørsmål med vedlegg', () => {
  async function ask(attachments?: string[]): Promise<StreamEvent[]> {
    const client = new MockChatClient(mockSpeeds.fast);
    const events: StreamEvent[] = [];
    const run = (async () => {
      for await (const event of client.ask({ query: 'Hva står i dokumentet mitt?', attachments })) {
        events.push(event);
      }
    })();
    await vi.runAllTimersAsync();
    await run;
    return events;
  }

  function sourcesFrom(events: StreamEvent[]) {
    const event = events.find((candidate) => candidate.type === 'sources');
    return event?.type === 'sources' ? event : undefined;
  }

  it('gir minst én kilde fra leserens eget dokument', async () => {
    const document = await settle(uploadUserDocument(fileOf('Egen rapport.pdf')));

    const sources = sourcesFrom(await ask([document.id]));
    const own = sources?.documents.filter((candidate) => candidate.origin === 'user') ?? [];

    expect(own).toHaveLength(1);
    expect(own[0]?.title).toBe('Egen rapport.pdf');
    // Ingen Kudos-lenke: det er leserens egen fil, og ingen andre kan åpne den.
    expect(own[0]?.excerpts[0]?.kudosUrl).toBeUndefined();
  });

  it('skiller eget dokument fra korpuset på modellen, ikke på tittelen', async () => {
    // #4 ba om nettopp dette: et dokument som heter «Årsrapport 2025.pdf» og
    // som leseren lastet opp, er ikke korpusets årsrapport.
    const document = await settle(uploadUserDocument(fileOf('Årsrapport 2025.pdf')));

    const sources = sourcesFrom(await ask([document.id]));

    expect(sources?.documents.some((candidate) => candidate.origin === 'user')).toBe(true);
    expect(sources?.documents.some((candidate) => candidate.origin === undefined)).toBe(true);
  });

  it('nummererer det egne dokumentet først, og resten etter', async () => {
    // Et sitatnummer ER plassen i svarets flate utdragsliste, så å sette noe
    // foran flytter resten.
    const document = await settle(uploadUserDocument(fileOf('Egen.pdf')));

    const sources = sourcesFrom(await ask([document.id]));
    const numbers = sources?.documents.flatMap((candidate) =>
      candidate.excerpts.map((excerpt) => excerpt.citationNumber),
    );

    expect(sources?.documents[0]?.origin).toBe('user');
    expect(numbers).toEqual(numbers?.map((_, index) => index + 1));
  });

  it('svarer som før uten vedlegg', async () => {
    const sources = sourcesFrom(await ask());

    expect(sources?.documents.every((candidate) => candidate.origin === undefined)).toBe(true);
  });

  it('hopper over en id butikken ikke kjenner', async () => {
    // Et dokument som ble fjernet mellom at spørsmålet ble skrevet og sendt.
    // En mock som kastet der, ville feilet en tur en ekte backend bare ville
    // besvart uten det.
    const sources = sourcesFrom(await ask(['finnes-ikke']));

    expect(sources?.documents.every((candidate) => candidate.origin === undefined)).toBe(true);
  });
});
