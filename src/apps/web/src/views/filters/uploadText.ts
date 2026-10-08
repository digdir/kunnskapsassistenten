import { MAX_UPLOAD_BYTES, type UploadErrorCode } from '../../model';

/** The limit in words, in mebibytes like the check (`MAX_UPLOAD_BYTES`); {@link fileSize}
    counts in decimal units and would say «21 MB». */
export const MAX_UPLOAD_TEXT = `${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`;

const UPLOAD_ERROR_TEXT: Record<UploadErrorCode, string> = {
  'too-large': `Filen er større enn ${MAX_UPLOAD_TEXT}.`,
  'wrong-type': 'Bare PDF og .docx kan lastes opp.',
  failed: 'Opplastingen mislyktes. Prøv igjen.',
  unavailable: 'Opplasting er ikke tilgjengelig i denne tjenesten ennå.',
};

/** What the zone says while there is nowhere to upload to; not a refusal, as nothing was tried.
    Word for word the compose field's (src/views/chat/attachmentText.ts); views may not import
    each other, so change both. */
export const UPLOAD_COMING_TEXT = 'Snart kan du laste opp dokumenter her';

/** An upload failure in Norwegian, from one table for the file list and the drop zone.
    `unavailable` says there is no upload at all rather than «noe gikk galt», so the reader
    does not look for a mistake they did not make. */
export function uploadErrorText(code: UploadErrorCode): string {
  return UPLOAD_ERROR_TEXT[code];
}

/** A file size in Norwegian, in decimal units as file managers count, so the numbers match.
    One decimal from MB up; below that the whole number is exact enough. */
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
