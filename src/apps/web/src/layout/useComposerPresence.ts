import { use, useCallback, useEffect, useMemo, useState } from 'react';
import type { ComposerContextValue } from './composerContext';
import { ComposerContext } from './composerContext';

/**
 * Report a compose field on screen for as long as `present` is true. If a conversation can ever
 * sit in a collapsible slot, `present` must also be false while it is collapsed: the content is
 * `hidden`, and a skip link into it is a dead end.
 */
export function useComposerPresence(present: boolean): void {
  const { addComposer, removeComposer } = use(ComposerContext);

  useEffect(() => {
    if (!present) return;
    addComposer();
    return removeComposer;
  }, [present, addComposer, removeComposer]);
}

/**
 * The other end: hold the count, and hand out the value to provide. A count, not a flag, because
 * React mounts a replacement before it unmounts the old one, so two composers briefly overlap.
 */
export function useComposerRegistry(): ComposerContextValue {
  const [composers, setComposers] = useState(0);
  const addComposer = useCallback(() => setComposers((count) => count + 1), []);
  const removeComposer = useCallback(() => setComposers((count) => count - 1), []);

  return useMemo(
    () => ({ hasComposer: composers > 0, addComposer, removeComposer }),
    [composers, addComposer, removeComposer],
  );
}
