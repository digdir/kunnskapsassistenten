import { Dropdown } from '@digdir/designsystemet-react';
import { MenuElipsisHorizontalIcon, PencilIcon, TrashIcon } from '@navikt/aksel-icons';
import { useState, type Ref } from 'react';
import { useT } from './i18n.js';

export interface ThreadMenuProps {
  title: string;
  onRename: (() => void) | undefined;
  onDelete: (() => void) | undefined;
  /** The button that opens the menu, so focus can come back to it. */
  ref?: Ref<HTMLButtonElement>;
}

/** «Endre navn» and «Slett», beside the row: a button inside its link would be invalid. */
export const ThreadMenu = ({ title, onRename, onDelete, ref }: ThreadMenuProps) => {
  const t = useT();
  // Controlled: a press in the list does not close the popover, which would float over the field.
  const [open, setOpen] = useState(false);
  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <Dropdown.TriggerContext>
      <Dropdown.Trigger
        ref={ref}
        variant="tertiary"
        // Pinned to neutral, as kunnskapsassistenten draws it: one in every row, so it stays quiet.
        data-color="neutral"
        data-size="sm"
        icon
        // The title is in the name, so a screen reader can tell the rows apart.
        aria-label={t('threads.more', { title })}
        className="uib-threads-menu-trigger"
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
        {/* Buttons, not role="menu", as Designsystemet recommends without the arrow keys. */}
        <Dropdown.List>
          {onRename ? (
            <Dropdown.Item>
              <Dropdown.Button onClick={() => choose(onRename)}>
                <PencilIcon aria-hidden="true" />
                {t('threads.rename')}
              </Dropdown.Button>
            </Dropdown.Item>
          ) : null}
          {onDelete ? (
            <Dropdown.Item>
              <Dropdown.Button onClick={() => choose(onDelete)}>
                <TrashIcon aria-hidden="true" />
                {t('threads.delete')}
              </Dropdown.Button>
            </Dropdown.Item>
          ) : null}
        </Dropdown.List>
      </Dropdown>
    </Dropdown.TriggerContext>
  );
};
