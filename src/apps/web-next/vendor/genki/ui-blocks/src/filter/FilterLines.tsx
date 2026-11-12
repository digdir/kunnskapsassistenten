// The filter where it is not edited (dev-filter-panel, «9 · Filtrering» B and choice 6): what an
// answer read from, inside «Fremgangsmåte», and what the next question will read from, under the
// field. Both name the values as the filter's rows do (`valueLabels`), and neither is a control:
// the filter is changed only in the filter.
import { FilterIcon } from '@navikt/aksel-icons';
import { classes } from '../dom.js';
import { useT } from './i18n.js';
import { valueLabels } from './selection.js';
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
