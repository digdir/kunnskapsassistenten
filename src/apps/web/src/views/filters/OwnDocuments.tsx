import {
  Button,
  Card,
  EXPERIMENTAL_FileUpload as FileUpload,
  Field,
  Heading,
  Label,
  Paragraph,
  Tag,
} from '@digdir/designsystemet-react';
import { CloudUpIcon, InformationSquareIcon, TrashIcon } from '@navikt/aksel-icons';
import { useEffect, useId, useRef, useState } from 'react';
import { useUserDocuments } from '../../layout/useUserDocuments';
import { UPLOAD_ACCEPT, type UserDocument, type UserDocumentStatus } from '../../model';
import { fileSize, MAX_UPLOAD_TEXT, UPLOAD_COMING_TEXT, uploadErrorText } from './uploadText';

/** «PDF» and «DOCX», as a reader expects to see a file type written. */
const TYPE_LABEL = { pdf: 'PDF', docx: 'DOCX' } as const;

/** The reader's own documents: a place to drop files, and what they dropped. In live mode
 * there is no upload endpoint, and the zone says so up front. */
export function OwnDocuments() {
  const { documents, unavailable, upload, remove } = useUserDocuments();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const removeRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const focusAfterRemove = useRef<string | undefined>(undefined);
  const announcement = useUploadAnnouncement(documents);

  // A remove button that removes itself drops focus to `<body>` (WCAG 2.4.3). It goes to the
  // next row, else the previous, else the picker. In an effect, because that button exists
  // only once React has drawn the shorter list.
  useEffect(() => {
    const target = focusAfterRemove.current;
    if (target === undefined) return;
    focusAfterRemove.current = undefined;

    const button = target === '' ? undefined : removeRefs.current.get(target);
    if (button) button.focus();
    else inputRef.current?.focus();
  }, [documents]);

  function removeDocument(id: string) {
    const index = documents.findIndex((document) => document.id === id);
    const next = documents[index + 1] ?? documents[index - 1];
    focusAfterRemove.current = next?.id ?? '';
    removeRefs.current.delete(id);
    void remove(id);
  }

  async function choose(files: FileList | null) {
    if (!files) return;

    // One at a time: every upload writes to the same list, and two in flight would race.
    for (const file of Array.from(files)) {
      await upload(file);
    }

    // The same file can be picked again after it was removed, and an input
    // that still holds it fires no change event the second time.
    if (inputRef.current) inputRef.current.value = '';
  }

  // The live region is mounted even when silent: one that appears together with
  // its text is not announced (`ErrorState` does the same).
  const status = (
    <>
      <output className="ds-sr-only">{announcement}</output>

      {documents.length > 0 && (
        <ul className="own-documents__list" id={listId}>
          {documents.map((document) => (
            <DocumentRow
              key={document.id}
              document={document}
              removeRef={(button) => {
                if (button) removeRefs.current.set(document.id, button);
                else removeRefs.current.delete(document.id);
              }}
              onRemove={() => removeDocument(document.id)}
            />
          ))}
        </ul>
      )}
    </>
  );

  if (unavailable !== undefined) {
    // No picker: a control that cannot work invites an action that fails. The zone looks
    // switched off, without the hover that says «drop here», but its text keeps full colour
    // (at least 4.5:1). «Kommer snart» comes first: it is about the whole box.
    return (
      <Card
        asChild
        data-color="neutral"
        className="documents-list own-documents own-documents--unavailable"
      >
        <section>
          <Tag data-color="info" data-size="sm" className="own-documents__soon">
            <InformationSquareIcon aria-hidden="true" />
            Kommer snart
          </Tag>

          <Heading level={4} data-size="2xs">
            Dine dokumenter
          </Heading>

          <FileUpload
            data-size="sm"
            className="own-documents__zone own-documents__zone--unavailable"
          >
            <CloudUpIcon aria-hidden="true" fontSize="1.5rem" />
            <Paragraph data-size="sm">{UPLOAD_COMING_TEXT}</Paragraph>
          </FileUpload>

          {status}
        </section>
      </Card>
    );
  }

  return (
    <section className="documents-list own-documents">
      <div className="own-documents__heading">
        {/* Level 4, a sibling of «Fra <korpus>» under «Dokumenter», as the spec draws. */}
        <Heading level={4} data-size="2xs">
          Dine dokumenter
        </Heading>

        {/* «Ny» only where upload works, not over a zone saying it does not. */}
        <Tag data-color="info" data-size="sm">
          Ny
        </Tag>
      </div>

      {/* «Velg filer» is a span: the real control is the file input CSS lays over the zone,
          and a button would be a second, dead tab stop. `EXPERIMENTAL_` FileUpload is only a
          styled div, so a change costs the box, not the flow. */}
      <Field>
        <Label>Last opp egne dokumenter</Label>

        <FileUpload data-size="sm" className="own-documents__zone">
          <CloudUpIcon aria-hidden="true" fontSize="1.5rem" />

          <Field.Description>
            Slipp filer her, eller velg dem selv. Kun PDF og .docx for øyeblikket, maks{' '}
            {MAX_UPLOAD_TEXT}.
          </Field.Description>

          <Button asChild variant="secondary" data-size="sm">
            <span>Velg filer</span>
          </Button>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={UPLOAD_ACCEPT}
            aria-describedby={listId}
            onChange={(event) => void choose(event.currentTarget.files)}
          />
        </FileUpload>
      </Field>

      {status}
    </section>
  );
}

