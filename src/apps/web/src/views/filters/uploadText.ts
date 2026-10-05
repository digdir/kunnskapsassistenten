import { MAX_UPLOAD_BYTES, type UploadErrorCode } from '../../model';

/**
 * What to say about an upload that did not work, in Norwegian.
 *
 * One table for two places, and that is the point. A refused file in the list
 * and a drop zone that is switched off in live mode are the same four causes
 * — `useUserDocuments` reports both as an {@link UploadErrorCode} for exactly
 * this reason (asked for by #2, 21.09) — and two tables would drift into
 * saying different things about one cause.
 *
 * `unavailable` is not a failure the reader caused or can retry: there is no
 * upload endpoint at all (API-bestilling A3). It says so instead of «noe gikk
 * galt», which would send them off looking for a mistake they did not make.
 */
/**
 * The limit in words, written once.
 *
 * Mebibytes, because `MAX_UPLOAD_BYTES` is 20 × 1024 × 1024 and the number a
 * reader is told has to be the number the check uses. {@link fileSize} counts
 * in decimal units like a file manager does, and would call the same limit
 * «21 MB» — true, and two different numbers for one rule.
 */
export const MAX_UPLOAD_TEXT = `${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`;

const UPLOAD_ERROR_TEXT: Record<UploadErrorCode, string> = {
  'too-large': `Filen er større enn ${MAX_UPLOAD_TEXT}.`,
  'wrong-type': 'Bare PDF og .docx kan lastes opp.',
  failed: 'Opplastingen mislyktes. Prøv igjen.',
  unavailable: 'Opplasting er ikke tilgjengelig i denne tjenesten ennå.',
};

/**
 * What the zone says where there is nowhere to upload to yet.
 *
 * Not the `unavailable` sentence above, which is a refusal: nothing was tried
 * here, so there is nothing to refuse. It is Simen's wording (30.09), and it
 * is word for word what the compose field's paper clip says (#3,
 * src/views/chat/attachmentText.ts): one missing feature, one sentence,
 * wherever the reader meets it (KA CC, 30.09). Two views may not import each
 * other, so if it changes, it changes in both places.
 */
export const UPLOAD_COMING_TEXT = 'Snart kan du laste opp dokumenter her';

export function uploadErrorText(code: UploadErrorCode): string {
  return UPLOAD_ERROR_TEXT[code];
}

/**
 * A file size a reader can read, in Norwegian.
 *
 * Decimal units and not binary: a reader who sees «2,4 MB» here and 2,4 MB in
 * their own file manager should see the same number, and every file manager
 * on every platform they use counts in thousands. The unit is the largest one
 * that leaves a number below 1000, so nothing reads «0,002 MB».
 *
 * One decimal from a megabyte up, none below: «812 kB» is exact enough to
 * recognise a file by, and «812,4 kB» is four characters of noise in a panel
 * that pays for every line.
 */
export function fileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1000) return `${Math.round(bytes)} B`;

  const kilobytes = bytes / 1000;
  if (kilobytes < 1000) return `${Math.round(kilobytes)} kB`;

  const megabytes = kilobytes / 1000;
  const unit = megabytes < 1000 ? 'MB' : 'GB';
  const value = megabytes < 1000 ? megabytes : megabytes / 1000;

  return `${value.toLocaleString('nb-NO', { maximumFractionDigits: 1 })} ${unit}`;
}
