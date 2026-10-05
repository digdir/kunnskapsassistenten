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
  /**
   * Which answer is being searched: «Søk i svar 2 av 3», or «Søk i svaret»
   * in a conversation with one.
   *
   * It matters because the strip is pinned to the top of the column and not
   * to the answer it belongs to. Detached from its card it has to say what it
   * is searching, the same way the sources panel's pinned head says «Kilder
   * til svar 1 av 2».
   */
  label: string;
};

/**
 * Search inside one answer (design/brukerreiser-2026-09-15.md, punkt 13).
 *
 * The sources panel has had a search with a hit counter and previous/next
 * since PR #26, and the answer beside it had nothing — so a reader looking for
 * one number in a long answer had the browser's own find or nothing. This is
 * the same control, in the answer's action row, and deliberately the same
 * shape: `Search` with `Search.Clear`, a live counter, «Forrige» and «Neste»
 * that stop at the ends rather than wrapping (brukerblikk 2026-09-15, funn
 * 11), and `aria-disabled` rather than `disabled` so stepping never drops the
 * keyboard out of the control.
 *
 * It does not take Ctrl+F. The browser's find is the one keyboard shortcut
 * every reader already has, and a page that swallows it takes away a working
 * tool to offer its own — the brief asks for an alternative to it, not a
 * replacement. Escape closes, which is what a reader expects of a strip that
 * opened over what they were reading.
 *
 * The counter is a live region for the same reason as in the sources panel:
 * `<mark>` is not announced, so «2 av 7 treff» is the only thing that tells a
 * screen reader user the search did anything.
 */
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
      {/*
        The keydown sits on the form rather than on the field, so Escape also
        closes from the step buttons — a reader who has tabbed to «Neste» is
        still inside the search and expects the same key to get out of it. The
        rule below guards against giving a non-interactive element the
        behaviour of a control; nothing of the sort happens here. The form
        takes no focus and gets no role, it only listens to what bubbles up
        from the controls inside it, and every one of those is a real one.
      */}
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
