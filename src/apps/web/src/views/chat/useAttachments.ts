import { useCallback, useRef, useState } from 'react';
import { useUserDocuments } from '../../layout/useUserDocuments';
import { userDocumentType, type UploadErrorCode, type UserDocument } from '../../model';

/** One file the reader attached. A slot of its own, because the document
    does not exist yet when the chip appears, and the pending row is REPLACED
    under a different id when the client resolves. */
export type Attachment = {
  /** This composer's own key. Stable from the moment the file was picked. */
  key: string;
  name: string;
  size: number;
  /** The document, once `upload` has resolved. Ready or failed. */
  document?: UserDocument;
  /** Set instead of `document` when the file was refused before it was sent. */
  errorCode?: UploadErrorCode;
  /** The file itself, kept so «Prøv igjen» has something to try again. */
  file: File;
};

/** What a chip needs to draw itself, whichever phase the slot is in. */
export type AttachmentView = {
  key: string;
  name: string;
  status: 'uploading' | 'ready' | 'failed';
  /** 0–100 while uploading. */
  progress: number;
  errorCode?: UploadErrorCode;
  /** The id to send with the question. Only ready attachments have one. */
  documentId?: string;
};

export type Attachments = {
  items: AttachmentView[];
  /** The ids to send: ready only. A refused file is not part of the question. */
  readyIds: string[];
  /** True while at least one of THIS question's files is still on its way. */
  busy: boolean;
  /** Why attaching cannot work here at all, known before a file is picked. */
  unavailable?: UploadErrorCode;
  add: (files: FileList | File[]) => void;
  remove: (key: string) => void;
  retry: (key: string) => void;
  /** Forget them all, once the question carrying them has been sent. */
  clear: () => void;
};

/** The files THIS question is asked with, which is not «Dine dokumenter»: a
    document survives the thread, this empties when the question is sent. A
    refused file still gets a chip, or it did not attach silently. */
export function useAttachments(): Attachments {
  const { documents, upload, unavailable } = useUserDocuments();
  const [items, setItems] = useState<Attachment[]>([]);
  // Abort controllers per slot, so removing a file that is still uploading
  // stops the upload rather than leaving it to finish into nothing.
  const aborts = useRef(new Map<string, AbortController>());

  const start = useCallback(
    (attachment: Attachment) => {
      const controller = new AbortController();
      aborts.current.set(attachment.key, controller);

      void upload(attachment.file, controller.signal)
        .then((document) => {
          setItems((current) =>
            current.map((item) => (item.key === attachment.key ? { ...item, document } : item)),
          );
        })
        .catch(() => {
          // Only an abort reaches here, and an abort is the reader removing
          // the chip — the slot is already gone.
        })
        .finally(() => aborts.current.delete(attachment.key));
    },
    [upload],
  );

  const add = useCallback(
    (files: FileList | File[]) => {
      for (const file of [...files]) {
        const key = newKey();
        // Refused before the client is asked in the two cases where asking
        // would be theatre: a file we do not take, and a service with no
        // endpoint. Everything else goes to the client, which decides.
        const wrongType = userDocumentType(file.name) === undefined;
        const refused = unavailable ?? (wrongType ? 'wrong-type' : undefined);

        const attachment: Attachment = {
          key,
          name: file.name,
          size: file.size,
          file,
          ...(refused ? { errorCode: refused } : {}),
        };
        setItems((current) => [...current, attachment]);
        if (!refused) start(attachment);
      }
    },
    [start, unavailable],
  );

  const remove = useCallback((key: string) => {
    aborts.current.get(key)?.abort();
    aborts.current.delete(key);
    setItems((current) => current.filter((item) => item.key !== key));
  }, []);

  const retry = useCallback(
    (key: string) => {
      setItems((current) => {
        const item = current.find((candidate) => candidate.key === key);
        if (item) {
          // A fresh slot in place, so the chip goes back to «laster opp»
          // rather than keeping the failed document beside a moving bar.
          const again: Attachment = {
            key: item.key,
            name: item.name,
            size: item.size,
            file: item.file,
          };
          start(again);
          return current.map((candidate) => (candidate.key === key ? again : candidate));
        }
        return current;
      });
    },
    [start],
  );

  const clear = useCallback(() => {
    for (const controller of aborts.current.values()) controller.abort();
    aborts.current.clear();
    setItems([]);
  }, []);

  const views = items.map((item) => view(item, documents));

  return {
    items: views,
    readyIds: views.flatMap((item) => (item.documentId ? [item.documentId] : [])),
    busy: views.some((item) => item.status === 'uploading'),
    ...(unavailable ? { unavailable } : {}),
    add,
    remove,
    retry,
    clear,
  };
}

function newKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** What to draw for one slot. Before `upload` resolves the bar comes from
    the shared list, matched on name and size: the pending id is the store's
    own and is thrown away when the row is replaced. */
function view(attachment: Attachment, documents: UserDocument[]): AttachmentView {
  if (attachment.errorCode) {
    return {
      key: attachment.key,
      name: attachment.name,
      status: 'failed',
      progress: 0,
      errorCode: attachment.errorCode,
    };
  }

  const settled = attachment.document;
  if (settled) {
    return {
      key: attachment.key,
      name: settled.name,
      status: settled.status === 'failed' ? 'failed' : 'ready',
      progress: settled.progress,
      ...(settled.errorCode ? { errorCode: settled.errorCode } : {}),
      ...(settled.status === 'ready' ? { documentId: settled.id } : {}),
    };
  }

  const pending = documents.find(
    (document) =>
      document.status === 'uploading' &&
      document.name === attachment.name &&
      document.size === attachment.size,
  );

  return {
    key: attachment.key,
    name: attachment.name,
    status: 'uploading',
    progress: pending?.progress ?? 0,
  };
}
