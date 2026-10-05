import { Alert, Button, Heading, Paragraph } from '@digdir/designsystemet-react';
import { useEffect, useRef, type RefObject } from 'react';

export type ErrorStateProps = {
  /** Norwegian heading inside the alert. Optional. */
  title?: string;
  /** Norwegian. Nothing is announced while this is undefined. */
  message?: string;
  /** Shows a retry button when given. */
  onRetry?: () => void;
  /** Norwegian label for the retry button. */
  retryLabel?: string;
  /**
   * Where focus goes when a retry succeeds and takes the button with it.
   *
   * The retry button is a control that disappears because of its own action,
   * so something has to say where the user ends up. Point this at what the
   * retry produced — the list that loaded, the answer that arrived — so the
   * user lands on the result of their own click.
   *
   * Leave it out and focus goes to the alert region instead. That keeps the
   * tab order where the user left it, but the region is empty by then and
   * announces nothing, so it is the fallback and not the goal.
   */
  focusAfterRetry?: RefObject<HTMLElement | null>;
  /**
   * The retry button itself, so a caller can put focus on it.
   *
   * The control a reader was holding can vanish under them when the error
   * arrives — the stop button becomes the send button and is disabled a frame
   * later — and this is what «Prøv igjen» is: the one thing to do next. Only
   * the caller knows whether focus was lost, so the ref is handed out rather
   * than the focusing being done here.
   */
  retryRef?: RefObject<HTMLButtonElement | null>;
};

/**
 * An error the user needs to see (answer 35).
 *
 * The `role="alert"` container is rendered even when there is no error, and
 * that is the point. A screen reader only announces an alert when content
 * appears INSIDE a region that already exists; mounting the whole region and
 * its text at once announces nothing. So render this component permanently
 * where an error can appear, and pass `message` when one does.
 * See design/designsystemet/komponenter/alert.md.
 *
 * Because the region outlives the error, it is also what catches focus when
 * the retry button unmounts. Without that, focus falls to `<body>` and the
 * next Tab starts over at the skip link, which is the whole page away from
 * what the user was doing.
 */
export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Prøv igjen',
  focusAfterRetry,
  retryRef,
}: ErrorStateProps) {
  const region = useRef<HTMLDivElement>(null);
  // True only between a retry click that held focus and the error clearing.
  // An error that clears for some other reason must not steal focus, so this
  // is read once and reset.
  const retryHeldFocus = useRef(false);

  useEffect(() => {
    if (message || !retryHeldFocus.current) return;
    retryHeldFocus.current = false;

    // Only rescue focus that actually got lost. A caller whose retry handler
    // already moved focus somewhere deliberate — the chat view sends it to
    // the compose field — must not have it taken back. Focus on `<body>` is
    // the signal that nobody claimed it.
    if (document.activeElement !== document.body && document.activeElement !== null) return;

    (focusAfterRetry?.current ?? region.current)?.focus();
  }, [message, focusAfterRetry]);

  function handleRetry() {
    // Read before the state change unmounts the button underneath us. Safari
    // does not focus a button on click, and then this is false and focus is
    // left alone, which is correct: it was never in here.
    retryHeldFocus.current = region.current?.contains(document.activeElement) ?? false;
    onRetry?.();
  }

  return (
    // tabIndex -1 makes the region a focus target without putting it in the
    // tab order. `ds-focus` draws Designsystemet's ring on :focus-visible
    // only, so a keyboard retry shows where focus went and a mouse retry
    // does not flash a ring at someone who does not need it.
    <div role="alert" className="error-state ds-focus" tabIndex={-1} ref={region}>
      {message ? (
        <Alert data-color="danger">
          {title ? (
            <Heading level={3} data-size="2xs">
              {title}
            </Heading>
          ) : null}
          <Paragraph variant="long">{message}</Paragraph>
          {onRetry ? (
            <Button variant="secondary" data-size="sm" onClick={handleRetry} ref={retryRef}>
              {retryLabel}
            </Button>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
}
