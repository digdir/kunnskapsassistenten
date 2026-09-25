import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

export interface FacetOption {
  value: string;
  count: number;
}
export interface FacetField {
  field: string;
  label: string;
  options: FacetOption[];
}
export type Selection = Record<string, string[]>;

function Combobox({
  facet,
  selected,
  disabled,
  reason,
  onChange,
}: {
  facet: FacetField;
  selected: string[];
  disabled: boolean;
  reason?: string;
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? facet.options.filter((o) => o.value.toLowerCase().includes(needle))
      : facet.options;
    return list.slice(0, 200);
  }, [facet.options, query]);

  const toggle = (value: string) =>
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );

  const labelId = `facet-${facet.field}`;
  const countOf = (value: string) => facet.options.find((o) => o.value === value)?.count;

  return (
    <div
      class={`ds-combobox ds-combobox--md facet${disabled ? ' ds-combobox__disabled' : ''}`}
      ref={root}
      title={reason}
    >
      <label class="ds-label ds-combobox__label" for={labelId}>
        {selected.length ? 'Valgt' : 'Velg'} {facet.label}
      </label>

      <div
        class="ds-textfield__input ds-combobox__input__wrapper"
        data-variant="default"
        data-size="md"
        onClick={() => !disabled && setOpen(true)}
      >
        <div class="ds-combobox__chip-and-input">
          {selected.map((v) => (
            <button
              key={v}
              type="button"
              class="ds-chip"
              data-removable="true"
              data-size="sm"
              aria-label={`Slett ${v}`}
              title={countOf(v) === undefined ? v : `${v} (${countOf(v)})`}
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                toggle(v);
              }}
            >
              {countOf(v) === undefined ? v : `${v} (${countOf(v)})`}
            </button>
          ))}
          <input
            id={labelId}
            class="ds-combobox__input"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            disabled={disabled}
            value={query}
            onInput={(e) => {
              setQuery((e.target as HTMLInputElement).value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'Backspace' && !query && selected.length) {
                onChange(selected.slice(0, -1));
              }
            }}
          />
        </div>

        <div class="ds-combobox__controls">
          <div class="ds-combobox__arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                d={open ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              />
            </svg>
          </div>
          {selected.length > 0 && !disabled && (
            <button
              type="button"
              class="ds-combobox__clear-button"
              aria-label="Fjern alt"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
                setQuery('');
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="m6 6 12 12M18 6 6 18"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {open && !disabled && (
        <ul class="facet-options" role="listbox" aria-multiselectable="true">
          {shown.map((o) => (
            <li key={o.value}>
              <label class="facet-option">
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={() => {
                    toggle(o.value);
                    setQuery('');
                  }}
                />
                <span class="facet-value">{o.value}</span>
                <span class="facet-count">({o.count})</span>
              </label>
            </li>
          ))}
          {shown.length === 0 && <li class="facet-empty">Ingen treff.</li>}
        </ul>
      )}
    </div>
  );
}

const UNSUPPORTED =
  'Backenden tar ikke imot filtre ennå, så valgene ville ikke påvirket svaret. ' +
  'Raden vises fordi den slår seg på av seg selv når backenden støtter det.';

export function Filters({
  selection,
  locked,
  onChange,
}: {
  selection: Selection;
  locked: boolean;
  onChange: (s: Selection) => void;
}) {
  const [facets, setFacets] = useState<FacetField[]>([]);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = (attempt: number) =>
      fetch('/api/facets')
        .then((r) => (r.ok ? r.json() : { facets: [] }))
        .then((b: { facets: FacetField[] }) => {
          if (cancelled) return;
          if (b.facets.length > 0) setFacets(b.facets);
          else if (attempt < 3) setTimeout(() => void load(attempt + 1), 2000 * (attempt + 1));
        })
        .catch(() => {
          if (!cancelled && attempt < 3)
            setTimeout(() => void load(attempt + 1), 2000 * (attempt + 1));
        });
    void load(0);
    void fetch('/api/capabilities')
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { capabilities?: { filters?: boolean } } | null) => {
        if (b?.capabilities) setSupported(Boolean(b.capabilities.filters));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (facets.length === 0) return null;

  const disabled = locked || !supported;
  const reason = !supported ? UNSUPPORTED : locked ? 'Filteret er låst til tråden.' : undefined;

  return (
    <section class="filters" aria-labelledby="filter-heading">
      <p id="filter-heading" class="ds-paragraph filter-title" data-size="sm">
        Filtrering
      </p>
      {!supported && (
        <p class="ds-paragraph filter-hint" data-size="sm" role="status">
          Slått av: backenden tar ikke imot filtre ennå.
        </p>
      )}
      <div class="filter-grid">
        {facets.map((f) => (
          <Combobox
            key={f.field}
            facet={f}
            selected={selection[f.field] ?? []}
            disabled={disabled}
            reason={reason}
            onChange={(values) => onChange({ ...selection, [f.field]: values })}
          />
        ))}
      </div>
    </section>
  );
}
