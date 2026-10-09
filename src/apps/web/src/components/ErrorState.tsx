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
  /** Where focus goes when a successful retry unmounts the button; else the silent alert region. */
  focusAfterRetry?: RefObject<HTMLElement | null>;
  /** The retry button, so a caller can focus it if the reader's control vanished with the error. */
  retryRef?: RefObject<HTMLButtonElement | null>;
};

/**
 * An error the user needs to see. Render it permanently and pass `message` when there is one:
 * `role="alert"` only announces content added to a region that already exists. The region also
 * catches focus when the retry button unmounts, so focus does not fall to `<body>`.
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
  // An error that clears for another reason must not steal focus.
  const retryHeldFocus = useRef(false);

  useEffect(() => {
    if (message || !retryHeldFocus.current) return;
    retryHeldFocus.current = false;

    // Only rescue focus that got lost (it is on `<body>`). A retry handler may
    // already have moved it somewhere on purpose, such as the compose field.
    if (document.activeElement !== document.body && document.activeElement !== null) return;

    (focusAfterRetry?.current ?? region.current)?.focus();
  }, [message, focusAfterRetry]);

  function handleRetry() {
    // Read before the state change unmounts the button. Safari does not focus
    // a button on click, so this is false there and focus is left alone.
    retryHeldFocus.current = region.current?.contains(document.activeElement) ?? false;
    onRetry?.();
  }

  return (
    // tabIndex -1: a focus target outside the tab order. `ds-focus` draws the
    // ring on :focus-visible only, so a mouse retry does not flash one.
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
