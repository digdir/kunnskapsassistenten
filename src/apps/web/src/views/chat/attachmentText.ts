import { MAX_UPLOAD_BYTES, type UploadErrorCode } from '../../model';

/** How many whole megabytes the limit is, for a sentence to name it. */
const MAX_MEGABYTES = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));

// One sentence per case. `unavailable` is not the file's fault and says so:
// there is no upload endpoint (API-bestilling A3), so «prøv igjen» would
// send someone round a loop that cannot close.
const UPLOAD_ERROR_TEXT: Record<UploadErrorCode, string> = {
  'too-large': `Filen er større enn ${MAX_MEGABYTES} MB.`,
  'wrong-type': 'Filtypen støttes ikke. Last opp PDF eller .docx.',
  failed: 'Opplastingen gikk ikke gjennom.',
  unavailable: 'Opplasting er ikke tilgjengelig i denne tjenesten ennå.',
};

/** What to say about a file that was refused. */
export function uploadErrorText(code: UploadErrorCode): string {
  return UPLOAD_ERROR_TEXT[code];
}

/** Whether trying the same file again could work: only the general failure.
    A file too large or of the wrong type is the same file next time, and
    `unavailable` has no endpoint to reach however often it is asked. */
export function uploadRetryable(code: UploadErrorCode): boolean {
  return code === 'failed';
}

/** The paperclip. It says what it takes, since the picker filters silently. */
export const ATTACH_LABEL = 'Legg ved dokument (PDF eller .docx)';

/** Why a question did not go while a file was on its way: only ready
    documents are sent, so sending now would drop the file the reader just
    attached. */
export const WAIT_FOR_UPLOADS = 'Vent til vedlegget er lastet opp.';

/** What the attachment strip is called, for the list that holds the chips. */
export const ATTACHMENTS_LABEL = 'Vedlegg til spørsmålet';

/** Drop a file anywhere on the compose field. */
export const DROP_HINT = 'Slipp filen for å legge den ved';

/** Remove one, on the chip itself. */
export function removeAttachmentLabel(name: string): string {
  return `Fjern vedlegget ${name}`;
}

/** Try one again, when trying again is the thing to do. */
export function retryAttachmentLabel(name: string): string {
  return `Prøv å laste opp ${name} på nytt`;
}

/** What the polite region says when a file starts on its way: once, and
    without a number. Read aloud, a percentage is a dozen sentences saying
    the same thing and ending on a stale one. */
export function uploadStartedAnnouncement(name: string): string {
  return `Laster opp ${name}.`;
}

export function uploadReadyAnnouncement(name: string): string {
  return `${name} er lastet opp og lagt ved.`;
}

export function uploadFailedAnnouncement(name: string, code: UploadErrorCode): string {
  return `${name} ble ikke lagt ved. ${uploadErrorText(code)}`;
}

/** On the reader's own message, once the question has been sent. */
export function attachmentsOnMessage(names: string[]): string {
  return `Med vedlegg: ${names.join(', ')}`;
}
