import { Button, Input, Label, Skeleton } from '@digdir/designsystemet-react';

/** A filter field while the facets load, as tall as the real one, so nothing below moves.
    Skeletons around real elements, which Designsystemet sizes to their children, so no height
    of ours drifts from the tokens. `inert` and `aria-hidden`: kept only for their size. */
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
