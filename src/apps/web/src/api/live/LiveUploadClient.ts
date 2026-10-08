import { userDocumentType, type UploadErrorCode, type UserDocument } from '../../model';
import type { UploadClient, UploadProgress } from '../uploadClient';

/**
 * The upload client against a backend that has no upload.
 *
 * **It calls nothing.** There is no endpoint — API-bestilling A3 — and a
 * client that POSTed somewhere hopeful would turn a known gap into a 404 the
 * reader has to interpret. It refuses immediately, with the one code that
 * means «not you, and not worth retrying»: `unavailable`.
 *
 * The refusal is a document with `status: 'failed'` rather than a throw, for
 * the reason the interface gives: the file has to appear in the list saying
 * why, or the reader is left with a picker that seems to do nothing.
 *
 * It still reads the file NAME to type it, so the refusal is the honest one
 * even in live mode: a `.png` is refused for being a `.png`, and only a file
 * we would otherwise have taken is refused for the missing endpoint. A reader
 * who gets «støtter ikke dette filformatet» for a PDF would go looking for
 * the wrong problem.
 *
 * `list` is empty and `remove` does nothing, both truthfully: nothing was
 * ever stored anywhere, so there is nothing to list and nothing to take away.
 */
export class LiveUploadClient implements UploadClient {
  /**
   * Known before anyone picks a file: there is no endpoint, and there will
   * not be one until A3. The drop zone reads this and says so up front
   * instead of taking a file and handing it back.
   */
  readonly unavailable: UploadErrorCode = 'unavailable';

  async upload(file: File, _onProgress?: UploadProgress): Promise<UserDocument> {
    const type = userDocumentType(file.name);

    return {
      id: `unavailable-${Date.now()}`,
      name: file.name,
      type: type ?? 'pdf',
      size: file.size,
      status: 'failed',
      progress: 0,
      uploadedAt: new Date().toISOString(),
      errorCode: type === undefined ? 'wrong-type' : 'unavailable',
    };
  }

  async remove(): Promise<void> {
    // Nothing was stored, so there is nothing to forget.
  }

  async list(): Promise<UserDocument[]> {
    return [];
  }
}
