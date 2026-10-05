/**
 * Fetches the mock corpus from Kudos.
 *
 * Run by hand, never from a build:
 *
 *     node scripts/fetch-mock-corpus.mjs
 *
 * The result is committed as src/api/mock/corpus/kudos-korpus.json, so a
 * clone builds and tests without touching the network. Re-run it when the
 * corpus should be refreshed, look at the diff, and commit that.
 *
 * WHAT IS REAL AND WHAT IS NOT. Everything this writes is real: titles,
 * document types, organisations, years and the summaries Kudos publishes for
 * each document. The answers, the thinking steps and the excerpt-to-answer
 * links in the scripted conversations are written by us, and they live
 * elsewhere. Nothing here is generated text.
 *
 * The API is public and needs no key: https://kudos.dfo.no/api/v0/documents.
 * One request per second, because a free public service run by DFØ is not
 * ours to hammer.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEARCH = 'https://kudos.dfo.no/api/v0/documents/search';

/**
 * The five document types the assistant is about. Each is a real value of the
 * API's `type` field, which it also filters on — measured 2026-09-16, and it
 * is what keeps this to 40 requests instead of 1806 pages of everything.
 */
const TYPES = ['Årsrapport', 'Evaluering', 'Tildelingsbrev', 'Statusrapport', 'Strategi/plan'];

/**
 * 20 pages of 25 per type, so 2500 documents are looked at to keep roughly
 * 600.
 *
 * The yield is low because most of Kudos has no abstract: measured over 200
 * documents on 2026-09-16, 128 had an empty one and 93 were dropped for being
 * too short to quote. The API has no filter for it — `type` is the only
 * parameter it accepts, anything else is an error — so the only way to a
 * corpus with summaries in it is to look at more documents.
 */
const PAGES_PER_TYPE = 20;
const EARLIEST_YEAR = 2020;
/** A summary shorter than this has nothing an excerpt could quote. */
const MIN_SUMMARY = 200;
const PAUSE_MS = 1000;

/**
 * Documents Kudos no longer has a page for, by uuid, and why. They keep their
 * place in the corpus, since a scripted answer may quote them, but get no
 * `url`: a link that 404s is worse than the panel's «ingen offentlig lenke».
 * The reason is written into the JSON as `urlMissing`, because JSON has no
 * comments and the next person to read it should not have to find this file.
 *
 * Measured, not assumed. Take an entry out when the page answers again, or
 * when the document is gone from the corpus altogether.
 *
 *   a1c6feb9-…  Årsrapport Nasjonal kommunikasjonsmyndighet 2025, the NKOM
 *               fixture's first source (src/api/mock/fixtures.ts). 404 on
 *               /dokument/<uuid> and on /api/v0/documents/<uuid>, 30.09,
 *               while 16 of the 17 documents the scripted conversations cite
 *               answered 200. It is not in the local Typesense either, so
 *               there is no number to link it by. Because the API has lost it,
 *               the next fetch will most likely not return it at all; then the
 *               fixture has to move to another report, which is the plan
 *               (the conductor, 30.09, option b).
 */
const DEAD_LINKS = new Map([
  [
    'a1c6feb9-3a47-4889-b049-92adae575b9f',
    'Kudos svarer 404 på denne adressen og på dokumentet i API-et (målt 30.09). Se DEAD_LINKS i scripts/fetch-mock-corpus.mjs.',
  ],
]);

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'src', 'api', 'mock', 'corpus', 'kudos-korpus.json');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The name a person would recognise, not the one the register shouts. */
function organisationOf(record) {
  const owner = record.owners?.[0];
  if (!owner) return undefined;
  const display = owner.alternative_names?.find((name) => name.type === 'display')?.name;
  return display ?? owner.name;
}

/**
 * The year the document is ABOUT, which is not the year it was published: an
 * annual report for 2024 comes out in 2025, and a filter on «År» that put it
 * under 2025 would be answering a different question than the one asked.
 */
function yearOf(record) {
  return (
    record.concerned_year_from ??
    record.concerned_year_to ??
    (record.publish_date ? Number(record.publish_date.slice(0, 4)) : undefined)
  );
}

/**
 * One page, with two more goes if the connection drops.
 *
 * A hundred requests over a hundred seconds will meet a hiccup now and then,
 * and losing the whole run to one is not worth it. Three attempts, waiting
 * longer each time; a page that still will not come is worth stopping for.
 */
async function fetchPage(type, page) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const url = `${SEARCH}?${new URLSearchParams({ type, page: String(page) })}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      process.stderr.write(`  ${type} side ${page}: forsøk ${attempt} feilet (${error.message})\n`);
      if (attempt < 3) await wait(PAUSE_MS * attempt * 2);
    }
  }

  throw new Error(`${type} side ${page} ga opp: ${lastError?.message}`);
}

async function main() {
  const documents = new Map();
  let seen = 0;

  for (const type of TYPES) {
    for (let page = 1; page <= PAGES_PER_TYPE; page += 1) {
      const body = await fetchPage(type, page);
      for (const record of body.data ?? []) {
        seen += 1;
        const year = yearOf(record);
        const summary = (record.abstract ?? '').trim();
        const organisation = organisationOf(record);

        if (!record.uuid || !record.title) continue;
        if (!year || year < EARLIEST_YEAR) continue;
        if (summary.length < MIN_SUMMARY) continue;
        if (!organisation) continue;

        documents.set(record.uuid, {
          id: record.uuid,
          title: record.title.trim(),
          type: record.type,
          organisation,
          year,
          summary,
          // The Kudos page for the document, so «Les dokumentet på Kudos»
          // goes somewhere that exists. `external_public_url` points at the
          // publisher instead and is often missing. Not for a page Kudos has
          // lost; see DEAD_LINKS.
          ...(DEAD_LINKS.has(record.uuid)
            ? { urlMissing: DEAD_LINKS.get(record.uuid) }
            : { url: `https://kudos.dfo.no/dokument/${record.uuid}` }),
        });
      }
      process.stderr.write(`${type} side ${page}: ${documents.size} beholdt av ${seen}\n`);
      if (page < PAGES_PER_TYPE || type !== TYPES.at(-1)) await wait(PAUSE_MS);
    }
  }

  const list = [...documents.values()].sort(
    (a, b) => b.year - a.year || a.title.localeCompare(b.title, 'nb-NO'),
  );

  const byType = {};
  for (const document of list) byType[document.type] = (byType[document.type] ?? 0) + 1;

  const corpus = {
    source: SEARCH,
    fetched: new Date().toISOString().slice(0, 10),
    note:
      'Ekte dokumentmetadata og sammendrag fra Kudos (DFØ), hentet med scripts/' +
      'fetch-mock-corpus.mjs. Ingenting her er generert. Svarene og tenkestegene i ' +
      'de scriptede samtalene er skrevet av oss og ligger et annet sted.',
    filters: { types: TYPES, earliestYear: EARLIEST_YEAR, minSummaryLength: MIN_SUMMARY },
    counts: { total: list.length, byType },
    documents: list,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(corpus, null, 1)}\n`, 'utf8');

  const bytes = Buffer.byteLength(JSON.stringify(corpus));
  process.stderr.write(
    `\nSkrev ${list.length} dokumenter til ${OUT} (${(bytes / 1024 / 1024).toFixed(2)} MB)\n`,
  );
  for (const [type, count] of Object.entries(byType)) {
    process.stderr.write(`  ${type}: ${count}\n`);
  }
}

await main();
