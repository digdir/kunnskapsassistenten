import { use, useCallback, useEffect, useMemo, useState } from 'react';
import type { ComposerContextValue } from './composerContext';
import { ComposerContext } from './composerContext';

/**
 * Report a compose field on screen for as long as `present` is true.
 *
 * Shaped like `useNoAnswers`: a boolean argument rather than a hook the
 * caller may or may not call, because the caller renders in both states and a
 * hook cannot be called conditionally.
 *
 * `present` is one term today — whether the view is drawing the conversation
 * at all. It gains a second the day a conversation can sit in a sidebar: the
 * content of a collapsed slot is `hidden`, and a skip link into hidden content
 * is the same dead end in a different place. Nothing can collapse the main
 * slot, so that term would assert a state that cannot happen yet.
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
 * The other end: hold the count, and hand out the value to provide.
 *
 * A count and not a flag. React mounts a replacement before it unmounts the
 * element being replaced, so two composers overlap for a commit whenever one
 * view hands over to another — and a flag written by the one leaving would
 * say «no field» while a field is on screen the whole time. Counting makes
 * the order of the two effects stop mattering.
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
