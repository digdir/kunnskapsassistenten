import type { UserDocument } from '../model';
import { createUploadClient } from './uploadFactory';

/**
 * The reader's own documents, as state two views share.
 *
 * A module store and not a context, for the reason src/api/corpus.ts gives at
 * length: the parties are in different places. The compose field (#3) starts
 * an upload, «Dine dokumenter» in the filter panel (#2) draws the list, and
 * the sources panel (#4) reads what an answer cited. A context would have to
 * sit above all three, and the client that does the work is not a component
 * at all.
 *
 * The list here is the truth on screen — including documents that are still
 * uploading, which the CLIENT never stores. Only a finished document reaches
 * `localStorage`; a bar at 40 % is a fact about this page, not something to
 * restore after a reload as an upload that will never continue.
 */
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

/**
 * Swap the pending row for the finished one, in place.
 *
 * In place, so the row does not jump to the end of the list the moment it
 * finishes. Under the CLIENT's id and not the pending one: the client is what
 * stores the document, so if the store kept its own id the two would disagree
 * and `remove` would match neither. Measured the first time this was written
 * the other way round — the row vanished from the list and stayed in
 * `localStorage`.
 */
function replace(pendingId: string, finished: UserDocument): void {
  const index = documents.findIndex((existing) => existing.id === pendingId);
  documents = index === -1 ? [...documents, finished] : documents.toSpliced(index, 1, finished);
  announce();
}

/**
 * Read what was stored, once per page.
 *
 * Idempotent on purpose: every view that shows documents calls it on mount,
 * and three panels asking at once must not produce three lists.
 */
export async function loadUserDocuments(): Promise<void> {
  if (loaded) return;
  loaded = true;
  documents = await createUploadClient().list();
  announce();
}

/**
 * Upload one file, with the row appearing at once and the bar moving.
 *
 * The row is put in the list BEFORE the client is called, at 0 %, because
 * that is what makes the wait legible: a reader who picked a file sees it
 * land immediately. It is replaced by whatever the client resolves with —
 * ready or failed — under the same id.
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
    // Only an abort reaches here — see `UploadClient`. The row goes away,
    // because the reader cancelled it and a cancelled upload is not a failure
    // to read about.
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
