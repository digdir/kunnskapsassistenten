import { kaEnv } from './runtimeConfig';

/**
 * `VITE_KA_DOCUMENT_URLS`: per dataset, as in `VITE_KA_DATASETS`, an http(s) template
 * with `{doc_num}` for numeric numbers and one for UUIDs, split by `|`, since Kudos
 * serves the two at different addresses (headless-rag issue #25; src/decisions/0004).
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

// `kaEnv()`, so an image can be pointed at another corpus; parsed once per
// value, so a bad entry is warned about once and not per chunk.
function configured(): ReadonlyMap<string, DocumentTemplates> {
  const raw = kaEnv().VITE_KA_DOCUMENT_URLS;
  if (parsed === undefined || parsed.raw !== raw) {
    parsed = { raw, templates: parseDocumentUrls(raw) };
  }
  return parsed.templates;
}

/**
 * The address of one document, or undefined. Without `dataset`, the one live
 * asks by default. A number in neither shape gets no link, so nothing but
 * digits or a UUID from the backend ever reaches the path.
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
