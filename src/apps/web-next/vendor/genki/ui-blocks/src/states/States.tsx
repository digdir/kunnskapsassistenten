import { Alert, Button, Heading, Link, Paragraph } from '@digdir/designsystemet-react';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { plainClick } from '../dom.js';
import { errorTextKey, isRetryable, type ErrorKind } from './errorKinds.js';
import { useT } from './i18n.js';

export { CrashBoundary, type CrashBoundaryProps } from './CrashBoundary.js';
export {
  errorKindFromStatus,
  errorKinds,
  isErrorKind,
  isRetryable,
  type ErrorKind,
} from './errorKinds.js';

/** An error kind's heading, what happened and what the reader can do, in the reader's language. */
export interface ErrorText {
  title: string;
  what: string;
  advice: string;
}

/**
 * The one set of texts for the error kinds, for any block that says why something failed, such as
 * an answer's card. The returned function takes the kind and what the assistant is called, which
 * some kinds name («Assistenten» without it).
 */
export const useErrorText = () => {
  const t = useT();
  return (kind: ErrorKind, assistantName?: string): ErrorText => {
    const key = errorTextKey[kind];
    const name = assistantName ?? t('states.assistant');
    return {
      title: t(`states.${key}Title`),
      what: t(`states.${key}What`, { name }),
      advice: t(`states.${key}Advice`),
    };
  };
};

export interface EmptyStateProps {
  /** What is missing, said plainly. */
  title: string;
  /** What the person can do about it. */
  description?: string | undefined;
  /** 3 under a panel head, 2 when the state is the whole page. Sets the size too. */
  level?: 2 | 3 | 4 | undefined;
  /** A button or link that resolves it. */
  children?: ReactNode;
}

const titleSize = { 2: 'lg', 3: '2xs', 4: '2xs' } as const;

/** Nothing to show yet. A normal state, not an error, so no alert and no announcement. */
export const EmptyState = ({ title, description, level = 3, children }: EmptyStateProps) => (
  <div className="uib-states-empty">
    <Heading level={level} data-size={titleSize[level]}>
      {title}
    </Heading>
    {description ? (
      <Paragraph data-size="sm" variant="long">
        {description}
      </Paragraph>
    ) : null}
    {children}
  </div>
);

export interface ErrorStateProps {
  /** A heading in the alert. With a `kind`, the kind's own when not given. */
  title?: string | undefined;
  /**
   * Nothing is shown or announced while this and `kind` are undefined. With a `kind`, it takes the
   * place of the kind's first sentence, what happened; the advice stays the kind's.
   */
  message?: string | undefined;
  /**
   * What went wrong with an answer. Gives the heading, the sentence on what happened and the advice,
   * and offers «Prøv igjen» only where trying again can help.
   */
  kind?: ErrorKind | undefined;
  /** What the assistant is called, in the texts of some kinds. «Assistenten» without it. */
  assistantName?: string | undefined;
  /** With a `kind`, the host's own advice in place of the kind's, naming its own controls. */
  advice?: string | undefined;
  /** Offers «Prøv igjen». */
  onRetry?: (() => void) | undefined;
  /** Where focus goes when a retry clears the error. The alert region when not given. */
  focusAfterRetry?: RefObject<HTMLElement | null> | undefined;
  /** The retry button, for an app whose own control went away with the error. */
  retryRef?: RefObject<HTMLButtonElement | null> | undefined;
  /** The heading's level, 3 under a panel's or a view's heading by default. */
  headingLevel?: 2 | 3 | 4 | 5 | 6 | undefined;
}

/**
 * An error the person needs to see. Keep it drawn and pass `message` when there is one:
 * `role="alert"` announces only what appears in a region that is already there.
 */
export const ErrorState = ({
  title,
  message,
  kind,
  assistantName,
  advice,
  onRetry,
  focusAfterRetry,
  retryRef,
  headingLevel = 3,
}: ErrorStateProps) => {
  const t = useT();
  const errorText = useErrorText();
  const region = useRef<HTMLDivElement>(null);
  const retryHeldFocus = useRef(false);

  // kunnskapsassistenten's cases, one heading and two sentences each (`views/chat/errorText.ts`).
  const text = kind ? errorText(kind, assistantName) : undefined;
  const shownTitle = title ?? text?.title;
  const shownMessage = text ? `${message ?? text.what} ${advice ?? text.advice}` : message;
  const canRetry = onRetry !== undefined && (kind === undefined || isRetryable(kind));

  useEffect(() => {
    if (shownMessage || !retryHeldFocus.current) return;
    retryHeldFocus.current = false;
    // Only focus that was lost: the app's retry may already have moved it on purpose.
    if (document.activeElement !== document.body && document.activeElement !== null) return;
    (focusAfterRetry?.current ?? region.current)?.focus();
  }, [shownMessage, focusAfterRetry]);

  const retry = () => {
    retryHeldFocus.current = region.current?.contains(document.activeElement) ?? false;
    onRetry?.();
  };

  return (
    <div role="alert" className="uib-states-error ds-focus" tabIndex={-1} ref={region}>
      {shownMessage ? (
        <Alert data-color="danger">
          {shownTitle ? (
            <Heading level={headingLevel} data-size="2xs">
              {shownTitle}
            </Heading>
          ) : null}
          <Paragraph variant="long">{shownMessage}</Paragraph>
          {canRetry ? (
            <Button variant="secondary" data-size="sm" onClick={retry} ref={retryRef}>
              {t('states.retry')}
            </Button>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
};

export interface NotFoundStateProps {
  /** The front page's address. */
  homeHref: string;
  /** For an app with its own router: called on a plain click instead of following the link. */
  onGoHome?: (() => void) | undefined;
  /** What was not found. Without it, the page itself, with the package's own description. */
  title?: string | undefined;
  /** Why it may not be there. */
  description?: string | undefined;
}

/** An address or item that does not exist, with the one way out. The page is this, so no alert. */
export const NotFoundState = ({ homeHref, onGoHome, title, description }: NotFoundStateProps) => {
  const t = useT();
  return (
    <EmptyState
      level={2}
      title={title ?? t('states.notFoundTitle')}
      description={
        description ?? (title === undefined ? t('states.notFoundDescription') : undefined)
      }
    >
      <Link
        href={homeHref}
        onClick={(event) => {
          if (!onGoHome || !plainClick(event)) return;
          event.preventDefault();
          onGoHome();
        }}
      >
        {t('states.goHome')}
      </Link>
    </EmptyState>
  );
};
