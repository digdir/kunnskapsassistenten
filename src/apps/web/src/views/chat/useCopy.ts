import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a receipt stays on screen before it clears itself. */
const RECEIPT_MS = 4000;

export type UseCopy = {
  /** What to render in the live region. `null` means nothing to say yet. */
  receipt: string | null;
  /** Copy `text`, then show `done` — or say that the browser refused. */
  copy: (text: string, done: string) => Promise<void>;
};

/**
 * Copying that says whether it worked.
 *
 * Shared by the answer's action row and the clarification card, because both
 * copy one piece of text and both owe the reader a receipt. The receipt is
 * one string for a visible element that is also a polite live region, so a
 * sighted reader and a screen reader user are told the same thing at the same
 * time — and the clipboard can refuse, in which case saying so is the only
 * honest outcome.
 *
 * The timer is cleared on unmount: a card that goes away mid-receipt must not
 * set state afterwards.
 */
export function useCopy(): UseCopy {
  const [receipt, setReceipt] = useState<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const copy = useCallback(async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setReceipt(done);
    } catch {
      setReceipt('Kunne ikke kopiere. Nettleseren tillot det ikke.');
    }
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setReceipt(null), RECEIPT_MS);
  }, []);

  return { receipt, copy };
}
