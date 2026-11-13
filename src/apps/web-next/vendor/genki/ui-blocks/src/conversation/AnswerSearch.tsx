import { Button, Label, Search } from '@digdir/designsystemet-react';
import { XMarkIcon } from '@navikt/aksel-icons';
import { useId, type RefObject } from 'react';
import { searchStatus, SearchSteps } from '../markdown/SearchSteps.js';
import { useT } from './i18n.js';

export interface AnswerSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  hitCount: number;
  /** Zero-based; the reader reads it one-based. */
  currentHitIndex: number;
  onStep: (step: 1 | -1) => void;
  /** Escape, and the close button. */
  onClose: () => void;
  fieldRef: RefObject<HTMLInputElement | null>;
  /** Which answer it searches: the strip is pinned over the conversation, not in the answer. */
  label: string;
}

/**
 * Search in one answer, with the status and steps Sources' search uses (`markdown/SearchSteps`),
 * in this block's own words. It leaves the browser's own find alone, and the counter is a live
 * region, because a `<mark>` is not announced and the count is the only sign anything happened.
 */
export const AnswerSearch = ({
  query,
  onQueryChange,
  hitCount,
  currentHitIndex,
  onStep,
  onClose,
  fieldRef,
  label,
}: AnswerSearchProps) => {
  const t = useT();
  const fieldId = useId();
  const status = searchStatus(
    {
      min: (n) => t('conversation.searchMin', { n }),
      none: t('conversation.searchNone'),
      count: (n, total) => t('conversation.searchCount', { n, total }),
    },
    query,
    hitCount,
    currentHitIndex,
  );

  return (
    <search className="uib-conversation-search">
      {/* Search.Clear is a reset button, which needs a form. Escape is heard on the form, so it
          also closes from the step buttons. */}
      <form
        className="uib-conversation-search-form"
        onSubmit={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          onClose();
        }}
      >
        {/* Visible, since the strip is not in the answer it searches: the field's name and the
            strip's title in one. */}
        <Label htmlFor={fieldId} data-size="sm" className="uib-conversation-search-label">
          {label}
        </Label>
        <Search data-size="sm" className="uib-conversation-search-field">
          <Search.Input
            id={fieldId}
            name="uib-conversation-search"
            placeholder={t('conversation.searchPlaceholder')}
            ref={fieldRef}
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
          />
          {/* The reset clears the field; the state behind it is cleared too, or React puts the
              old value straight back. */}
          <Search.Clear
            aria-label={t('conversation.clearSearch')}
            onClick={() => onQueryChange('')}
          />
        </Search>
        <p aria-live="polite" className="uib-conversation-search-count">
          {status}
        </p>
        <SearchSteps
          className="uib-conversation-search-steps"
          hitCount={hitCount}
          currentHitIndex={currentHitIndex}
          onStep={onStep}
          previous={t('conversation.previous')}
          next={t('conversation.next')}
          previousName={t('conversation.previousHit')}
          nextName={t('conversation.nextHit')}
        />
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          aria-label={t('conversation.closeSearch')}
          onClick={onClose}
        >
          <XMarkIcon aria-hidden />
        </Button>
      </form>
    </search>
  );
};
