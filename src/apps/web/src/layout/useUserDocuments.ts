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
  /** Why uploading cannot work here, before a file is picked. A code, so messages are shared. */
  unavailable?: UploadErrorCode;
  /** Take a file. Resolves with the finished document, ready or failed. */
  upload: (file: File, signal?: AbortSignal) => Promise<UserDocument>;
  remove: (id: string) => Promise<void>;
};

/**
 * The reader's own documents, from the store in src/api/userDocuments.ts. `ready` is what a
 * question can use, since a failed document cannot be searched; `documents` keeps failures so a
 * refused file can say why.
 */
export function useUserDocuments(): UserDocuments {
  const documents = useSyncExternalStore(subscribeToUserDocuments, userDocuments);

  // Loads what was stored, once per page however many views ask. An effect because it touches
  // storage, and the first render (an empty list) is correct without it.
  useEffect(() => {
    void loadUserDocuments();
  }, []);

  const upload = useCallback(
    (file: File, signal?: AbortSignal) => uploadUserDocument(file, signal),
    [],
  );
  const remove = useCallback((id: string) => removeUserDocument(id), []);

  // Read from the client, not held as state: it depends on the build mode and cannot change
  // while the page is open.
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
