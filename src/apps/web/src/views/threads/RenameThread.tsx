import { Button, Textfield } from '@digdir/designsystemet-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Thread } from '../../model';

export type RenameThreadProps = {
  thread: Thread;
  onSave: (title: string) => void;
  onCancel: () => void;
};

/**
 * The row, while the reader gives the thread a new name.
 *
 * In the row rather than in a dialog: the name is short, the reader is
 * looking at the row, and a dialog would cover the list they are naming a
 * thread in. «Lagre» and «Avbryt» are on screen, and not only Enter and
 * Escape, because a keyboard shortcut nobody can see is not an interface —
 * the keys work as well, for whoever expects them.
 *
 * A blur does nothing. Saving on blur, as a click elsewhere, would rename the
 * thread to whatever half a name was typed when the reader went to check
 * something; cancelling on blur would throw away a name they were about to
 * save. The field waits for one of the two buttons.
 */
export function RenameThread({ thread, onSave, onCancel }: RenameThreadProps) {
  const [title, setTitle] = useState(thread.title);
  const [empty, setEmpty] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Into the field with the old name selected, so typing replaces it and an
  // arrow key keeps it: the two things a reader renaming a thread does next.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function save(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setEmpty(true);
      inputRef.current?.focus();
      return;
    }
    // The same name is not a change, and no request is made for it.
    if (trimmed === thread.title) onCancel();
    else onSave(trimmed);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Escape') return;
    // Stop here: in the drawer the panel is a dialog, and Escape is its own
    // close request as well (the same collision RowOverlay handles).
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  }

  return (
    <form className="threads-view__rename" onSubmit={save} noValidate>
      <Textfield
        ref={inputRef}
        label="Nytt navn på tråden"
        data-size="sm"
        value={title}
        onChange={(event) => {
          setTitle(event.currentTarget.value);
          if (empty) setEmpty(false);
        }}
        onKeyDown={onKeyDown}
        error={empty ? 'Tråden må ha et navn.' : undefined}
      />
      <div className="threads-view__rename-actions">
        <Button type="submit" data-size="sm">
          Lagre
        </Button>
        <Button type="button" variant="secondary" data-size="sm" onClick={onCancel}>
          Avbryt
        </Button>
      </div>
    </form>
  );
}
