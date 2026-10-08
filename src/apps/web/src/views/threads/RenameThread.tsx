import { Button, Textfield } from '@digdir/designsystemet-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Thread } from '../../model';

export type RenameThreadProps = {
  thread: Thread;
  onSave: (title: string) => void;
  onCancel: () => void;
};

/** The row while renaming, in place rather than in a dialog over the list. */
export function RenameThread({ thread, onSave, onCancel }: RenameThreadProps) {
  const [title, setTitle] = useState(thread.title);
  const [empty, setEmpty] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Old name selected: typing replaces it, an arrow key keeps it.
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
    if (trimmed === thread.title) onCancel();
    else onSave(trimmed);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Escape') return;
    // Stop here: in the drawer the panel is a dialog that Escape would close.
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  }

  return (
    <form className="threads-view__rename" onSubmit={save} noValidate>
      {/* No blur handler: saving would keep half a name, cancelling lose a whole one. */}
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
      {/* Visible buttons, since Enter and Escape alone are a shortcut nobody sees. */}
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
