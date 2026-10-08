import { Button, Input, Label, Skeleton } from '@digdir/designsystemet-react';

/**
 * One filter field while the facets load, as tall as the field that takes
 * its place.
 *
 * The panel used to draw three bare 56 px bars, 200 px in all, where the
 * three fields are 125 px each with the panel's gap between them. When the
 * facets came, everything under them — the corpus line, «Vis mer», the
 * documents — moved 239 px down at 1440 and 235 px at 390, and a click aimed
 * at «Vis mer» while the panel loaded could land on whatever came there
 * instead (measured on main 098ea7c; it is how an e2e test failed on main
 * 652cc8c, #282).
 *
 * So the placeholder is built from what a field is built from, and each part
 * is a Skeleton wrapped around the real thing: Designsystemet sizes a
 * Skeleton with children to them and hides them (skeleton.md, «Skeleton med
 * barn»). The label row is as tall as its «Velg alle» button, the input bar
 * as tall as the input, the description as tall as its line — with no
 * number of our own to keep in step with the tokens.
 *
 * Rendered by the view in a field's place, one per field, so the panel's own
 * gap goes between them as it does between the fields. `ds-field` on the
 * box and `data-field="description"` on the last line give the parts the
 * spacing Designsystemet gives a field's: 8 px under the label row and none
 * over the description. `inert` and
 * `aria-hidden` because the parts are real elements kept only for their
 * size: the button cannot be reached or pressed, and nothing here is read.
 * The view says it is loading with `aria-busy` and its live region.
 */
export function FieldPlaceholder() {
  return (
    <div className="ds-field filters-view__loading field-placeholder" aria-hidden="true" inert>
      <div className="facet-field__label-row">
        <Skeleton>
          <Label>Dokumenttyper</Label>
        </Skeleton>
        <Skeleton>
          <Button variant="tertiary" data-color="neutral" data-size="sm" tabIndex={-1}>
            Velg alle
          </Button>
        </Skeleton>
      </div>
      <Skeleton className="field-placeholder__input">
        <Input readOnly tabIndex={-1} />
      </Skeleton>
      <Skeleton data-field="description">Ingen avgrensning</Skeleton>
    </div>
  );
}
