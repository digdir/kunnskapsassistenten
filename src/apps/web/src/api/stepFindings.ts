import type { StepFindings } from '../model';

// What a tool call found, read out of the backend's report of it. genki writes the report for the
// model, in English, and sends the first 400 characters of it as `result-summary`
// (strategy-agent-loop/src/tools.ts); headless-rag writes the same sentences. The live and the bff
// client both read it here, so the reader sees the same whichever way the turn came.

/** «Search pass 2: found 38 chunks (32 new).» */
const NEW_HITS = /found \d+ chunks? \((\d+) new\)/u;

/** «Auto-filtered by orgs_long: Digitaliseringsdirektoratet.» The field name is the corpus's own
    and means nothing to a reader, so only the values are kept. */
const AUTO_FILTER = /Auto-filtered by [^:\n]+: ([^\n]+?)\.(?:\s|$)/u;

/** «Read 3 chunks (4532 chars this call, 4532 cumulative):» */
const EXCERPTS_READ = /^Read (\d+) chunks?\b/u;

/** One read excerpt's header, whole: one cut off inside the title is not counted. */
const READ_HEADER = /--- chunk_id=\S+ doc_num=\S+ chunk_index=\S+ title="([^"]*)"/gu;

/** «Read budget exhausted for the requested read.» and «Read budget exhausted (6/6 read …)». */
const READ_REFUSED = /^Read budget exhausted\b/u;

const TOOL_PLAN = 'plan_queries';
const TOOL_SEARCH = 'search';
const TOOL_READ = 'read_chunks';

function whole(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : undefined;
}

function readFindings(summary: string): StepFindings | undefined {
  if (READ_REFUSED.test(summary)) return { readRefused: true };

  const excerptsRead = whole(summary.match(EXCERPTS_READ)?.[1]);
  if (excerptsRead === undefined) return undefined;

  const titles = [...summary.matchAll(READ_HEADER)].map((match) => match[1].trim());
  const documentsRead = [...new Set(titles.filter(Boolean))];
  return {
    excerptsRead,
    ...(documentsRead.length ? { documentsRead } : {}),
    // Fewer whole headers than excerpts: the report was cut before the rest, and the excerpts
    // after the cut may be from other documents.
    ...(titles.length < excerptsRead ? { documentsPartial: true } : {}),
  };
}

function searchFindings(summary: string): StepFindings | undefined {
  const newHits = whole(summary.match(NEW_HITS)?.[1]);
  const autoFilter = summary.match(AUTO_FILTER)?.[1].trim();
  if (newHits === undefined && !autoFilter) return undefined;
  return {
    ...(newHits === undefined ? {} : { newHits }),
    ...(autoFilter ? { autoFilter } : {}),
  };
}

/**
 * What one call found, or undefined when the report says nothing this reads. `queries` are the
 * call's own arguments: for `plan_queries` that is the question as the agent restated it.
 */
export function stepFindings(
  tool: string,
  queries: readonly string[] | undefined,
  summary: string | undefined,
): StepFindings | undefined {
  if (tool === TOOL_PLAN) {
    const restatedQuestion = queries?.[0]?.trim();
    return restatedQuestion ? { restatedQuestion } : undefined;
  }
  if (!summary) return undefined;
  if (tool === TOOL_SEARCH) return searchFindings(summary);
  if (tool === TOOL_READ) return readFindings(summary);
  return undefined;
}
