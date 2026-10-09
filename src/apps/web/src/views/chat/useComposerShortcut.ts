import { useEffect, type RefObject } from 'react';

/** The key, written once. Shown to the reader and matched on here. */
export const COMPOSER_SHORTCUT_KEY = '/';

/**
 * Ctrl+/ puts the caret in the compose field and swallows the keystroke. **The
 * modifier is not decoration:** a single character key shortcut is WCAG 2.1.4,
 * level A. Shift passes, since `/` IS Shift+7; Alt is AltGr on Windows.
 */
export function useComposerShortcut(
  fieldRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== COMPOSER_SHORTCUT_KEY) return;
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.altKey) return;

      const field = fieldRef.current;
      if (!field) return;

      event.preventDefault();
      field.focus();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fieldRef]);
}
