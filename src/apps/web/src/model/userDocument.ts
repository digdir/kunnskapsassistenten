// A document the reader uploaded. It belongs to the reader, not the thread, so it survives
// leaving one. The backend has no upload endpoint yet (src/api/live/LiveUploadClient.ts).

/** PDF and .docx, the two types the design promises under the upload box. */
export type UserDocumentType = 'pdf' | 'docx';

export type UserDocumentStatus = 'uploading' | 'ready' | 'failed';

// Why an upload failed; kebab case like `ChatErrorCode`. `unavailable` means there is no
// endpoint: not the reader's fault, not worth retrying, and the view must say so.
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
  /** 0–100 while uploading. The design draws a bar; the mock invents the number. */
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
 * By extension, not `File.type`: browsers disagree about the MIME type of
 * `.docx`, and a file dragged from an archive can carry none.
 */
export function userDocumentType(name: string): UserDocumentType | undefined {
  const lower = name.toLocaleLowerCase('nb-NO');
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  return undefined;
}
