import type { UploadErrorCode, UserDocument } from '../model';

/** Reports how far an upload has come, 0–100. */
export type UploadProgress = (percent: number) => void;

/**
 * The reader's own documents. `upload` resolves a rejected file as `failed`, so
 * the list can show which file was refused and why; only an abort throws. The
 * backend has no upload endpoint yet, so the live client refuses.
 */
export interface UploadClient {
  /** Why uploading cannot work here, known before a file is picked: a code the view can explain. */
  readonly unavailable?: UploadErrorCode;

  /** Take one file; resolves ready or failed, and throws only on abort, with its reason. */
  upload(file: File, onProgress?: UploadProgress, signal?: AbortSignal): Promise<UserDocument>;
  /** Forget a document. Removing one that is not there is not an error. */
  remove(id: string): Promise<void>;
  /** Everything the reader has uploaded, newest last. */
  list(): Promise<UserDocument[]>;
}
