import { Button, Label, Search } from '@digdir/designsystemet-react';
import { XMarkIcon } from '@navikt/aksel-icons';
import { useId, type RefObject } from 'react';
import { MIN_QUERY_LENGTH } from '../../components';

export type AnswerSearchProps = {
  query: string;
  onQueryChange: (query: string) => void;
  /** How many `<mark>` elements the answer ended up with. */
  hitCount: number;
  /** Zero-based position in the hit list; the reader reads it one-based. */
  currentHitIndex: number;
  onStep: (step: 1 | -1) => void;
  /** Escape, and the close button. */
  onClose: () => void;
  fieldRef: RefObject<HTMLInputElement | null>;
  /** Which answer is being searched. It matters because the strip is pinned
      to the top of the column, not to the answer, so detached from its card
      it has to say what it is searching. */
  label: string;
};

/** Search inside one answer, the same control as the sources panel's. **It
    does not take Ctrl+F**, and the counter is a live region, because `<mark>`
    is not announced and the count is the only sign anything happened. */
export function AnswerSearch({
  query,
  onQueryChange,
  hitCount,
  currentHitIndex,
  onStep,
  onClose,
  fieldRef,
  label,
}: AnswerSearchProps) {
  const fieldId = useId();

  const atFirst = currentHitIndex === 0;
  const atLast = currentHitIndex >= hitCount - 1;

  const typed = query.trim().length;
  const status =
    typed === 0
      ? ''
      : typed < MIN_QUERY_LENGTH
        ? `Skriv minst ${MIN_QUERY_LENGTH} tegn`
        : hitCount === 0
          ? 'Ingen treff'
          : `${currentHitIndex + 1} av ${hitCount} treff`;

  return (
    // `<search>` is the landmark; the `<form>` inside it is what `Search.Clear`
    // needs, since it is a `type='reset'` button and a reset button outside a
    // form does nothing.
    <search className="ka-answer-search">
      {/* The keydown sits on the form, so Escape also closes from the step
          buttons. The form takes no focus and no role; it listens to what
          bubbles up from the real controls inside it. */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <form
        className="ka-answer-search__form"
        // Nothing to submit: the search runs as the reader types. Without this
        // Enter reloads the page.
        onSubmit={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          onClose();
        }}
      >
        {/* Visible, because the strip no longer sits in the card it searches.
            It is the label of the field as well as the title of the strip, so
            it is one element and not two. */}
        <Label htmlFor={fieldId} data-size="sm" className="ka-answer-search__label">
          {label}
        </Label>

        <Search data-size="sm" className="ka-answer-search__field">
          <Search.Input
            id={fieldId}
            name="svar-sok"
            placeholder="Søk i svaret"
            ref={fieldRef}
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
          />
          {/* type='reset' clears the DOM value; the state behind it has to be
              cleared too, or React puts the old value straight back. */}
          <Search.Clear onClick={() => onQueryChange('')} />
        </Search>

        <p aria-live="polite" className="ka-answer-search__count">
          {status}
        </p>

        {/* No previous/next before there is something to step through: a
            disabled control the reader has never been able to use only adds a
            tab stop and a question. Same call as in the sources panel. */}
        {hitCount > 0 ? (
          <div className="ka-answer-search__steps">
            <Button
              type="button"
              variant="tertiary"
              data-color="neutral"
              data-size="sm"
              aria-label="Forrige treff i svaret"
              aria-disabled={atFirst || undefined}
              onClick={() => !atFirst && onStep(-1)}
            >
              Forrige
            </Button>
            <Button
              type="button"
              variant="tertiary"
              data-color="neutral"
              data-size="sm"
              aria-label="Neste treff i svaret"
              aria-disabled={atLast || undefined}
              onClick={() => !atLast && onStep(1)}
            >
              Neste
            </Button>
          </div>
        ) : null}

        <Button
          type="button"
          variant="tertiary"
          data-color="neutral"
          data-size="sm"
          aria-label="Lukk søk i svaret"
          onClick={onClose}
        >
          <XMarkIcon aria-hidden />
        </Button>
      </form>
    </search>
  );
}
