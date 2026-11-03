import type { SourceDocument } from '../../model';
import { citeExcerpts, type CitedAnswer, type MarkerRef } from '../excerptCitations';

/**
 * The mock's answers in the shape genki is asked to send (digdir/genki#273), so CI runs the same
 * mapping as live and real data drops in behind it. CI only: nobody working with KA sees the mock.
 *
 * The scripts write `[n]` for their n-th excerpt. Here that becomes what genki would write, one
 * marker per excerpt as `[document.excerpt]` with a `{ marker, chunkId, documentId }` for each,
 * and then `citeExcerpts` numbers the cited excerpts 1, 2, 3 in the order the answer first cites
 * them, drops the ones nothing cites, and drops a marker whose excerpt is not there.
 */
export function asGenkiCites(
  answer: string,
  documents: SourceDocument[],
): {
  answer: string;
  documents: SourceDocument[];
  markers: MarkerRef[];
} {
  const genkiMarker = new Map<number, string>();
  const markers: MarkerRef[] = [];
  const plain = documents.map((document, d) => ({
    ...document,
    excerpts: document.excerpts.map((excerpt, e) => {
      const { citationNumber, ...rest } = excerpt;
      const marker = `${d + 1}.${e + 1}`;
      markers.push({ marker, chunkId: excerpt.id, documentId: document.id });
      if (citationNumber !== undefined) genkiMarker.set(citationNumber, marker);
      return rest;
    }),
  }));
  // A `[n]` with no excerpt keeps a marker nothing resolves, as an invalid one from genki would.
  const written = answer.replace(/\[(\d{1,3})\]/g, (_whole, n: string) => {
    const marker = genkiMarker.get(Number(n));
    return marker === undefined ? `[${n}.0]` : `[${marker}]`;
  });
  return { answer: written, documents: plain, markers };
}

/** A mock answer as KA shows it, through the same mapping as live. */
export function citedMockAnswer(answer: string, documents: SourceDocument[]): CitedAnswer {
  const contract = asGenkiCites(answer, documents);
  return citeExcerpts(contract.answer, contract.documents, contract.markers);
}
