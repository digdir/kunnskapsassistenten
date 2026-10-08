import { afterEach, describe, expect, it, vi } from 'vitest';
import { documentUrl, parseDocumentUrls } from './documentUrls';

/**
 * Issue 92: kildene i testmiljøet hadde ingen lenke til Kudos, fordi
 * bitene har `doc_num` og ingen `url`. Adressen er kunnskap om korpuset, så
 * den er oppsett per datasett (src/decisions/0004), og koden setter bare nummeret inn.
 *
 * To maler, fordi Kudos gir samme dokument to former for nummer: et tall
 * (`/documents/370449` gir 301 til dokumentet) og en UUID (`/documents/<uuid>`
 * gir 404, `/dokument/<uuid>` er dokumentet). Målt 30.09.
 */
const KUDOS =
  'kudos-full=https://kudos.dfo.no/documents/{doc_num}|https://kudos.dfo.no/dokument/{doc_num}';
const UUID = '650630f6-36a8-4119-bd65-5ea0af7b8718';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('parseDocumentUrls', () => {
  it('leser datasett=mal for tall|mal for UUID, med semikolon mellom', () => {
    const templates = parseDocumentUrls(`${KUDOS};annet=https://eksempel.no/d/{doc_num}?v=1`);
    expect([...templates]).toEqual([
      [
        'kudos-full',
        {
          number: 'https://kudos.dfo.no/documents/{doc_num}',
          uuid: 'https://kudos.dfo.no/dokument/{doc_num}',
        },
      ],
      // Første `=` skiller nøkkelen fra malen, så et `=` i malen er trygt.
      // Uten `|` er det bare malen for tall.
      ['annet', { number: 'https://eksempel.no/d/{doc_num}?v=1' }],
    ]);
  });

  it('godtar at malen for tall står tom', () => {
    expect([...parseDocumentUrls('k=|https://ok/{doc_num}')]).toEqual([
      ['k', { uuid: 'https://ok/{doc_num}' }],
    ]);
  });

  it('hopper over en ugyldig oppføring, med én advarsel', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const templates = parseDocumentUrls(
      [
        'a=https://kudos.dfo.no/documents',
        'b=javascript:alert({doc_num})',
        'c=https://ok/{doc_num}|ftp://x/{doc_num}',
        'd=https://ok/{doc_num}|https://ok/{doc_num}|https://tredje/{doc_num}',
        'e=|',
        'f=https://ok/{doc_num}',
      ].join(';'),
    );
    expect([...templates.keys()]).toEqual(['f']);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('documentUrl', () => {
  const templates = parseDocumentUrls(KUDOS);

  it('setter et tall inn i malen for tall', () => {
    expect(documentUrl('kudos-full', '372017', templates)).toBe(
      'https://kudos.dfo.no/documents/372017',
    );
    expect(documentUrl('kudos-full', 372017, templates)).toBe(
      'https://kudos.dfo.no/documents/372017',
    );
  });

  it('setter en UUID inn i malen for UUID', () => {
    // Etter headless-rag #25 gir Kudos bare UUID, og da ville /documents/ gitt 404.
    expect(documentUrl('kudos-full', UUID, templates)).toBe(
      `https://kudos.dfo.no/dokument/${UUID}`,
    );
    expect(documentUrl('kudos-full', UUID.toUpperCase(), templates)).toBe(
      `https://kudos.dfo.no/dokument/${UUID.toUpperCase()}`,
    );
  });

  it('gir ingen lenke når formen ikke har en mal', () => {
    const numbersOnly = parseDocumentUrls('k=https://ok/{doc_num}');
    expect(documentUrl('k', UUID, numbersOnly)).toBeUndefined();
  });

  it('gir ingen lenke for et nummer i en annen form, i stedet for å gjette', () => {
    // Også det som holder alt annet enn sifre og en UUID ute av stien.
    expect(documentUrl('kudos-full', '../admin?x=1', templates)).toBeUndefined();
    expect(documentUrl('kudos-full', 'doc-7', templates)).toBeUndefined();
  });

  it('gir ingen lenke for et datasett uten mal, eller uten nummer', () => {
    expect(documentUrl('norquad-docs', '7', templates)).toBeUndefined();
    expect(documentUrl('kudos-full', undefined, templates)).toBeUndefined();
    expect(documentUrl('kudos-full', '  ', templates)).toBeUndefined();
  });

  it('bruker datasettet live spør når svaret ikke sier hvilket', () => {
    vi.stubEnv('VITE_KA_DATASET_CONFIG_KEY', 'kudos-full');
    expect(documentUrl(undefined, '372017', templates)).toBe(
      'https://kudos.dfo.no/documents/372017',
    );
  });

  it('leser malen fra oppsettet når ingen gis', () => {
    vi.stubEnv('VITE_KA_DOCUMENT_URLS', KUDOS);
    expect(documentUrl('kudos-full', '1')).toBe('https://kudos.dfo.no/documents/1');
  });
});
