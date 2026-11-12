import { Field, Label, Link, Paragraph, Select } from '@digdir/designsystemet-react';
import { useFormat } from '@genai/i18n/react';
import { useId, useState } from 'react';
import { freshText, useFilterAnnouncer } from '../filter/announce.js';
import { documentCount } from '../filter/selection.js';
import type { FilterField } from '../filter/types.js';
import { useT } from './i18n.js';

/** One document collection a reader can search: a dataset the service may use. */
export interface CorpusOption {
  /** What the platform calls it: `dataset-config-key`. */
  key: string;
  /** What the reader sees, «Kudos»; a sentence uses the part before a comma. */
  label: string;
  /** What is in it, in the dataset's own words. */
  description?: string | undefined;
}

/** A collection's name in a sentence: its label up to the first comma, if any. */
export const corpusName = (corpus: CorpusOption | undefined) => {
  const name = corpus?.label.split(',')[0]?.trim();
  return name === '' ? undefined : name;
};

/** Types named before «med flere». One over is named too: «med flere» would say less. */
const MAX_TYPES = 5;

export interface CorpusLineProps {
  /** The collection searched, when one is known. */
  corpus?: CorpusOption | undefined;
  /** The fields with their facets, unnarrowed, so a ticked box cannot shrink the collection. */
  fields?: readonly FilterField[] | undefined;
  /** The field holding the document type; its values are counted and named, biggest first. */
  typeField?: string | undefined;
  /** What many of a type are called: «Årsrapport» is «årsrapporter». */
  typePlurals?: Readonly<Record<string, string>> | undefined;
  className?: string | undefined;
}

/** The line in two parts: `source` stays on screen, `detail` is behind «Vis mer». */
export const useCorpusText = ({
  corpus,
  fields,
  typeField,
  typePlurals,
}: Pick<CorpusLineProps, 'corpus' | 'fields' | 'typeField' | 'typePlurals'>) => {
  const t = useT();
  const f = useFormat();
  const types = fields?.find((field) => field.id === typeField);
  const years = fields?.find((field) => field.kind === 'year');

  // Summed over one field, as each document has one; undefined when a count is missing. The same
  // sum as the filter's own count, so the two never disagree.
  const total = documentCount(fields, {}, typeField);

  // Biggest first, so the cut keeps the types that make up the collection.
  const ordered = [...(types?.options ?? [])].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  const truncated = ordered.length > MAX_TYPES + 1;
  const named = (truncated ? ordered.slice(0, MAX_TYPES) : ordered).map((option) => {
    const label = option.label ?? option.value;
    return typePlurals?.[label] ?? label.toLocaleLowerCase(t.locale);
  });
  const typeText =
    named.length === 0
      ? ''
      : truncated
        ? t('corpus.andMore', { types: f.list(named) })
        : f.list(named);

  const yearValues = (years?.options ?? [])
    .map((option) => Number.parseInt(option.label ?? option.value, 10))
    .filter((year) => Number.isFinite(year));
  const first = Math.min(...yearValues);
  const last = Math.max(...yearValues);
  const yearText =
    yearValues.length === 0 ? '' : first === last ? String(first) : `${first}–${last}`;

  const clauses = (
    fields
      ? [total === undefined ? '' : t('corpus.documents', { count: total }), typeText, yearText]
      : []
  ).filter((clause) => clause !== '');

  const source = t('corpus.source', { name: corpusName(corpus) ?? t('corpus.unnamed') });
  if (clauses.length > 0) return { source, detail: clauses.join(', ') };
  // Nothing to count: the collection's own words, and `source` still says where from.
  return { source, detail: corpus?.description };
};

/** The collection's name, the rest behind «Vis mer», which stays open across a switch. */
export const CorpusLine = ({ className, ...props }: CorpusLineProps) => {
  const t = useT();
  const { source, detail } = useCorpusText(props);
  const [open, setOpen] = useState(false);
  const detailId = useId();

  return (
    <Paragraph asChild data-size="xs">
      <div className={['uib-corpus-line', className].filter(Boolean).join(' ')}>
        <span>{source}</span>

        {detail && (
          <>
            {/* A `button` for `aria-expanded`, drawn as `Link` to keep the text's height. */}
            <Link asChild className="uib-corpus-toggle">
              <button
                type="button"
                aria-label={open ? t('corpus.lessAbout') : t('corpus.moreAbout')}
                aria-expanded={open}
                aria-controls={detailId}
                onClick={() => setOpen((shown) => !shown)}
              >
                {open ? t('corpus.less') : t('corpus.more')}
              </button>
            </Link>

            {/* Always rendered: `aria-controls` must point at an element in the document. */}
            <span hidden={!open} id={detailId} className="uib-corpus-detail">
              {detail}
            </span>
          </>
        )}
      </div>
    </Paragraph>
  );
};

export interface CorpusChoiceProps {
  /** Every collection the service can search, in order; drawn only with more than one. */
  options: readonly CorpusOption[];
  /** The key of the collection searched now. */
  value: string | undefined;
  /** The reader chose another; a new thread for it is the host's to start. */
  onChange: (key: string) => void;
  /** A filter is in force, which the host empties on a switch; the announcement says so. */
  resetsFilter?: boolean | undefined;
  className?: string | undefined;
}

/** Which collection the assistant searches: a `Select`, heard through the filter's region. */
export const CorpusChoice = ({
  options,
  value,
  onChange,
  resetsFilter = false,
  className,
}: CorpusChoiceProps) => {
  const t = useT();
  const filterAnnouncer = useFilterAnnouncer();
  const [own, setOwn] = useState('');
  if (options.length < 2) return null;

  const choose = (key: string) => {
    if (key === value) return;
    const name = options.find((option) => option.key === key)?.label ?? key;
    const text = resetsFilter
      ? t('corpus.switchedReset', { name })
      : t('corpus.switched', { name });
    if (filterAnnouncer) filterAnnouncer(text);
    else setOwn((previous) => freshText(previous, text));
    onChange(key);
  };

  // The live region beside the field: an `<output>` inside counts as a second input.
  return (
    <>
      <Field className={['uib-corpus-choice', className].filter(Boolean).join(' ')}>
        <Label>{t('corpus.label')}</Label>
        <Select value={value ?? ''} onChange={(event) => choose(event.currentTarget.value)}>
          {options.map((option) => (
            <Select.Option key={option.key} value={option.key}>
              {option.label}
            </Select.Option>
          ))}
        </Select>
      </Field>
      {filterAnnouncer ? null : <output className="ds-sr-only">{own}</output>}
    </>
  );
};
