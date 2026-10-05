import { MAX_UPLOAD_BYTES, type UploadErrorCode } from '../../model';

/** How many whole megabytes the limit is, for a sentence to name it. */
const MAX_MEGABYTES = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));

/**
 * Why a file did not make it, one sentence per case.
 *
 * Looked up from the code rather than written where the failure was caught,
 * the same reasoning `errorText.ts` gives for a failed turn: four situations
 * that need four different things from the reader, and «noe gikk galt» says
 * none of them.
 *
 * `unavailable` is the one that is not the reader's file's fault, and it says
 * so. There is no upload endpoint at all (API-bestilling A3), so «prøv igjen»
 * would send someone round a loop that cannot close — the sentence names the
 * service rather than the file.
 */
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

/**
 * Whether trying the same file again could work.
 *
 * Only the general failure. A file that is too large or of the wrong type is
 * the same file next time, and there is no endpoint for `unavailable` to
 * reach however many times it is asked — so «Prøv igjen» is drawn on one of
 * the four and «Fjern» on all of them. Same rule as `retryable` in
 * errorText.ts, for the same reason.
 */
export function uploadRetryable(code: UploadErrorCode): boolean {
  return code === 'failed';
}

/** The paperclip. It says what it takes, since the picker filters silently. */
export const ATTACH_LABEL = 'Legg ved dokument (PDF eller .docx)';

/**
 * The paperclip where there is nothing to upload to.
 *
 * The reason is IN the name, so it is known before a file is picked rather
 * than after one is refused. A control that takes a file and then says it
 * cannot have made the reader do work for nothing (KA CC on #125).
 *
 * Written on the button rather than hidden in an `aria-label`, which is how
 * Simen drew it (issue 79): a paperclip alone says «attach», and the one
 * thing worth knowing here is that attaching is coming rather than broken.
 * Visible text and no label means the accessible name IS the sentence on
 * screen, which is what WCAG 2.5.3 asks of a control someone can say out
 * loud. `uploadErrorText('unavailable')` still says the same thing the longer
 * way, under the field, for anyone who presses it anyway.
 */
export const ATTACH_UNAVAILABLE_LABEL = 'Snart kan du laste opp dokumenter her';

/**
 * Why a question did not go while a file was still on its way.
 *
 * Only ready documents are sent, so sending now would drop the file the
 * reader just attached. Saying so beats a send button that does nothing, and
 * beats sending the question without the thing it was about.
 */
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

/**
 * What the polite region says when a file starts on its way.
 *
 * Once, and without a number. The percentage is drawn in the chip for anyone
 * watching it; read aloud it is eighteen sentences that say the same thing
 * eighteen times and end on a stale one.
 */
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
