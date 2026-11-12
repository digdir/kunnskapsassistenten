import { Button, Textfield } from '@digdir/designsystemet-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useT } from './i18n.js';

export interface RenameThreadProps {
  title: string;
  onSave: (title: string) => void;
  onCancel: () => void;
}

/** The row while it is renamed, in place rather than in a dialog over the list. */
export const RenameThread = ({ title: old, onSave, onCancel }: RenameThreadProps) => {
  const t = useT();
  const [title, setTitle] = useState(old);
  const [empty, setEmpty] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // The old name selected: typing replaces it, an arrow key keeps it.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setEmpty(true);
      inputRef.current?.focus();
      return;
    }
    if (trimmed === old) onCancel();
    else onSave(trimmed);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return;
    // Stopped here: around a panel in a drawer, Escape would close the drawer too.
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  };

  return (
    <form className="uib-threads-rename" onSubmit={save} noValidate>
      {/* No blur handler: saving would keep half a name, cancelling lose a whole one. */}
      <Textfield
        ref={inputRef}
        label={t('threads.newName')}
        data-size="sm"
        value={title}
        onChange={(event) => {
          setTitle(event.currentTarget.value);
          if (empty) setEmpty(false);
        }}
        onKeyDown={onKeyDown}
        error={empty ? t('threads.nameRequired') : undefined}
      />
      {/* Visible buttons, since Enter and Escape alone are a shortcut nobody sees. */}
      <div className="uib-threads-actions">
        <Button type="submit" data-size="sm">
          {t('threads.save')}
        </Button>
        <Button type="button" variant="secondary" data-size="sm" onClick={onCancel}>
          {t('threads.cancel')}
        </Button>
      </div>
    </form>
  );
};
