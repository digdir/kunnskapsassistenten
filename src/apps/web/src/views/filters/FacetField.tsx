import {
  Button,
  EXPERIMENTAL_Suggestion as Suggestion,
  Field,
  Label,
  ValidationMessage,
} from '@digdir/designsystemet-react';
import { useImperativeHandle, useRef, type Ref } from 'react';
import type { FilterFacet } from '../../model';

/**
 * Norwegian screen reader strings for the multi-select.
 *
 * Measured, not guessed: with `lang="nb"` and Designsystemet 1.21.0, only the
 * clear and toggle buttons get Norwegian names. Everything u-combobox writes
 * for the selected values stays English — the chip container is announced as
 * «Selected», the input's `aria-description` as «No selected», and a chip as
 * «…, Press to remove». In a service that has to be Norwegian all the way
 * into the accessible names, that is a defect, not a detail.
 *
 * `data-sr-*` is u-combobox's own override: the keys are its observed
 * attributes, and an empty value falls back to the English default. See
 * @u-elements/u-combobox, `TEXTS` and `observedAttributes`.
 */
const SCREEN_READER_TEXTS = {
  'data-sr-items': 'Valgte verdier',
  'data-sr-empty': 'Ingen verdier er valgt',
  'data-sr-found': '%d valgt, naviger bakover for å endre',
  'data-sr-added': 'Lagt til',
  'data-sr-removed': 'Fjernet',
  'data-sr-invalid': 'Ugyldig verdi',
  'data-sr-of': 'av',
};

/** What the view may do with a field from outside: put the keyboard in it. */
export type FacetFieldHandle = { focus: () => void };

/**
 * The most values one field can be narrowed to.
 *
 * The backend's rule and not ours: headless-rag #15 takes 1 to 100 values per
 * field, and the BFF answers more with `400 filter-too-many-values` instead of
 * cutting the list without a word, as it used to
 * (design/_briefs/bygg/form-d16-filtre-2026-09-29.md). The reader is told
 * here, before the question, rather than by an error after it.
 */
const MAX_VALUES_PER_FIELD = 100;

export type FacetFieldProps = {
  /** For the view's focus handling after the active filter goes (ActiveFilter). */
  ref?: Ref<FacetFieldHandle>;
  facet: FilterFacet;
  /** Selected {@link FacetValue.value}s. Empty means «no restriction». */
  selected: string[];
  onChange: (values: string[]) => void;
};

/**
 * One filter dimension as a multi-select dropdown.
 *
 * Designsystemet's Suggestion with `multiple`, as decided. Three things
 * are worth knowing about it, all from design/designsystemet/suggestion.md:
 *
 *   1. Selected values render as chips inside the field. That is the chip
 *      requirement (answer 50) already satisfied, so we do not add a second
 *      row of Chip.Removable — showing both would show every filter twice.
 *   2. The list is locked to the width of the input by an inline style unless
 *      `data-overscroll="contain"` turns that off. It does, and the width
 *      then has to come from our own CSS. The design draws the list wider
 *      than the field, and the labels here are long enough to need it.
 *   3. `autoPlacement` is a dead prop in 1.21.0 — destructured and never
 *      used. `data-autoplacement` is the attribute that works.
 *
 * Suggestion.Clear only clears the text the user has typed, not the
 * selection: u-combobox hides it whenever the input is empty. «Tøm» is
 * therefore our own button, which is also what answer 50 asks for.
 */
