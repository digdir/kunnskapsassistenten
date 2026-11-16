import { Button, Tooltip } from '@digdir/designsystemet-react';
import { ClipboardIcon, ClipboardLinkIcon } from '@navikt/aksel-icons';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { classes } from '../dom.js';
import { Feedback } from './Feedback.js';
import { useT } from './i18n.js';
import type { AnswerCopied, AnswerFeedback, AnswerFeedbackStatus } from './types.js';

export interface AnswerActionsProps {
  /** Shows «Kopier svaret». The app copies the answer, with its sources if it has them. */
  onCopyAnswer?: (() => void) | undefined;
  /** Shows «Kopier lenke til tråden». The app copies the link. */
  onCopyLink?: (() => void) | undefined;
  /** The link opens the thread only for this person, in this browser, and the block says so. */
  linkOnlyHere?: boolean | undefined;
  /** What the app's last copy did. Pass a new object for each copy; the receipt clears itself. */
  copied?: AnswerCopied | undefined;
  /**
   * Shows «Var svaret nyttig?» under the answer, with `onFeedback`. Off unless asked for:
   * kunnskapsassistenten took the feedback under each answer out on 6 October 2026, because it
   * adds a lot of noise under every answer, and its decision log has it to be rethought.
   */
  feedback?: boolean | undefined;
  /**
   * The app sends the rating, reasons and comment. Raised on the click on a thumb, and again in
   * full when the reasons and comment are sent or the rating changes. Drawn only with `feedback`.
   */
  onFeedback?: ((feedback: AnswerFeedback) => void) | undefined;
  /** How the app's sending went. */
  feedbackStatus?: AnswerFeedbackStatus | undefined;
  /** The app's own actions, after the copy buttons. */
  actions?: ReactNode;
  /** At the far end of the row, outside every button: when the answer came, for example. */
  end?: ReactNode;
  /** Designsystemet's `data-color` for the block. Neutral unless given, as kunnskapsassistenten. */
  color?: string | undefined;
  className?: string | undefined;
}

/** How long a copy receipt stays on screen. */
export const RECEIPT_MS = 4000;

/** Shows each new receipt the app passes, and clears it after {@link RECEIPT_MS}. */
const useReceipt = (copied: AnswerCopied | undefined) => {
  const [shown, setShown] = useState(copied);
  useEffect(() => {
    setShown(copied);
    if (!copied) return;
    const timer = setTimeout(() => setShown(undefined), RECEIPT_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  return shown;
};

/**
 * What a reader can do with a finished answer: copy it, copy the link to its thread, and
 * say whether it was useful. The block only raises events; the app copies and sends, and
 * passes back what happened.
 */
export const AnswerActions = ({
  onCopyAnswer,
  onCopyLink,
  linkOnlyHere,
  copied,
  feedback = false,
  onFeedback,
  feedbackStatus,
  actions,
  end,
  color = 'neutral',
  className,
}: AnswerActionsProps) => {
  const t = useT();
  const noteId = useId();
  const receiptRef = useRef<HTMLParagraphElement>(null);
  const receipt = useReceipt(copied);
  const note = t('answerActions.linkOnlyHere');

  // The receipt grows the column under a reader at the end; `nearest` moves it no further
  // than it must. A drawn focus ring then takes back what it needs; a pointer draws none.
  useEffect(() => {
    if (!receipt) return;
    const focused = document.activeElement;
    receiptRef.current?.scrollIntoView?.({ block: 'nearest' });
    if (focused instanceof HTMLElement && focused.matches(':focus-visible'))
      focused.scrollIntoView?.({ block: 'nearest' });
  }, [receipt]);

  const copies = Boolean(onCopyAnswer || onCopyLink);
  const row = copies || actions !== undefined || end !== undefined;
  const asks = feedback && onFeedback !== undefined;
  if (!row && !asks) return null;

  const receiptText = !receipt
    ? ''
    : receipt.kind === 'failed'
      ? t('answerActions.copyFailed')
      : receipt.kind === 'link'
        ? linkOnlyHere
          ? `${t('answerActions.linkCopied')} ${note}.`
          : t('answerActions.linkCopied')
        : receipt.sources
          ? t('answerActions.copiedWithSources', { count: receipt.sources })
          : t('answerActions.copied');

  const linkButton = onCopyLink ? (
    <Button
      aria-describedby={linkOnlyHere ? noteId : undefined}
      data-size="sm"
      onClick={onCopyLink}
      variant="tertiary"
    >
      <ClipboardLinkIcon aria-hidden />
      {t('answerActions.copyLink')}
    </Button>
  ) : null;

  return (
    <div className={classes('uib-answer-actions', className)} data-color={color}>
      {row ? (
        <div className="uib-answer-actions-row">
          {onCopyAnswer ? (
            <Button data-size="sm" onClick={onCopyAnswer} variant="tertiary">
              <ClipboardIcon aria-hidden />
              {t('answerActions.copyAnswer')}
            </Button>
          ) : null}
          {/* The limit is a description and not part of the name, so the row keeps its
              height where the column is narrow. */}
          {linkButton && linkOnlyHere ? <Tooltip content={note}>{linkButton}</Tooltip> : linkButton}
          {/* `hidden`: the description still reaches the button, and the sentence is not a
              second stop for a reader walking the row. One string, or a gap before the dot. */}
          {linkButton && linkOnlyHere ? <span hidden id={noteId}>{`${note}.`}</span> : null}
          {actions}
          {end !== undefined ? <span className="uib-answer-actions-end">{end}</span> : null}
          {/* Always drawn while there is something to copy, never hidden while empty: a
              live region and its text that arrive in the same frame announce nothing. */}
          {copies ? (
            <p aria-live="polite" className="uib-answer-actions-receipt" ref={receiptRef}>
              {receiptText}
            </p>
          ) : null}
        </div>
      ) : null}
      {asks ? <Feedback status={feedbackStatus} onSend={onFeedback} /> : null}
    </div>
  );
};
