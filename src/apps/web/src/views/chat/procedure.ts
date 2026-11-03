import type { SourceDocument, ThinkingStep } from '../../model';

// «Fremgangsmåte» as the design canvas has it (page «00-Fremgangsmåte», board A1c): up to seven
// phases, each drawn once and filled in as the steps arrive, from what the backend actually
// reported. A phase with nothing behind it is not drawn. «Det jeg ikke fant» never is today:
// genki says at most that an answer was insufficient, never what was missing.

export type PhaseId = 'understood' | 'scope' | 'searched' | 'read' | 'selected' | 'wrote';

/** A paragraph, or a list under the paragraph before it. */
export type PhaseBlock = string | readonly string[];

export interface ProcedurePhase {
  id: PhaseId;
  title: string;
  body: PhaseBlock[];
  /** The phase the assistant is in now. Only while it works. */
  ongoing: boolean;
}

const TITLES: Record<PhaseId, string> = {
  understood: 'Forsto spørsmålet',
  scope: 'Så på hvilke kilder tråden leser fra',
  searched: 'Lette etter steder som handler om spørsmålet',
  read: 'Leste de relevante delene nøye',
  selected: 'Valgte ut det som svarer på spørsmålet',
  wrote: 'Skrev svaret',
};

const ORDER: PhaseId[] = ['understood', 'scope', 'searched', 'read', 'selected', 'wrote'];

/** As many search phrases as a reader takes in at a glance. «blant annet» says there were more. */
export const MAX_SEARCH_PHRASES = 6;

/** The tool that writes the answer, in headless-rag. genki ends with `agent/finalized`. */
const ANSWER_TOOL = 'generate_response';

export type ProcedureInput = {
  steps: readonly ThinkingStep[];
  thinking: boolean;
  /** The reader's question, so a search that only repeats it is not shown as a topic. */
  question?: string;
  /** Which documents the thread reads from, as a sentence. See `procedureScopeText`. */
  scope?: string;
  /** The documents the answer cites. Absent until it has arrived. */
  documents?: readonly SourceDocument[];
};

export type Procedure = {
  phases: ProcedurePhase[];
  /** Excerpts read, when the backend reported it. */
  excerptsRead?: number;
};