export function FacetField({ ref, facet, selected, onChange }: FacetFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);
  const total = facet.values.length;
  const chosen = selected.length;
  const allChosen = chosen === total;

  /*
   * Suggestion must be given `{ label, value }`, not bare strings: a bare
   * string becomes both the label and the value, and the chip then shows the
   * key («arsrapport») instead of the name («Årsrapport»). Measured, not
   * assumed — see `sanitizeItems` in the component.
   */
  const selectedItems = selected.map((value) => ({
    value,
    label: facet.values.find((candidate) => candidate.value === value)?.label ?? value,
  }));

  /*
   * Which dimension a chip is removed from, in the chip's own name.
   *
   * u-combobox builds a chip's accessible name as `label`, then
   * `data-sr-remove`: «Årsrapport, Trykk for å fjerne». Three fields hold
   * chips, and a reader walking them heard the same four words after every
   * value with nothing saying which filter they were in. Naming the dimension
   * here puts it where the chip is read rather than in a second live region.
   */
  const screenReaderTexts = {
    ...SCREEN_READER_TEXTS,
    'data-sr-remove': `Trykk for å fjerne fra ${facet.label.toLocaleLowerCase('nb-NO')}`,
  };

  /*
   * The label for the selected state (question 4, still unanswered).
   * Chosen: the dimension name stays the field's Label, and the state goes in
   * the description under it. Renaming a control as its value changes is what
   * the Figma sketch does with «Alle valgt», and it breaks the promise a
   * label makes to a screen reader user — the name has to stay put.
   *
   * Three states, three sentences. «Alle valgt» used to cover both an
   * untouched field and one where the user had picked every value, which made
   * the two word for word identical: the reader could not tell whether a
   * filter was set, and «Velg alle» offered an action whose result the text
   * already claimed (brukerblikk, funn 3). An empty selection is no
   * restriction — that is still the logic — but it is not the same thing as
   * having chosen everything, and now it does not say so.
   */
  /*
   * «Alle valgt» says what it means as well (D16): every value chosen is no
   * narrowing at all, and the field is not sent — the BFF strikes it, and
   * sending 457 organisations would break the limit below for nothing. The
   * two states still read differently, which is what funn 3 asked for; this
   * one only adds the consequence.
   */
  const state =
    chosen === 0
      ? 'Ingen avgrensning'
      : allChosen
        ? `Alle ${total} valgt, altså ingen avgrensning`
        : `${chosen} av ${total} valgt`;

  /*
   * Over the limit and short of all: a question asked like this would be
   * turned away. The way out is in the sentence — fewer, or all, which is no
   * narrowing and is not sent.
   */
  const overLimit = chosen > MAX_VALUES_PER_FIELD && !allChosen;

  /*
   * Empties the search text.
   *
   * Picking a value from the list leaves the value key in the input —
   * `u-combobox` only restores what the user typed when the click arrives
   * through the native datalist path, and it does not here. The list is
   * filtered on that text, so the next open would show «Ingen treff».
   * Clearing after every change is what a multi-select should do anyway: the
   * search is spent once the value is a chip.
   *
   * The event is dispatched because both `u-combobox` and Suggestion's own
   * filtering listen for it; setting `value` alone would leave both stale.
   */
  function clearQuery() {
    const input = inputRef.current;
    if (!input || input.value === '') return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function change(values: string[]) {
    clearQuery();
    onChange(values);
  }

  /*
   * «Velg alle» and «Tøm» are rendered on the very state they change, so
   * React takes the button out of the DOM in the same render and focus falls
   * to `document.body`. A keyboard user would be thrown back above the skip
   * link on every choice (WCAG 2.4.3). The field below the button is where
   * they are going next, so focus moves there first, while the button still
   * exists.
   *
   * Only from these two buttons. `onSelectedChange` must not focus the
   * input: the user may be inside the chips, where ArrowLeft and Enter walk
   * and remove, and pulling focus out would break that.
   */
  function changeFromButton(values: string[]) {
    inputRef.current?.focus();
    change(values);
  }

  return (
    <Field>
      <div className="facet-field__label-row">
        <Label>{facet.label}</Label>

        <div className="facet-field__actions">
          {!allChosen && (
            <Button
              variant="tertiary"
              data-color="neutral"
              data-size="sm"
              aria-label={`Velg alle ${facet.label.toLocaleLowerCase('nb-NO')}`}
              onClick={() => changeFromButton(facet.values.map((value) => value.value))}
            >
              Velg alle
            </Button>
          )}
          {chosen > 0 && (
            <Button
              variant="tertiary"
              data-color="neutral"
              data-size="sm"
              aria-label={`Tøm ${facet.label.toLocaleLowerCase('nb-NO')}`}
              onClick={() => changeFromButton([])}
            >
              Tøm
            </Button>
          )}
        </div>
      </div>

      {/*
        Over the chips and not after them, where Designsystemet usually puts a
        validation message: the message only exists when more than a hundred
        values are ticked, and under a hundred chips it was a scroll away
        from anyone who could act on it (measured at 101 of 457). `ds-field`
        links it to the input wherever it stands.
      */}
      {overLimit && (
        <ValidationMessage>
          {`Høyst ${MAX_VALUES_PER_FIELD} kan brukes i ett felt, og ${chosen} er valgt. Fjern noen, eller velg alle.`}
        </ValidationMessage>
      )}

      <Suggestion
        multiple
        selected={selectedItems}
        onSelectedChange={(items) => change(items.map((item) => item.value))}
        {...screenReaderTexts}
      >
        {/*
          The placeholder names the dimension. All three fields had the bare
          word «Søk», so the three of them read as one repeated control even
          though each has its own <label> (brukerblikk, funn 16).
        */}
        <Suggestion.Input
          ref={inputRef}
          placeholder={`Søk i ${facet.label.toLocaleLowerCase('nb-NO')}`}
        />
        <Suggestion.Toggle />
        <Suggestion.Clear />
        <Suggestion.List data-overscroll="contain" data-autoplacement="false">
          <Suggestion.Empty>Ingen treff</Suggestion.Empty>
          {facet.values.map((value) => (
            /*
              `label` is what the chip and the filtering use, the children are
              what the list shows. Keeping the count out of the label means a
              chip reads «Årsrapport», not «Årsrapport (1032)».
            */
            <Suggestion.Option key={value.value} value={value.value} label={value.label}>
              {value.count === undefined ? value.label : `${value.label} (${value.count})`}
            </Suggestion.Option>
          ))}
        </Suggestion.List>
      </Suggestion>

      <Field.Description>{state}</Field.Description>
    </Field>
  );
}
