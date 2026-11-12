import { useEffect, type RefObject } from 'react';

/** The modifier named in the hint; the handler takes both. */
export const shortcutModifier = (): 'Ctrl' | 'Cmd' =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/u.test(navigator.userAgent) ? 'Cmd' : 'Ctrl';

/**
 * Ctrl+/ or Cmd+/ puts the caret in the field. A bare «/» stays inert (WCAG 2.1.4), Shift passes
 * because «/» is Shift+7 on a Norwegian keyboard, and Alt does not because Ctrl+Alt is AltGr.
 */
export const useComposerShortcut = (
  field: RefObject<HTMLTextAreaElement | null>,
  enabled: boolean,
) => {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || (!event.ctrlKey && !event.metaKey) || event.altKey) return;
      if (!field.current) return;
      event.preventDefault();
      field.current.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [field, enabled]);
};
