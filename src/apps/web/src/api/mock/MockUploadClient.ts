import {
  MAX_UPLOAD_BYTES,
  userDocumentType,
  type UploadErrorCode,
  type UserDocument,
} from '../../model';
import type { UploadClient, UploadProgress } from '../uploadClient';

/** Where the metadata lives. Versioned like `ka.layout.v1`. */
export const DOCUMENTS_STORAGE_KEY = 'ka.documents.v1';

/**
 * A file whose name starts with this always fails, however valid it is, so
 * the error state can be reached without a file of the wrong kind or size.
 * A prefix so `feil-rapport.pdf` and `feil2.docx` both work.
 */
export const ALWAYS_FAILS_PREFIX = 'feil';

/** How long a mock upload takes, start to finish. */
const UPLOAD_MS = 1500;
const TICKS = 15;

function newId(): string {
  return crypto.randomUUID?.() ?? `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Anything unreadable is dropped rather than thrown, so one bad entry never costs the list.
function read(): UserDocument[] {
  try {
    const raw = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is UserDocument =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as UserDocument).id === 'string' &&
        typeof (entry as UserDocument).name === 'string',
    );
  } catch {
    return [];
  }
}

function write(documents: UserDocument[]): void {
  try {
    localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(documents));
  } catch {
    // Private mode, blocked or full storage. The list stands for this page.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The reader's documents, metadata only, in `localStorage`: with no backend the file cannot be
 * searched anyway, and base64 would fill the quota. Enforces the design's limits (PDF, .docx,
 * 20 MB) so the flow can be built before there is an upload endpoint.
 */
export class MockUploadClient implements UploadClient {
  /** Undefined: uploading works here. Declared so both clients answer the same question. */
  readonly unavailable = undefined;

  async upload(
    file: File,
    onProgress?: UploadProgress,
    signal?: AbortSignal,
  ): Promise<UserDocument> {
    const type = userDocumentType(file.name);
    const base = {
      id: newId(),
      name: file.name,
      // A refused file still needs a type; `errorCode` says the type was the problem.
      type: type ?? 'pdf',
      size: file.size,
      uploadedAt: new Date().toISOString(),
    } as const;

    const refuse = (errorCode: UploadErrorCode): UserDocument => ({
      ...base,
      status: 'failed',
      progress: 0,
      errorCode,
    });

    // Refused at once, not after a progress bar that was never going anywhere.
    if (type === undefined) return refuse('wrong-type');
    if (file.size > MAX_UPLOAD_BYTES) return refuse('too-large');

    for (let tick = 1; tick <= TICKS; tick += 1) {
      await sleep(UPLOAD_MS / TICKS);
      if (signal?.aborted) throw signal.reason ?? new Error('Opplastingen ble avbrutt.');
      onProgress?.(Math.round((tick / TICKS) * 100));
    }

    if (file.name.toLocaleLowerCase('nb-NO').startsWith(ALWAYS_FAILS_PREFIX)) {
      // After the progress: the failure on the way home, over a full bar. Not stored: after a
      // reload it would be a dead row with no way to retry.
      return { ...refuse('failed'), progress: 100 };
    }

    const ready: UserDocument = { ...base, status: 'ready', progress: 100 };
    write([...read(), ready]);
    return ready;
  }

  async remove(id: string): Promise<void> {
    write(read().filter((document) => document.id !== id));
  }

  async list(): Promise<UserDocument[]> {
    return read();
  }
}
