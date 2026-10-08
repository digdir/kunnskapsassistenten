/**
 * A document the reader uploaded themselves.
 *
 * **It belongs to the reader, not to the thread.** It lives under «Dine
 * dokumenter» in the filter panel and is part of the document selection like
 * anything from the corpus — so it survives a thread being left, and a
 * question in a new thread can be asked of it. `AskParams.attachments` is the
 * other half: which of them THIS question was asked with.
 *
 * backend: mangler, se API-bestilling A3 — there is no upload endpoint at
 * all. The whole flow is built here and in the mock; the live client says so
 * honestly rather than pretending. See src/api/live/LiveUploadClient.ts.
 */

/**
 * What the reader may upload. Two, because that is what the design promises
 * under the upload box: «Når den kommer, tar den PDF og .docx».
 */
export type UserDocumentType = 'pdf' | 'docx';

export type UserDocumentStatus = 'uploading' | 'ready' | 'failed';

/**
 * Why an upload did not work.
 *
 * Kebab case like {@link ChatErrorCode}, and for the same reason: these end
 * up in lookup tables of Norwegian sentences, and one vocabulary across the
 * app beats two. The brief wrote `UPLOAD_UNAVAILABLE`; this is that code,
 * spelled the way every other code in this model is spelled.
 *
 * `unavailable` is the honest one. It is not a failure the reader caused or
 * can retry — there is no endpoint — and a view must be able to say that
 * rather than «noe gikk galt».
 */
const UPLOAD_ERROR_CODES = ['too-large', 'wrong-type', 'failed', 'unavailable'] as const;

export type UploadErrorCode = (typeof UPLOAD_ERROR_CODES)[number];

/** A code from outside, narrowed to one we know. See `chatErrorCode`. */
export function uploadErrorCode(value: unknown): UploadErrorCode {
  return UPLOAD_ERROR_CODES.find((code) => code === value) ?? 'failed';
}

/** The largest file the mock accepts, and what a view should say it accepts. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export interface UserDocument {
  id: string;
  /** The file name, shown as the document title. */
  name: string;
  type: UserDocumentType;
  /** Bytes. Kept so a view can show «2,4 MB» without holding the file. */
  size: number;
  status: UserDocumentStatus;
  /**
   * 0–100 while `status` is `uploading`, 100 once it is `ready`.
   *
   * A number and not a boolean, because the design draws a bar. It is the
   * mock's own invention: a real upload would get this from the request, and
   * A3 will have to say whether the backend can report it at all.
   */
  progress: number;
  /** ISO 8601. When the upload finished, or when it was attempted. */
  uploadedAt: string;
  /** Set only when `status` is `failed`. */
  errorCode?: UploadErrorCode;
}

/**
 * Which file types the picker should accept, as an `accept` attribute.
 * One place, so the picker and the validation cannot drift apart.
 */
export const UPLOAD_ACCEPT = '.pdf,.docx,application/pdf';

/**
 * The type of a file by its name, or undefined when it is not one we take.
 *
 * By extension and not by `File.type`: browsers disagree about the MIME type
 * of `.docx` — Chrome says the long OpenXML string, some say
 * `application/octet-stream`, and a file dragged from an archive can carry
 * nothing at all. The extension is what the reader sees and what the `accept`
 * attribute filters on.
 */
export function userDocumentType(name: string): UserDocumentType | undefined {
  const lower = name.toLocaleLowerCase('nb-NO');
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  return undefined;
}
