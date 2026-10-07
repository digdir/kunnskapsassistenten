import { useMemo, useState } from 'preact/hooks';
import type { Source } from '@ka/contract';
import { PanelIcon, SearchIcon } from './icons.tsx';

interface Props {
  sources: Source[];
  open: boolean;
  onToggle: () => void;
}

export function SourcesPanel({ sources, open, onToggle }: Props) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sources;
    return sources.filter(
      (s) =>
        s.title.toLowerCase().includes(needle) ||
        s.docNum.includes(needle) ||
        (s.excerpt ?? '').toLowerCase().includes(needle),
    );
  }, [sources, query]);

  if (!open) {
    return (
      <div class="panel-collapsed">
        <button type="button" class="ds-button" data-variant="secondary" onClick={onToggle}>
          <PanelIcon />
          Vis kilder{sources.length ? ` (${sources.length})` : ''}
        </button>
      </div>
    );
  }

  return (
    <aside class="sources" aria-label="Kilder">
      <div class="sources-head">
        <button type="button" class="ds-button" data-variant="secondary" onClick={onToggle}>
          <PanelIcon />
          Skjul kilder
        </button>

        <div class="ds-field">
          <label class="ds-label" for="source-search">
            Søk i kildene
          </label>
          <p class="ds-paragraph ds-field__description" data-size="sm">
            All tekst er sitater fra dokumentene fra Kudos. Ikke generert av kunstig
            intelligens.
          </p>
          <div class="search-field">
            <SearchIcon />
            <input
              id="source-search"
              class="ds-input"
              type="search"
              placeholder="Søk"
              value={query}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            />
          </div>
        </div>
      </div>

      <div class="sources-body">
        {sources.length === 0 ? (
          <p class="ds-paragraph" data-size="sm">
            Ingen kilder ennå. Still et spørsmål, så dukker dokumentene opp her.
          </p>
        ) : (
          <>
            <h2 class="ds-heading" data-size="xs">
              Snarveier til dokumentene
            </h2>
            <ol class="shortcut-list">
              {shown.map((s) => (
                <li key={`sc-${s.docNum}`} class="shortcut">
                  <span class="source-marker" aria-hidden="true">
                    {s.marker}
                  </span>
                  <a class="ds-link" href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>

            <ol class="source-list">
              {shown.map((s) => (
                <li key={s.docNum || s.url} class="source-card">
                  <p class="source-card-title">{s.title}</p>
                  <div class="source-card-body">
                    <button
                      type="button"
                      class="source-open"
                      aria-expanded={expanded === s.docNum}
                      onClick={() => setExpanded(expanded === s.docNum ? null : s.docNum)}
                    >
                      {expanded === s.docNum ? 'Lukk' : 'Åpne'}
                    </button>
                    <p class="source-card-heading">{s.title}</p>
                    {s.excerpt ? (
                      <div class={`source-excerpt${expanded === s.docNum ? ' is-open' : ''}`}>
                        {s.excerpt}
                      </div>
                    ) : (
                      <p class="ds-paragraph source-missing" data-size="sm">
                        Utdraget er ikke tilgjengelig for dette dokumentet.
                      </p>
                    )}
                  </div>
                  <p class="ds-paragraph source-docnum" data-size="xs">
                    doc_num: {s.docNum || '—'}
                  </p>
                </li>
              ))}
            </ol>
            {shown.length === 0 && (
              <p class="ds-paragraph" data-size="sm">
                Ingen treff.
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
