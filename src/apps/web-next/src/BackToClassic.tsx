// «Tilbake til gammel versjon» in the profile menu, the way back to apps/web.
//
// The profile menu is genki's (`ShellProfile` in @genai/ui-blocks), and today it takes only its
// own fixed entries, so a host cannot add one through its props. Until it can, this puts the
// entry in each profile menu on the page, after the menu's own pages, through a portal: the
// assembly's markup is not changed, and vendor/genki is not edited. When genki's profile menu
// takes host entries, this becomes one entry in `profile.menu` and this file goes.
import { Dropdown } from '@digdir/designsystemet-react';
import { ArrowUndoIcon } from '@navikt/aksel-icons';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { switchClient } from './switchClient';

/** The menu the profile button opens, as `ShellProfile` names it. */
export const PROFILE_MENU = '.uib-shell-profile-menu';
const SLOT = 'ka-next-menu-extra';

export const BACK_LABEL = 'Tilbake til gammel versjon';

/** A slot for the entry in `menu`, after its pages and before «Logg ut»'s line. */
const slotIn = (menu: Element): HTMLElement => {
  const found = menu.querySelector<HTMLElement>(`:scope > .${SLOT}`);
  if (found) return found;
  // A list of its own, as the menu's: the menu's styles name its lists as its children.
  const slot = document.createElement('ul');
  slot.className = SLOT;
  const pages = menu.querySelector(':scope > ul');
  if (pages) pages.after(slot);
  else menu.append(slot);
  return slot;
};

/** Every profile menu on the page now, kept as the assembly draws and redraws them. */
const useMenuSlots = () => {
  const [slots, setSlots] = useState<HTMLElement[]>([]);
  useEffect(() => {
    const look = () => {
      const now = [...document.querySelectorAll(PROFILE_MENU)].map(slotIn);
      setSlots((before) =>
        before.length === now.length && before.every((slot, i) => slot === now[i])
          ? before
          : now,
      );
    };
    look();
    const observer = new MutationObserver(look);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return slots;
};

export const BackToClassic = ({
  onSwitch = () => switchClient('classic'),
}: {
  onSwitch?: () => Promise<void> | void;
}) => {
  const slots = useMenuSlots();
  const [busy, setBusy] = useState(false);
  return (
    <>
      {slots.map((slot, i) =>
        createPortal(
          <Dropdown.Item>
            <Dropdown.Button
              aria-busy={busy || undefined}
              onClick={() => {
                setBusy(true);
                void Promise.resolve(onSwitch()).catch(() => setBusy(false));
              }}
            >
              <ArrowUndoIcon aria-hidden />
              <span className="uib-shell-profile-label">{BACK_LABEL}</span>
            </Dropdown.Button>
          </Dropdown.Item>,
          slot,
          `back-${i}`,
        ),
      )}
    </>
  );
};
