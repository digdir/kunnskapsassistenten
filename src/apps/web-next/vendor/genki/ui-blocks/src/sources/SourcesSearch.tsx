import { Label, Paragraph, Search } from '@digdir/designsystemet-react';
import { useId } from 'react';
import { searchStatus, SearchSteps } from '../markdown/SearchSteps.js';
import { useT } from './i18n.js';

export interface SourcesSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  hitCount: number;
  /** Zero-based; the reader reads it one-based. */
  currentHitIndex: number;
  onStep: (step: 1 | -1) => void;
  describedBy?: string | undefined;
  /** The field's name, «Søk i kildene» by default. */
  label?: string | undefined;
  /** The words in the empty field, «Søk» by default. */
  placeholder?: string | undefined;
  /** The name for a screen reader only, where the placeholder says it (the `tool` variant). */
  labelHidden?: boolean | undefined;
}

/** A filter over the excerpts already drawn. The counter is a live region, as `<mark>` is silent. */
export const SourcesSearch = ({
  query,
  onQueryChange,
  hitCount,
  currentHitIndex,
  onStep,
  describedBy,
  label,
  placeholder,
  labelHidden = false,
}: SourcesSearchProps) => {
  const t = useT();
  const fieldId = useId();
  const status = searchStatus(
    {
      min: (n) => t('sources.searchMin', { n }),
      none: t('sources.searchNone'),
      count: (n, total) => t('sources.searchCount', { n, total }),
    },
    query,
    hitCount,
    currentHitIndex,
  );

  return (
    <search className="uib-sources-search">
      {/* Search.Clear is a reset button, which needs a form. */}
      <form className="uib-sources-search-form" onSubmit={(event) => event.preventDefault()}>
        <Label htmlFor={fieldId} className={labelHidden ? 'ds-sr-only' : undefined}>
          {label ?? t('sources.search')}
        </Label>
        <Search data-sr-clear={t('sources.clearSearch')}>
          <Search.Input
            id={fieldId}
            name="uib-sources-search"
            aria-describedby={describedBy}
            placeholder={placeholder ?? t('sources.searchPlaceholder')}
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
          />
          <Search.Clear aria-label={t('sources.clearSearch')} onClick={() => onQueryChange('')} />
        </Search>
        <div className="uib-sources-search-results" data-empty={status ? undefined : true}>
          <Paragraph data-size="xs" aria-live="polite" className="uib-sources-search-status">
            {status}
          </Paragraph>
          <SearchSteps
            className="uib-sources-search-steps"
            hitCount={hitCount}
            currentHitIndex={currentHitIndex}
            onStep={onStep}
            previous={t('sources.previous')}
            next={t('sources.next')}
            previousName={t('sources.previousHit')}
            nextName={t('sources.nextHit')}
          />
        </div>
      </form>
    </search>
  );
};
