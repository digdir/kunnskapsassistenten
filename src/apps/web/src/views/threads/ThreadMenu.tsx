import { Dropdown } from '@digdir/designsystemet-react';
import { MenuElipsisHorizontalIcon, PencilIcon, TrashIcon } from '@navikt/aksel-icons';
import { useState, type Ref } from 'react';
import type { Thread } from '../../model';

export type ThreadMenuProps = {
  thread: Thread;
  onRename: () => void;
  onDelete: () => void;
  /** The button that opens the menu, so focus can come back to it. */
  ref?: Ref<HTMLButtonElement>;
};

/** «Endre navn» and «Slett», beside the row: a button inside its link is invalid. */
export function ThreadMenu({ thread, onRename, onDelete, ref }: ThreadMenuProps) {
  // Controlled: a press in the list does not close Designsystemet's popover,
  // which would then float over the rename field.
  const [open, setOpen] = useState(false);

  function choose(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <Dropdown.TriggerContext>
      {/* The title is in the name, so a screen reader can tell the rows apart. */}
      <Dropdown.Trigger
        ref={ref}
        variant="tertiary"
        data-color="neutral"
        data-size="sm"
        icon
        aria-label={`Flere valg for ${thread.title}`}
        className="threads-view__menu-trigger"
      >
        <MenuElipsisHorizontalIcon aria-hidden="true" />
      </Dropdown.Trigger>
      <Dropdown
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        placement="bottom-end"
        data-size="sm"
      >
        {/* Buttons, not `role="menu"`, as Designsystemet recommends: a menu role
            without the arrow keys and typeahead of the pattern is worse than none. */}
        <Dropdown.List>
          <Dropdown.Item>
            <Dropdown.Button onClick={() => choose(onRename)}>
              <PencilIcon aria-hidden="true" />
              Endre navn
            </Dropdown.Button>
          </Dropdown.Item>
          <Dropdown.Item>
            <Dropdown.Button onClick={() => choose(onDelete)}>
              <TrashIcon aria-hidden="true" />
              Slett
            </Dropdown.Button>
          </Dropdown.Item>
        </Dropdown.List>
      </Dropdown>
    </Dropdown.TriggerContext>
  );
}
