import { renderBlocks } from '../markdown/Markdown.js';
import { pairCitations, type Pairing, type SourceCitation } from '../sources/pairing.js';
import type { SourceDocument } from '../sources/types.js';

/**
 * One marker as the contract's top-level `markers` lists it when a service cites excerpts: `[N]`
 * in the answer, and the one excerpt it means.
 */
export interface AnswerMarker {
  /** As the answer writes it, without the brackets: `3`. */
  marker: string;
  chunkId: string;
  documentId?: string | undefined;
}

/** What one `[N]` in the answer is drawn as. A `[N]` that is not here stays text, such as a year. */
export type FootnoteMark = { kind: 'footnote'; citation: number } | { kind: 'dropped' };

export interface AnswerFootnotes {
  /** The answer's footnotes in order, as `Sources` takes them: the same list for both blocks. */
  citations: SourceCitation[];
  pairing: Pairing;
  /** Each `[N]` the renderer meets, by the key it is drawn under. */
  marks: ReadonlyMap<string, FootnoteMark>;
  /** How many `[N]` the answer writes, footnotes or not: a stopped answer has these and no sources. */
  written: number;
  /** Each `[N]` the renderer meets, in order, and whether it is drawn as nothing. */
  met: readonly { n: number; dropped: boolean }[];
}

interface Written {
  key: string;
  n: number;
  /** Nothing drawn between this `[N]` and the one before it. */
  adjacent: boolean;
}

// The same walk the answer is drawn with, so the keys and the order are the drawing's own.
const writtenMarkers = (text: string): Written[] => {
  const found: Written[] = [];
  let touched = true;
  renderBlocks(
    text,
    (n, key) => {
      found.push({ key, n, adjacent: !touched });
      touched = false;
      return false;
    },
    true,
    (value) => {
      if (value.trim()) touched = true;
      return value;
    },
    () => {
      touched = true;
    },
  );
  return found;
};

/**
 * Reads the footnotes of an answer by the contract's rule: `[N]` is the marker the service's
 * `markers` list names when it cites excerpts, and otherwise the source with `index: N`. A `[N]`
 * that resolves to neither is prose and stays text. Then, from the data alone:
 *
 * - every footnote that leads to something shown is drawn, and pairs with it both ways;
 * - a footnote that leads to nothing shown is not drawn, so no mark leads nowhere;
 * - a footnote right after one that leads to the same item is one footnote, not two.
 *
 * Footnotes are numbered by excerpt, never by document: when the footnotes name only documents,
 * the pairing numbers nothing, and the answer draws no footnote marks.
 *
 * Without `sources` nothing is a footnote yet: they arrive with the end of the answer.
 */
export const readFootnotes = (
  text: string,
  sources: readonly SourceDocument[] | undefined,
  markers?: readonly AnswerMarker[],
): AnswerFootnotes => {
  const written = writtenMarkers(text);
  const byMarker = new Map(markers?.map((m) => [m.marker, m] as const));
  const resolve = (n: number): SourceCitation | undefined => {
    if (!sources) return undefined;
    if (markers) {
      const marker = byMarker.get(String(n));
      return marker && { chunkId: marker.chunkId, documentId: marker.documentId };
    }
    const source = sources.find((s) => s.index === n);
    return source && { index: n, documentId: source.documentId };
  };

  const resolved = written.map((w) => ({ ...w, citation: resolve(w.n) }));
  const all = resolved.flatMap((r) => (r.citation ? [r.citation] : []));
  const first = pairCitations(sources ?? [], all);

  const marks = new Map<string, FootnoteMark>();
  const citations: SourceCitation[] = [];
  let at = -1;
  let before: { target: string | undefined } | undefined;
  for (const r of resolved) {
    if (!r.citation) {
      before = undefined;
      continue;
    }
    at += 1;
    const target = first.targets[at];
    const repeat = r.adjacent && before !== undefined && before.target === target;
    before = { target };
    if (target === undefined || repeat) {
      marks.set(r.key, { kind: 'dropped' });
      continue;
    }
    marks.set(r.key, { kind: 'footnote', citation: citations.length });
    citations.push(r.citation);
  }
  return {
    citations,
    pairing: pairCitations(sources ?? [], citations),
    marks,
    written: written.filter((w) => w.n < 1000).length,
    met: written.map((w) => ({ n: w.n, dropped: marks.get(w.key)?.kind === 'dropped' })),
  };
};

/**
 * The answer's footnotes in order, for `Sources`' `citations`: the same list the answer pairs
 * from, so both blocks number the same excerpts, or nothing.
 */
export const answerCitations = (
  text: string,
  sources: readonly SourceDocument[] | undefined,
  markers?: readonly AnswerMarker[],
): SourceCitation[] => readFootnotes(text, sources, markers).citations;
