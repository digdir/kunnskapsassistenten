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
 * Copying that says whether it worked, including when the clipboard refuses.
 * One string for a visible element that is also a polite live region, so both
 * readers hear the same thing; the timer is cleared on unmount.
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
