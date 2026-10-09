/**
 * «Utdrag 1–3», «Utdrag 1, 2, 5», or nothing for a document never cited, so the
 * reader can tell excerpt numbers from document numbers.
 */
export function excerptRange(numbers: (number | undefined)[]): string {
  const sorted = numbers.filter((number) => number !== undefined).sort((a, b) => a - b);
  if (sorted.length === 0) return '';

  const unbroken = sorted.every((number, index) => index === 0 || number === sorted[index - 1] + 1);

  if (sorted.length === 1) return `Utdrag ${sorted[0]}`;
  if (unbroken) return `Utdrag ${sorted[0]}–${sorted[sorted.length - 1]}`;

  return `Utdrag ${sorted.join(', ')}`;
}
