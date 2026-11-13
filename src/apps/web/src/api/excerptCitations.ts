import type { Citation, SourceDocument } from '../model';

/**
 * One marker as genki is asked to send it (digdir/genki#273): the marker as the answer writes it,
 * and the one excerpt it means. genki numbers markers its own way (`[1.1]`, or one running number);
 * the reader sees KA's numbers.
 */
export type MarkerRef = {
  /** As written in the answer, without the brackets: `2.1`, or `3`. */
  marker: string;
  /** The excerpt the marker means: its chunk, which is the excerpt's `id`. */
  chunkId: string;
  documentId?: string;
};

/** An answer with its markers numbered as KA shows them, and only the excerpts they cite. */
export type CitedAnswer = {
  /** The answer with every marker as `[n]`, n being its excerpt's number. */
  content: string;
  /** The documents with a cited excerpt, each with only those, in number order. */
  documents: SourceDocument[];
  citations: Citation[];
};

// A marker and the space before it, so «kvartalsvis [1].» never becomes «kvartalsvis .» when the
// marker goes. One or two parts: `[3]` or `[1.2]`.
const MARKER = /([ \t]?)\[(\d{1,3}(?:\.\d{1,3})?)\]/g;

/**
 * Footnotes and excerpts one to one (Lars, 2026-11-03): only an excerpt gets a number, 1, 2, 3 in
 * the order the answer first cites it, and a marker naming the same excerpt again gets the same
 * number. A marker is kept only when its excerpt is among `documents`, and an excerpt is kept only
 * when a marker cites it, so no footnote leads nowhere and no excerpt is shown without one.
 */
export function citeExcerpts(
  content: string,
  documents: SourceDocument[],
  markers: MarkerRef[],
): CitedAnswer {
  const excerpts = new Map(
    documents.flatMap((document) =>
      document.excerpts.map((excerpt) => [excerpt.id, { document, excerpt }] as const),
    ),
  );
  const chunkOf = new Map<string, string>();
  for (const { marker, chunkId } of markers) {
    if (!chunkOf.has(marker)) chunkOf.set(marker, chunkId);
  }

  const numberOf = new Map<string, number>();
  const rewritten = content
    .replace(MARKER, (_match, space: string, marker: string) => {
      const chunkId = chunkOf.get(marker);
      if (chunkId === undefined || !excerpts.has(chunkId)) return '';
      let number = numberOf.get(chunkId);
      if (number === undefined) {
        number = numberOf.size + 1;
        numberOf.set(chunkId, number);
      }
      return `${space}[${number}]`;
    })
    // Two markers that meant one excerpt, side by side, are one footnote.
    .replace(/\[(\d+)\](?:\[\1\])+/g, '[$1]');

  const cited = documents
    .map(({ citationNumber: _whole, ...document }) => ({
      ...document,
      excerpts: document.excerpts
        .filter((excerpt) => numberOf.has(excerpt.id))
        .map((excerpt) => ({ ...excerpt, citationNumber: numberOf.get(excerpt.id) as number }))
        .sort((a, b) => a.citationNumber - b.citationNumber),
    }))
    .filter((document) => document.excerpts.length > 0)
    .sort((a, b) => a.excerpts[0]!.citationNumber - b.excerpts[0]!.citationNumber);

  const citations = cited
    .flatMap((document) =>
      document.excerpts.map((excerpt) => ({
        number: excerpt.citationNumber,
        excerptId: excerpt.id,
        documentId: document.id,
      })),
    )
    .sort((a, b) => a.number - b.number);

  return { content: rewritten, documents: cited, citations };
}

/** By document (genki's default): `[n]` is document n by first appearance; no excerpt is numbered. */
export function citeDocuments(content: string, documents: SourceDocument[]): CitedAnswer {
  const numbered = documents.map((document, index) => ({
    ...document,
    citationNumber: index + 1,
    excerpts: document.excerpts.map(({ citationNumber: _number, ...excerpt }) => excerpt),
  }));
  return {
    content,
    documents: numbered,
    citations: numbered.map((document) => ({
      number: document.citationNumber,
      documentId: document.id,
    })),
  };
}

/** What each `[n]` names, for every path (decisions/0014): by markers, else by document. */
export function citeAnswer(
  content: string,
  documents: SourceDocument[],
  markers: MarkerRef[] | undefined,
): CitedAnswer {
  return markers === undefined
    ? citeDocuments(content, documents)
    : citeExcerpts(content, documents, markers);
}
