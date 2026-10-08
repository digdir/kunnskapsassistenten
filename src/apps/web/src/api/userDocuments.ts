import type { UserDocument } from '../model';
import { createUploadClient } from './uploadFactory';

// The reader's own documents, shared by the compose field, the filter panel and
// the sources panel (a store for the reason corpus.ts gives). Uploads in
// progress live only here and are never stored: one cannot resume after a reload.
let documents: UserDocument[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function announce(): void {
  for (const listener of [...listeners]) listener();
}

/** The list as it stands. Stable between changes, so `useSyncExternalStore` is happy. */
export function userDocuments(): UserDocument[] {
  return documents;
}

export function subscribeToUserDocuments(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Put one in, or replace it by id. Newest last. */
function put(document: UserDocument): void {
  const index = documents.findIndex((existing) => existing.id === document.id);
  documents = index === -1 ? [...documents, document] : documents.toSpliced(index, 1, document);
  announce();
}

// Swap the pending row for the finished one in place, so it does not jump to
// the end. Under the client's id, the one it stores and `remove` must match.
function replace(pendingId: string, finished: UserDocument): void {
  const index = documents.findIndex((existing) => existing.id === pendingId);
  documents = index === -1 ? [...documents, finished] : documents.toSpliced(index, 1, finished);
  announce();
}

/** Read what was stored, once per page, though every view calls it on mount. */
export async function loadUserDocuments(): Promise<void> {
  if (loaded) return;
  loaded = true;
  documents = await createUploadClient().list();
  announce();
}

/**
 * Upload one file. The row goes in at 0 % before the client is called, so the
 * reader sees it land at once, and is replaced by the result, ready or failed.
 */
export async function uploadUserDocument(file: File, signal?: AbortSignal): Promise<UserDocument> {
  const pending: UserDocument = {
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    type: 'pdf',
    size: file.size,
    status: 'uploading',
    progress: 0,
    uploadedAt: new Date().toISOString(),
  };
  put(pending);

  try {
    const finished = await createUploadClient().upload(
      file,
      (progress) => put({ ...pending, progress }),
      signal,
    );
    replace(pending.id, finished);
    return finished;
  } catch (error) {
    // Only an abort reaches here (see `UploadClient`). The reader cancelled, so
    // the row goes rather than showing as failed.
    documents = documents.filter((document) => document.id !== pending.id);
    announce();
    throw error;
  }
}

export async function removeUserDocument(id: string): Promise<void> {
  await createUploadClient().remove(id);
  documents = documents.filter((document) => document.id !== id);
  announce();
}

/** Tests only: forget everything this module is holding. */
export function resetUserDocumentsForTest(): void {
  documents = [];
  loaded = false;
  announce();
}
