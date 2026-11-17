// The filter where it is not edited (dev-filter-panel, «9 · Filtrering» B and choice 6): what an
// answer read from, inside «Fremgangsmåte», and what the next question will read from, under the
// field. Both name the values as the filter's rows do (`valueLabels`), and neither is a control:
// the filter is changed only in the filter.
import { Tag } from '@digdir/designsystemet-react';
import { useFormat } from '@genai/i18n/react';
import { FilterIcon } from '@navikt/aksel-icons';
import { useId } from 'react';
import { classes } from '../dom.js';
import { useT } from './i18n.js';
import { fieldValueLabels, narrowing, valueLabels } from './selection.js';
import type { FilterField, FilterSelection } from './types.js';

export interface FilterReadProps {
  /** What the question was asked with. */
  selection: FilterSelection;
  /** The fields, for the values' labels; without them a value is named as it is. */
  fields?: readonly FilterField[] | undefined;
  /** How many documents that reads from (`documentCount`); left out when not known. */
  count?: number | undefined;
  className?: string | undefined;
}

/** «Leste fra 8 781 dokumenter:» and the chosen values as chips, alike and not clickable. */
export const FilterRead = ({ selection, fields, count, className }: FilterReadProps) => {
  const t = useT();
  const values = valueLabels(selection, fields);
  if (values.length === 0 && count === undefined) return null;
  const lead =
    values.length === 0
      ? t('filter.readFrom', { count: count ?? 0 })
      : count === undefined
        ? t('filter.readFromUncounted')
        : t('filter.readFromNarrowed', { count });
  return (
    <div className={classes('uib-filter-read', className)}>
      <span className="uib-filter-read-lead">
        <FilterIcon aria-hidden />
        {lead}
      </span>
      {values.length > 0 ? (
        <ul className="uib-filter-read-values" aria-label={t('filter.inAnswer')}>
          {values.map((value) => (
            <li key={value} className="uib-filter-read-value">
              {value}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export interface FilterBasisProps {
  /** What the question was asked with. */
  selection: FilterSelection;
  /** The fields, in their order, each a row; without them a chosen field is named by its id. */
  fields?: readonly FilterField[] | undefined;
  /** How many documents that reads from (`documentCount`); the lead is drawn only when known. */
  count?: number | undefined;
  /** How many of them the answer used. */
  used?: number | undefined;
  /** What the answer before it was asked with, for «Endret siden forrige svar». */
  previous?: FilterSelection | undefined;
  className?: string | undefined;
}

/** A field's values as asked: none, or every value it lists, narrows nothing. */
const askedIn = (asked: FilterSelection, id: string) => asked[id] ?? [];

/** What changed from one selection to the next, field by field: the values added and taken out. */
const changesOf = (
  before: FilterSelection,
  after: FilterSelection,
  fields: readonly FilterField[] | undefined,
) => {
  const ids = [
    ...new Set([
      ...(fields ?? []).map((field) => field.id),
      ...Object.keys(before),
      ...Object.keys(after),
    ]),
  ];
  const added: string[] = [];
  const removed: string[] = [];
  for (const id of ids) {
    const field = fields?.find((one) => one.id === id);
    const was = new Set(askedIn(before, id));
    const is = new Set(askedIn(after, id));
    added.push(
      ...fieldValueLabels(
        field,
        [...is].filter((value) => !was.has(value)),
      ),
    );
    removed.push(
      ...fieldValueLabels(
        field,
        [...was].filter((value) => !is.has(value)),
      ),
    );
  }
  return { added, removed };
};

/**
 * «Filteret svaret bygger på» at the top of Fremgangsmåte (dev-fremgangsmate-1): how many
 * documents the answer read from and used, then each field with what it was asked with, «Alle»
 * when it narrowed nothing, and «Endret siden forrige svar» when the filter changed. A field's
 * chosen values are Tags, a year field's periods text. Not a control: the filter is changed only
 * in the filter.
 */
export const FilterBasis = ({
  selection,
  fields,
  count,
  used,
  previous,
  className,
}: FilterBasisProps) => {
  const t = useT();
  const f = useFormat();
  const headingId = useId();
  const asked = narrowing(selection, fields);
  const unknown = Object.keys(asked).filter(
    (id) => askedIn(asked, id).length > 0 && !fields?.some((field) => field.id === id),
  );
  const rows = [
    ...(fields ?? []).map((field) => ({
      id: field.id,
      field,
      label: field.heading ?? field.label,
    })),
    ...unknown.map((id) => ({ id, field: undefined, label: id })),
  ];
  const changes = previous ? changesOf(narrowing(previous, fields), asked, fields) : undefined;
  const changed = changes
    ? [
        ...(changes.added.length
          ? [t('filter.basisAdded', { values: f.list(changes.added) })]
          : []),
        ...(changes.removed.length
          ? [t('filter.basisRemoved', { values: f.list(changes.removed) })]
          : []),
      ]
    : [];
  return (
    <section className={classes('uib-filter-basis', className)} aria-labelledby={headingId}>
      <p id={headingId} className="uib-filter-basis-heading">
        {t('filter.basis')}
      </p>
      {count !== undefined ? (
        <p className="uib-filter-basis-lead">
          {t('filter.basisReadFrom')} <strong>{t('filter.basisDocuments', { count })}</strong>.
          {used !== undefined ? ` ${t('filter.basisUsed', { count: used })}` : null}
        </p>
      ) : null}
      {rows.length > 0 || changed.length > 0 ? (
        <dl className="uib-filter-basis-fields">
          {rows.map(({ id, field, label }) => {
            const values = askedIn(asked, id);
            const labels = fieldValueLabels(field, values);
            return (
              <div key={id} className="uib-filter-basis-row">
                <dt>{label}</dt>
                <dd>
                  {labels.length === 0
                    ? field?.kind === 'year'
                      ? t('filter.allYears')
                      : t('filter.all')
                    : field?.kind === 'year'
                      ? labels.join(', ')
                      : labels.map((value) => (
                          <Tag key={value} data-color="accent" data-size="sm">
                            {value}
                          </Tag>
                        ))}
                </dd>
              </div>
            );
          })}
          {changed.length > 0 ? (
            <div className="uib-filter-basis-row">
              <dt>{t('filter.basisChanged')}</dt>
              <dd>{changed.join(', ')}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </section>
  );
};

export interface FilterNextProps {
  /** What the next question will be asked with. */
  selection: FilterSelection;
  fields?: readonly FilterField[] | undefined;
  /** How many documents that reads from (`documentCount`). The line is drawn only when known. */
  count?: number | undefined;
  /** Where the filter is changed, «endres i filteret til venstre» by default. */
  where?: string | undefined;
  className?: string | undefined;
}

/** «Neste spørsmål leser fra 8 781 dokumenter · Evaluering · 2020–2025 – endres i filteret til venstre». */
export const FilterNext = ({ selection, fields, count, where, className }: FilterNextProps) => {
  const t = useT();
  if (count === undefined) return null;
  const reads = [t('filter.next', { count }), ...valueLabels(selection, fields)].join(' · ');
  return (
    <p className={classes('uib-filter-next', className)}>
      <FilterIcon aria-hidden className="uib-filter-next-icon" />
      <span>{t('filter.nextLine', { reads, where: where ?? t('filter.nextWhere') })}</span>
    </p>
  );
};
