import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  createUploadClient,
  loadUserDocuments,
  removeUserDocument,
  subscribeToUserDocuments,
  uploadUserDocument,
  userDocuments,
} from '../api';
import type { UploadErrorCode, UserDocument } from '../model';

export type UserDocuments = {
  /** Everything the reader has uploaded, newest last. */
  documents: UserDocument[];
  /** The ones an answer can actually be asked of. */
  ready: UserDocument[];
  /** True while at least one is still on its way. */
  uploading: boolean;
  /**
   * Why uploading cannot work here at all, known before anyone picks a file.
   * Undefined means it works.
   *
   * The drop zone reads this to say the honest thing up front in live mode,
   * rather than taking a file and refusing it a moment later. A code and not
   * a boolean, so the same Norwegian sentences that cover a refused file
   * cover a switched-off zone. Asked for by #2, 21.09.
   */
  unavailable?: UploadErrorCode;
  /** Take a file. Resolves with the finished document, ready or failed. */
  upload: (file: File, signal?: AbortSignal) => Promise<UserDocument>;
  remove: (id: string) => Promise<void>;
};

/**
 * The reader's own documents, for the views that show or change them.
 *
 * The React end of the store in src/api/userDocuments.ts, the same shape
 * `useCorpus` has: `useSyncExternalStore` reads during render, so the first
 * paint after an upload is already right.
 *
 * Three views use it and want different halves. The compose field (#3)
 * uploads and needs `uploading`; «Dine dokumenter» (#2) draws `documents`,
 * failures included, because a refused file has to say why it was refused;
 * whatever attaches documents to a question wants `ready`, since a document
 * that failed cannot be searched.
 */
export function useUserDocuments(): UserDocuments {
  const documents = useSyncExternalStore(subscribeToUserDocuments, userDocuments);

  // Reads what was stored, once per page however many views ask. An effect
  // and not a render-time call: it is a side effect that touches storage, and
  // the first render is correct without it — an empty list is what a reader
  // with no documents has.
  useEffect(() => {
    void loadUserDocuments();
  }, []);

  const upload = useCallback(
    (file: File, signal?: AbortSignal) => uploadUserDocument(file, signal),
    [],
  );
  const remove = useCallback((id: string) => removeUserDocument(id), []);

  // Read from the client rather than held as state: it is a property of the
  // mode the app was built in and cannot change while the page is open.
  const unavailable = createUploadClient().unavailable;

  return useMemo(
    () => ({
      documents,
      ready: documents.filter((document) => document.status === 'ready'),
      uploading: documents.some((document) => document.status === 'uploading'),
      ...(unavailable ? { unavailable } : {}),
      upload,
      remove,
    }),
    [documents, unavailable, upload, remove],
  );
}
