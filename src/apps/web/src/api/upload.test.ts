import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_UPLOAD_BYTES, userDocumentType } from '../model';
import { LiveUploadClient } from './live/LiveUploadClient';
import {
  ALWAYS_FAILS_PREFIX,
  DOCUMENTS_STORAGE_KEY,
  MockUploadClient,
} from './mock/MockUploadClient';

/**
 * Opplasting, som ingen backend har et endepunkt for (API-bestilling A3).
 *
 * Grensene håndheves i mocken slik at hele flyten — avvisning, melding,
 * dokumentet som dukker opp som mislykket — kan bygges og ses før A3 finnes.
 * Live-klienten er den ærlige halvdelen: den kaller ingenting.
 *
 * Tida er falsk her. Mocken bruker 1,5 sekunder på en opplasting med vilje,
 * og femten ekte pauser per test ville gjort suiten til noe ingen kjører.
 */
function fileOf(name: string, size = 1024): File {
  const file = new File(['x'], name);
  // `File.size` er skrivebeskyttet og kommer av innholdet; å lage en 21 MB
  // fil i minnet for å teste en grense ville kostet 21 MB.
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
async function run<T>(work: Promise<T>): Promise<T> {
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
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('hvilke filer mocken tar imot', () => {
  it('tar PDF og .docx', async () => {
    const client = new MockUploadClient();

    const pdf = await run(client.upload(fileOf('Årsrapport 2025.pdf')));
    const docx = await run(client.upload(fileOf('Notat.docx')));

    expect(pdf.status).toBe('ready');
    expect(pdf.type).toBe('pdf');
    expect(docx.status).toBe('ready');
    expect(docx.type).toBe('docx');
  });

  it('avviser et filformat den ikke tar, med en gang', async () => {
    // Med en gang: en fil som ikke kan tas skal ikke få halvannet sekund med
    // en bar som aldri skulle noe sted.
    const client = new MockUploadClient();
    const progress = vi.fn();

    const refused = await client.upload(fileOf('Skjermbilde.png'), progress);

    expect(refused.status).toBe('failed');
    expect(refused.errorCode).toBe('wrong-type');
    expect(progress).not.toHaveBeenCalled();
  });

  it('avviser en fil over 20 MB', async () => {
    const client = new MockUploadClient();

    const refused = await client.upload(fileOf('Stor.pdf', MAX_UPLOAD_BYTES + 1));

    expect(refused.status).toBe('failed');
    expect(refused.errorCode).toBe('too-large');
  });

  it('tar imot en fil på nøyaktig grensa', async () => {
    // «Maks 20 MB» betyr at 20 MB går inn. En av-for-en her ville avvist en
    // fil som oppfyller det appen lover.
    const client = new MockUploadClient();

    const accepted = await run(client.upload(fileOf('Akkurat.pdf', MAX_UPLOAD_BYTES)));

    expect(accepted.status).toBe('ready');
  });

  it('kjenner typen på navnet, ikke på MIME-typen', () => {
    // Nettlesere er uenige om .docx: Chrome sier OpenXML-strengen, noen sier
    // application/octet-stream, og en fil dratt ut av et arkiv bærer ingenting.
    expect(userDocumentType('Rapport.PDF')).toBe('pdf');
    expect(userDocumentType('Notat.DocX')).toBe('docx');
    expect(userDocumentType('Regneark.xlsx')).toBeUndefined();
    expect(userDocumentType('uten-punktum')).toBeUndefined();
  });
});

describe('framdrift og feilsti', () => {
  it('melder framdrift underveis og ender på 100', async () => {
    const client = new MockUploadClient();
    const seen: number[] = [];

    const done = await run(client.upload(fileOf('Rapport.pdf'), (percent) => seen.push(percent)));

    expect(seen.length).toBeGreaterThan(1);
    expect(seen.at(-1)).toBe(100);
    // Bare oppover: en bar som hopper bakover er verre enn ingen bar.
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
    expect(done.progress).toBe(100);
  });

  it('lar en fil som heter «feil…» mislykkes etter framdriften', async () => {
    // Feilstien må kunne nås på bestilling. Alle andre feil her krever at man
    // har en fil av feil slag eller størrelse for hånda, og «finn en PDF på
    // 21 MB» er en dårlig måte å se på en feiltilstand.
    const client = new MockUploadClient();
    const seen: number[] = [];

    const failed = await run(
      client.upload(fileOf(`${ALWAYS_FAILS_PREFIX}-rapport.pdf`), (p) => seen.push(p)),
    );

    expect(failed.status).toBe('failed');
    expect(failed.errorCode).toBe('failed');
    // Etter framdriften, ikke før: dette er feilen som skjer på hjemveien, og
    // den er den ene et view må tegne over en bar som alt var full.
    expect(seen.at(-1)).toBe(100);
    expect(failed.progress).toBe(100);

    // Og den lagres ikke, like lite som en fil som ble avvist med en gang. En
    // feil er noe å se og prøve på nytt etter, ikke et dokument — og en som
    // overlevde omlasting ville kommet tilbake som en død rad med full bar og
    // ingen vei videre. Funnet av KA CC på #117.
    expect(await client.list()).toEqual([]);
    expect(localStorage.getItem(DOCUMENTS_STORAGE_KEY)).toBeNull();
  });

  it('kaster når opplastingen avbrytes', async () => {
    const client = new MockUploadClient();
    const controller = new AbortController();

    const pending = client.upload(
      fileOf('Rapport.pdf'),
      () => controller.abort(),
      controller.signal,
    );

    await expect(run(pending)).rejects.toBeDefined();
    // Og ingenting ble lagret: en avbrutt opplasting er ikke et dokument.
    expect(localStorage.getItem(DOCUMENTS_STORAGE_KEY)).toBeNull();
  });
});

describe('det som lagres', () => {
  it('lagrer metadata og aldri filinnhold', async () => {
    const client = new MockUploadClient();
    await run(client.upload(fileOf('Årsrapport 2025.pdf', 2048)));

    const stored = JSON.parse(localStorage.getItem(DOCUMENTS_STORAGE_KEY) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ name: 'Årsrapport 2025.pdf', type: 'pdf', size: 2048 });
    // Ingen bytes noe sted. Det er ikke en snarvei: et dokument mocken «har»
    // kan ikke søkes i uansett, og megabyte med base64 i localStorage ville
    // fylt kvoten og latet som noe annet.
    expect(JSON.stringify(stored)).not.toContain('base64');
    expect(Object.keys(stored[0])).not.toContain('content');
  });

  it('lister det som er lagret, og glemmer det som fjernes', async () => {
    const client = new MockUploadClient();
    const first = await run(client.upload(fileOf('En.pdf')));
    await run(client.upload(fileOf('To.docx')));

    expect(await client.list()).toHaveLength(2);

    await client.remove(first.id);
    const left = await client.list();

    expect(left).toHaveLength(1);
    expect(left[0]?.name).toBe('To.docx');
  });

  it('lar en avvist fil være ute av lista', async () => {
    // Den skal vises til leseren, men den er ikke et dokument som finnes.
    const client = new MockUploadClient();
    await client.upload(fileOf('Skjermbilde.png'));

    expect(await client.list()).toEqual([]);
  });

  it('overlever tull i lageret uten å miste lista', async () => {
    localStorage.setItem(DOCUMENTS_STORAGE_KEY, 'ikke json');
    const client = new MockUploadClient();

    expect(await client.list()).toEqual([]);

    // Og den kan skrives til igjen etterpå.
    await run(client.upload(fileOf('En.pdf')));
    expect(await client.list()).toHaveLength(1);
  });

  it('hopper over en ødelagt oppføring, ikke hele lista', async () => {
    localStorage.setItem(
      DOCUMENTS_STORAGE_KEY,
      JSON.stringify([{ id: 'a', name: 'God.pdf' }, 42, { name: 'uten id' }]),
    );

    expect(await new MockUploadClient().list()).toHaveLength(1);
  });
});

describe('om opplasting er mulig i det hele tatt', () => {
  it('sier ingenting i mock, der det virker', () => {
    // Undefined betyr at det går. Erklært og ikke utelatt, så de to klientene
    // synlig svarer på det samme spørsmålet.
    expect(new MockUploadClient().unavailable).toBeUndefined();
  });

  it('sier «unavailable» i live, før noen har valgt en fil', () => {
    // Sona skal si det ærlige paa forhaand i stedet for aa ta imot en fil og
    // levere den tilbake et oeyeblikk etter. Bedt om av #2, 21.09.
    expect(new LiveUploadClient().unavailable).toBe('unavailable');
  });

  it('bruker samme kodeord som en avvist fil, ikke et eget', async () => {
    // En kode og ikke en boolean: viewet har alt en norsk setning per
    // UploadErrorCode, og en boolean ville tvunget fram en femte setning for
    // en tilstand som alt har en kode.
    const client = new LiveUploadClient();
    expect(client.unavailable).toBe((await client.upload(fileOf('Rapport.pdf'))).errorCode);
  });
});

describe('live-klienten, som ikke har noe endepunkt', () => {
  it('avviser med «unavailable» uten å kalle noe', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const refused = await new LiveUploadClient().upload(fileOf('Årsrapport.pdf'));

    expect(refused.status).toBe('failed');
    expect(refused.errorCode).toBe('unavailable');
    // Ingen forespørsel noe sted: et klient som POSTet et sted håpefullt ville
    // gjort et kjent hull om til en 404 leseren måtte tolke.
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('sier «wrong-type» når det er formatet som er problemet', async () => {
    // Ærligheten gjelder begge veier: en leser som får «støtter ikke dette
    // filformatet» for en PDF ville lett etter feil problem.
    const refused = await new LiveUploadClient().upload(fileOf('Skjermbilde.png'));

    expect(refused.errorCode).toBe('wrong-type');
  });

  it('lister ingenting og fjerner uten å klage', async () => {
    const client = new LiveUploadClient();

    expect(await client.list()).toEqual([]);
    await expect(client.remove()).resolves.toBeUndefined();
  });
});
