import { userDocumentType, type UploadErrorCode, type UserDocument } from '../../model';
import type { UploadClient, UploadProgress } from '../uploadClient';

/**
 * The upload client for a backend with no upload endpoint. It calls nothing and returns a failed
 * document with `unavailable`, so the file is listed with a reason. A file of the wrong type is
 * still refused as `wrong-type`, so the reader looks for the right problem.
 */
export class LiveUploadClient implements UploadClient {
  /** Known up front, so the drop zone can say so before anyone picks a file. */
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