/** Lower case, single spaces, no closing mark: two spellings of the same words compare equal. */
function plain(text: string): string {
  return text
    .toLocaleLowerCase('nb-NO')
    .replace(/[?.!\s]+$/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** A search string as a reader reads it: the quote marks are search syntax. */
function readablePhrase(query: string): string {
  return query.replace(/"/gu, '').replace(/\s+/gu, ' ').trim();
}

/** Which phase a step belongs to, or undefined for one no phase is about (`rerank_results`). */
function phaseOf(step: ThinkingStep, worked: boolean): PhaseId | undefined {
  if (step.tool === 'plan_queries') return 'understood';
  if (step.tool === 'inspect_filters') return 'scope';
  if (step.kind === 'finalizing' || step.tool === ANSWER_TOOL) return 'wrote';
  if (step.kind === 'read') return 'read';
  if (step.tool ? step.tool.includes('search') : step.kind === 'search') return 'searched';
  // The agent's own words before it searched are how it read the question. Later ones are about
  // machinery the phases already show, and stay at the detailed level.
  if (step.kind === 'reasoning') return worked ? undefined : 'understood';
  return undefined;
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The phases to draw, in the design's order, each filled in from every step that belongs to it.
 * Pure, so the live and the bff client can be run through it from one recorded turn.
 */
export function procedureFrom({
  steps,
  thinking,
  question,
  scope,
  documents,
}: ProcedureInput): Procedure {
  const reached = new Set<PhaseId>();
  let current: PhaseId | undefined;
  let worked = false;

  let restated: string | undefined;
  let reasoning: string | undefined;
  const autoFilters: string[] = [];
  const phrases = new Map<string, string>();
  let searches = 0;
  let hits: number | undefined;
  let excerpts: number | undefined;
  const titles: string[] = [];
  let partial = false;
  let refused = false;

  for (const step of steps) {
    const phase = phaseOf(step, worked);
    if (!phase) continue;
    reached.add(phase);
    current = phase;
    const found = step.findings;

    switch (phase) {
      case 'understood':
        if (found?.restatedQuestion) restated ??= found.restatedQuestion;
        else if (step.kind === 'reasoning') reasoning ??= step.detail ?? step.label;
        break;

      case 'searched':
        worked = true;
        for (const query of step.queries ?? []) {
          const phrase = readablePhrase(query);
          const key = plain(phrase);
          if (phrase && key !== plain(question ?? '') && !phrases.has(key))
            phrases.set(key, phrase);
        }
        if (found?.newHits !== undefined) {
          searches += 1;
          hits = (hits ?? 0) + found.newHits;
        }
        if (found?.autoFilter && !autoFilters.includes(found.autoFilter)) {
          autoFilters.push(found.autoFilter);
        }
        break;

      case 'read':
        worked = true;
        if (found?.readRefused) refused = true;
        if (found?.excerptsRead !== undefined) excerpts = (excerpts ?? 0) + found.excerptsRead;
        for (const title of found?.documentsRead ?? []) {
          if (!titles.includes(title)) titles.push(title);
        }
        if (found?.documentsPartial) partial = true;
        break;

      default:
        break;
    }
  }

  const body: Record<PhaseId, PhaseBlock[]> = {
    understood: [],
    scope: [],
    searched: [],
    read: [],
    selected: [],
    wrote: [],
  };

  if (restated && plain(restated) !== plain(question ?? '')) {
    body.understood.push(`Jeg tolket spørsmålet slik: «${restated}».`);
  } else if (!restated && reasoning) {
    body.understood.push(reasoning);
  }

  if (scope) body.scope.push(scope);
  if (autoFilters.length) {
    reached.add('scope');
    const [first, ...later] = autoFilters;
    body.scope.push(
      later.length
        ? `Jeg avgrenset søket først til ${first}, så til ${later.join(', så til ')}.`
        : `Jeg avgrenset søket til ${first}.`,
    );
  }
  // The thread's documents are a fact from the start, not something the assistant did.
  if (scope && steps.length) reached.add('scope');

  const shown = [...phrases.values()];
  if (shown.length) {
    const some = shown.length > MAX_SEARCH_PHRASES;
    body.searched.push(
      some
        ? 'Jeg lette etter omtale av blant annet disse temaene:'
        : 'Jeg lette etter omtale av disse temaene:',
      shown.slice(0, MAX_SEARCH_PHRASES),
    );
  }
  if (hits !== undefined) {
    body.searched.push(
      `${searches === 1 ? 'Søket' : 'Søkene'} fant ${count(hits, 'treff', 'treff')}.`,
    );
  }

  if (excerpts !== undefined) {
    const read = thinking
      ? `Har lest ${count(excerpts, 'utdrag', 'utdrag')} så langt`
      : `Leste ${count(excerpts, 'utdrag', 'utdrag')}`;
    if (titles.length) {
      body.read.push(
        partial ? `${read}, blant annet fra disse dokumentene:` : `${read} fra disse dokumentene:`,
        titles,
      );
    } else {
      body.read.push(`${read}.`);
    }
  }
  if (refused) body.read.push('Nådde grensen for hvor mye jeg kan lese for ett spørsmål.');

  // The cited documents arrive with the answer, so this phase is never one the assistant is in.
  if (!thinking && documents?.length) {
    reached.add('selected');
    body.selected.push(
      `${count(documents.length, 'dokument', 'dokumenter')} er brukt i svaret:`,
      documents.map((document) => document.title),
    );
  }

  const phases = ORDER.filter((id) => reached.has(id)).map((id) => ({
    id,
    title: TITLES[id],
    body: body[id],
    ongoing: thinking && id === current,
  }));

  return { phases, ...(excerpts === undefined ? {} : { excerptsRead: excerpts }) };
}

/** Whole seconds, never zero: «tok 0 sekunder» reads as a bug. */
function seconds(durationMs: number): string {
  const whole = Math.max(1, Math.round(durationMs / 1000));
  return count(whole, 'sekund', 'sekunder');
}

/**
 * The line under «Fremgangsmåte»: where the assistant is while it works, and what it read, used and
 * how long it took once it is done. Only what was reported; undefined when nothing was.
 */
export function procedureStatus(
  procedure: Procedure,
  thinking: boolean,
  usedDocuments: number,
  durationMs: number | undefined,
): string | undefined {
  if (thinking) {
    const index = procedure.phases.findIndex((phase) => phase.ongoing);
    return index === -1 ? 'Jobber' : `Jobber · steg ${index + 1}`;
  }

  const did: string[] = [];
  if (procedure.excerptsRead !== undefined) {
    did.push(`leste ${count(procedure.excerptsRead, 'utdrag', 'utdrag')}`);
  }
  if (usedDocuments > 0) {
    did.push(`brukte ${count(usedDocuments, 'dokument', 'dokumenter')}`);
  }
  const parts = [did.join(', '), durationMs === undefined ? '' : `tok ${seconds(durationMs)}`];
  const line = parts.filter(Boolean).join(' · ');
  return line ? line[0].toLocaleUpperCase('nb-NO') + line.slice(1) : undefined;
}