/** What the live region says: a file taken in, there, or refused, never the percentage, which
 * would bury the status (WCAG 4.1.3). From the documents, not the picker, so compose-field
 * uploads are announced too. Silent on first render: restored documents are not news. */
function useUploadAnnouncement(documents: UserDocument[]): string {
  const [seen, setSeen] = useState<Map<string, UserDocumentStatus> | undefined>(undefined);
  const [announcement, setAnnouncement] = useState('');

  // Set during render, not in an effect, which would draw the new row before
  // saying it (React's pattern for state that follows a prop).
  const now = new Map(documents.map((document) => [document.id, document.status]));

  if (seen === undefined) {
    setSeen(now);
  } else {
    const changed = documents.find((document) => seen.get(document.id) !== document.status);

    if (changed) {
      setSeen(now);
      setAnnouncement(announce(changed));
    }
  }

  return announcement;
}

/** What to say about one document that has just changed state. */
function announce(document: UserDocument): string {
  if (document.status === 'uploading') return `Laster opp ${document.name}`;
  if (document.status === 'ready') return `${document.name} er lastet opp`;

  return `${document.name} ble ikke lastet opp. ${uploadErrorText(document.errorCode ?? 'failed')}`;
}

function DocumentRow({
  document,
  onRemove,
  removeRef,
}: {
  document: UserDocument;
  onRemove: () => void;
  removeRef: (button: HTMLButtonElement | null) => void;
}) {
  return (
    <li className="own-documents__item">
      <div className="own-documents__text">
        <Paragraph data-size="sm" className="own-documents__name">
          {document.name}
        </Paragraph>

        {/* A status only when there is something to say: the panel is over its height budget.
            Progress as a number, not a bar: a bar takes a row, and uploads here last about 1.5 s.
            Revisit if a real backend has slow uploads. */}
        <Paragraph data-size="xs" className="own-documents__meta">
          {TYPE_LABEL[document.type]} · {fileSize(document.size)}
          {document.status === 'uploading' && ` · Laster opp … ${Math.round(document.progress)} %`}
        </Paragraph>

        {document.status === 'failed' && (
          <Paragraph data-size="xs" className="own-documents__error">
            {uploadErrorText(document.errorCode ?? 'failed')}
          </Paragraph>
        )}
      </div>

      {/* The name is in the label, or four «Fjern» cannot be told apart. */}
      <Button
        ref={removeRef}
        variant="tertiary"
        data-color="neutral"
        data-size="sm"
        aria-label={`Fjern ${document.name}`}
        onClick={onRemove}
      >
        <TrashIcon aria-hidden="true" />
      </Button>
    </li>
  );
}
