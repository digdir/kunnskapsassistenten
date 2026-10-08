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
 * A file whose name starts with this always fails, however valid it is.
 *
 * The error path needs to be reachable on demand. Every other failure here
 * depends on having a file of the wrong kind or the wrong size to hand, and
 * «find a 21 MB PDF» is a poor way to look at an error state. Prefix and not
 * an exact name so a reader can try `feil-rapport.pdf` and `feil2.docx`
 * without learning a magic string.
 */
export const ALWAYS_FAILS_PREFIX = 'feil';

/** How long a mock upload takes, start to finish. */
const UPLOAD_MS = 1500;
const TICKS = 15;

function newId(): string {
  return crypto.randomUUID?.() ?? `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Reads what is stored, and never lets a bad entry cost the whole list.
 *
 * Anything unreadable is dropped rather than thrown: this is a convenience
 * store in the browser, and a reader whose list will not load has lost their
 * documents for no reason a reload could fix.
 */
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
 * The reader's own documents, in the browser.
 *
 * **Metadata only, never the file.** Name, type, size and status are kept in
 * `localStorage`; the bytes are read for nothing and dropped. That is not a
 * shortcut, it is the honest shape of a mock with no backend behind it: a
 * document the mock «has» cannot be searched, and storing megabytes of base64
 * in `localStorage` would fill the quota and pretend otherwise.
 *
 * The limits are the ones the design promises: PDF and .docx, 20 MB. They are
 * enforced here so the whole flow — refusal, message, the document appearing
 * as failed — can be built and seen before A3 exists.
 */
export class MockUploadClient implements UploadClient {
  /**
   * Undefined, because uploading works here. Declared rather than left off so
   * the two clients are visibly answering the same question.
   */
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
      // Something has to be recorded for a file we refuse, and the name is
      // what the reader sees. `pdf` is the placeholder; `errorCode` is what
      // says the type was the problem.
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

    // Checked before any waiting: a file that cannot be taken should be
    // refused at once, not after a second and a half of a bar that was
    // never going anywhere.
    if (type === undefined) return refuse('wrong-type');
    if (file.size > MAX_UPLOAD_BYTES) return refuse('too-large');

    for (let tick = 1; tick <= TICKS; tick += 1) {
      await sleep(UPLOAD_MS / TICKS);
      if (signal?.aborted) throw signal.reason ?? new Error('Opplastingen ble avbrutt.');
      onProgress?.(Math.round((tick / TICKS) * 100));
    }

    if (file.name.toLocaleLowerCase('nb-NO').startsWith(ALWAYS_FAILS_PREFIX)) {
      /*
       * After the progress, not before: this is the failure that happens on
       * the way home, which is the one a view has to draw over a bar that had
       * already filled.
       *
       * Not written to storage, the same as a file refused before it started.
       * A failure is something to see and try again after, not a document —
       * and one that survived a reload would come back as a dead row with a
       * full bar and no way to retry it. One rule for both: a failed upload
       * lives in the session, never in the store. Found by KA CC on #117.
       */
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
