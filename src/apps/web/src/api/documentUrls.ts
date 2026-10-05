import { kaEnv } from './runtimeConfig';

/**
 * Where a corpus's documents can be read, as templates per dataset.
 *
 * The chunks the backend returns carry the document's number (`doc_num`) and,
 * for Kudos, no address: measured in the test environment 30.09, every source
 * said «Dokumentet har ingen offentlig lenke» (Simens issue 92). The address
 * is knowledge about a corpus, so it is configuration and not code, like the
 * filter fields (docs/arkitektur/0001-fasetter-og-korpuskunnskap.md).
 * Nikolai's BFF reads it the same way, from `KUDOS_BASE`.
 *
 * `VITE_KA_DOCUMENT_URLS`, in the grammar of `VITE_KA_DATASETS`: semicolons
 * between datasets, the first `=` after the key, and `{doc_num}` where the
 * number goes. Two templates, split by `|`: the first for a number that is
 * all digits, the second for one that is a UUID.
 *
 *   kudos-full=https://kudos.dfo.no/documents/{doc_num}|https://kudos.dfo.no/dokument/{doc_num}
 *
 * Two, because one corpus can hand out both. Kudos's own API now gives only
 * a UUID (headless-rag issue #25), so a corpus loaded again after that fix has
 * UUIDs where it had numbers, and Kudos answers them at different addresses:
 * `/documents/<number>` is a 301 to the document and `/documents/<uuid>` is a
 * 404, while `/dokument/<uuid>` is the document (measured by #4 and by #5,
 * 30.09). Which address goes with which shape is the corpus's business and
 * stays out of `src/`; the shape itself is not about any corpus.
 *
 * Either template may be left empty, and a dataset with no entry gets no
 * link, which the sources panel already draws honestly. A template that is
 * not an http(s) address with `{doc_num}` in it drops the entry with one
 * warning: a link built from it would go nowhere, or somewhere a link from
 * here must never go.
 */

export const DOC_NUM = '{doc_num}';

/** The two shapes a document number comes in. */
export type DocumentTemplates = { number?: string; uuid?: string };

const NUMBER = /^\d+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTemplate(template: string): boolean {
  return /^https?:\/\//i.test(template) && template.includes(DOC_NUM);
}

export function parseDocumentUrls(raw: string | undefined): ReadonlyMap<string, DocumentTemplates> {
  const templates = new Map<string, DocumentTemplates>();
  const dropped: string[] = [];

  for (const entry of (raw ?? '').split(';')) {
    if (!entry.trim()) continue;
    const split = entry.indexOf('=');
    const key = split === -1 ? '' : entry.slice(0, split).trim();
    const [number = '', uuid = '', ...extra] =
      split === -1
        ? []
        : entry
            .slice(split + 1)
            .split('|')
            .map((part) => part.trim());
    const valid =
      key !== '' &&
      extra.length === 0 &&
      (number !== '' || uuid !== '') &&
      (number === '' || isTemplate(number)) &&
      (uuid === '' || isTemplate(uuid));
    if (!valid) {
      dropped.push(entry.trim());
      continue;
    }
    // First wins, as in the other dataset settings.
    if (!templates.has(key)) {
      templates.set(key, { ...(number ? { number } : {}), ...(uuid ? { uuid } : {}) });
    }
  }

  if (dropped.length > 0) {
    console.warn(
      `KA: hopper over ${dropped.length} ugyldig(e) oppføring(er) i VITE_KA_DOCUMENT_URLS. ` +
        `Formatet er "datasett=https://…/${DOC_NUM}|https://…/${DOC_NUM};…", med malen for ` +
        `tall først og for UUID etter. Hoppet over: ${dropped.join(', ')}`,
    );
  }
  return templates;
}

let parsed:
  { raw: string | undefined; templates: ReadonlyMap<string, DocumentTemplates> } | undefined;

/**
 * `kaEnv()` and not `import.meta.env`, so one container image can be pointed
 * at another corpus by its environment alone, as with the filter fields.
 * Parsed once per value, so a bad entry is warned about once and not per
 * chunk.
 */
function configured(): ReadonlyMap<string, DocumentTemplates> {
  const raw = kaEnv().VITE_KA_DOCUMENT_URLS;
  if (parsed === undefined || parsed.raw !== raw) {
    parsed = { raw, templates: parseDocumentUrls(raw) };
  }
  return parsed.templates;
}

/**
 * The address of one document, or undefined when the corpus has none.
 *
 * `dataset` is the corpus the chunk was retrieved from. Without one — a turn
 * where the backend picked, a thread from before there was a choice — it is
 * the dataset live asks when nothing is chosen, which is what those were
 * asked of.
 *
 * A number in neither shape gets no link rather than a guess. That is also
 * what keeps whatever the backend sends from reaching the path as anything
 * but digits or a UUID: nothing else is ever put in.
 */
export function documentUrl(
  dataset: string | undefined,
  docNum: string | number | null | undefined,
  templates: ReadonlyMap<string, DocumentTemplates> = configured(),
): string | undefined {
  const number = docNum === null || docNum === undefined ? '' : String(docNum).trim();
  if (!number) return undefined;
  const key = dataset ?? kaEnv().VITE_KA_DATASET_CONFIG_KEY;
  const forCorpus = key === undefined ? undefined : templates.get(key);
  const template = NUMBER.test(number)
    ? forCorpus?.number
    : UUID.test(number)
      ? forCorpus?.uuid
      : undefined;
  return template?.replaceAll(DOC_NUM, number);
}
