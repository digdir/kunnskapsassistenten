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

/**
 * The reader's own documents: a place to drop files, and what they dropped.
 *
 * It was a picture of a feature until now — a dashed box saying upload was
 * not ready — and the box is the same shape, but the flow behind it is real
 * (#117). What it cannot be is honest by accident: in live mode there is no
 * upload endpoint at all (API-bestilling A3), and then the zone says so
 * instead of taking a file and refusing it a moment later.
 */
export function OwnDocuments() {
  const { documents, unavailable, upload, remove } = useUserDocuments();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const removeRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const focusAfterRemove = useRef<string | undefined>(undefined);
  const announcement = useUploadAnnouncement(documents);

  /*
   * Where the keyboard goes when the button it was on removes itself.
   *
   * A control that disappears because of its own action takes the tab order
   * with it to `<body>`, which is above the skip link (WCAG 2.4.3) — the same
   * trap that cost #3 four findings, and what KA CC measured here with a real
   * Tab and Enter. The row below is where the reader was heading, the row
   * above is the fallback when they removed the last one, and the picker is
   * what is left when the list is empty.
   *
   * In an effect rather than after `await remove(...)`, because the button to
   * focus does not exist until React has drawn the list without the row that
   * went away.
   */
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

    /*
     * One at a time, awaited. The store is one list and every upload writes
     * to it; two writes in flight would race over the same array, and a
     * reader picking three files cares about seeing three rows, not about
     * which order they finish in.
     */
    for (const file of Array.from(files)) {
      await upload(file);
    }

    // The same file can be picked again after it was removed, and an input
    // that still holds it fires no change event the second time.
    if (inputRef.current) inputRef.current.value = '';
  }

  /*
   * What is happening to a file, for a reader who cannot see the row
   * change. Mounted whether or not it has anything to say: a live region
   * that appears together with its text is never announced, which is why
   * `ErrorState` keeps its container too.
   *
   * It says the transitions and not the percentages — «Laster opp», «er
   * lastet opp», and the reason it failed. A number that moves twenty
   * times would say the same thing twenty times, and drown the one line
   * that matters.
   */
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
    /*
     * Nowhere to upload to yet, drawn the way the design has it (30.09): a box of
     * its own with «Kommer snart» over the heading, and a zone that looks
     * switched off — neutral, tinted, a thin grey dash, and no hover. A
     * dashed box that lights up under the pointer says «drop here».
     *
     * No picker at all, and so no label either: there is no control for it
     * to name. A control that cannot work is worse than none; it invites the
     * one action the service cannot do, and the reader finds out by failing.
     *
     * The text keeps its full colour. What says «switched off» is the zone,
     * the icon and the missing hover, not a faded sentence nobody can read
     * (KA CC, 30.09: at least 4.5:1).
     *
     * The tag comes first, as it is drawn, and that is also the reading
     * order: it is a note about the whole box. A reader who jumps straight to
     * the heading still hears «snart» from the zone under it.
     */
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
        {/*
          Level 4, a sibling of «Fra Kudos», and the same `2xs` as that one:
          the spec draws one column with «Dokumenter» over both sources
          (brukerblikk, funn 12).
        */}
        <Heading level={4} data-size="2xs">
          Dine dokumenter
        </Heading>

        {/*
          The Tag came back with the thing it was about. It was taken out
          because it promised something new directly above a box saying
          upload did not work (brukerblikk, funn 13) — so it is drawn only
          where upload actually works, which is this branch.
        */}
        <Tag data-color="info" data-size="sm">
          Ny
        </Tag>
      </div>

      {/*
        Designsystemet's own composition, from file-upload.md: the field
        carries the label and the descriptions, the icon is decorative, and
        the «button» is a span because the real control is the file input
        that CSS lays over the whole surface. A real button inside the click
        surface would be a second tab stop that does nothing.

        The component is `EXPERIMENTAL_` and that is the name it ships under;
        it is a styled div with no behaviour of its own, so what it costs us
        if it changes is the box, not the flow.
      */}
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

/**
 * What to say out loud about an upload, as it changes.
 *
 * Three moments, and only three: a file was taken in, a file is there, a file
 * was refused. The percentage in the row is not one of them — it changes
 * twenty times in a second and a half, and a live region that repeated it
 * would bury the one sentence a reader needs (WCAG 4.1.3 asks for the status,
 * not for every frame of it).
 *
 * Derived from the documents rather than from the picker, and that is
 * deliberate: the compose field uploads too (#3), and a reader who attached a
 * file down there should hear the same thing as one who dropped it up here.
 *
 * The first render says nothing. Documents restored from the store on load
 * are not news, and announcing «er lastet opp» for three files nobody just
 * touched would be a lie about what is happening now.
 */
function useUploadAnnouncement(documents: UserDocument[]): string {
  const [seen, setSeen] = useState<Map<string, UserDocumentStatus> | undefined>(undefined);
  const [announcement, setAnnouncement] = useState('');

  /*
   * Adjusted during render, not in an effect. This is React's own pattern for
   * a value that follows a change in what was handed in: the comparison is
   * against the previous list, and setting state here re-renders before
   * anything is drawn rather than after — an effect would draw the new row
   * first and say it afterwards, and the lint rule about cascading renders is
   * about exactly that.
   */
  const now = new Map(documents.map((document) => [document.id, document.status]));

  if (seen === undefined) {
    // First render. What is already in the list is not news; see above.
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

        {/*
          Type and size always; a status only when there is something to say.
          A row that says «Klar» under every finished document is a word per
          row in a panel that is already over its height budget, and the
          reader can see that it is there.

          The progress is a number in that line and not a bar, although
          `UserDocument.progress` was made a number «because the design draws
          a bar» (#117). Two reasons, and both are about this panel: a bar is
          a row of its own in a column that is already over budget, and the
          upload it draws lasts about a second and a half — long enough to
          read four words, too short to watch a bar fill. The number is also
          what the live region says, so the eye and the ear get the same
          thing. When a real backend reports slow uploads of large files, this
          is the line to revisit.
        */}
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

      {/*
        The name is in the accessible name, because «Fjern» four times over is
        four controls a screen reader user cannot tell apart.
      */}
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
