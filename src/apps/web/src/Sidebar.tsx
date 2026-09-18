import { useState } from 'preact/hooks';
import type { ConversationSummary } from '@ka/contract';
import { BookIcon, InfoIcon, PanelIcon, PencilIcon, WrenchIcon } from './icons.tsx';

interface Props {
  conversations: ConversationSummary[];
  activeId: string | null;
  open: boolean;
  onToggle: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function Sidebar({
  conversations,
  activeId,
  open,
  onToggle,
  onOpen,
  onNew,
  onRename,
  onDelete,
}: Props) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? conversations.filter((c) => c.topic.toLowerCase().includes(needle))
    : conversations;

  const commit = (id: string) => {
    const title = draft.trim();
    if (title) onRename(id, title);
    setEditing(null);
  };

  if (!open) {
    return (
      <div class="panel-collapsed">
        <button
          type="button"
          class="ds-button"
          data-variant="secondary"
          data-color="neutral"
          onClick={onToggle}
        >
          <PanelIcon />
          Vis tråder
        </button>
      </div>
    );
  }

  return (
    <nav class="threads" aria-label="Tråder">
      <button
        type="button"
        class="ds-button"
        data-variant="secondary"
        data-color="neutral"
        onClick={onToggle}
      >
        <PanelIcon />
        Skjul tråder
      </button>

      <button type="button" class="ds-button" data-variant="primary" onClick={onNew}>
        Ny tråd
        <PencilIcon />
      </button>

      <input
        class="ds-input thread-search"
        data-size="sm"
        type="search"
        aria-label="Søk i tråder"
        placeholder="Søk i tråder"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />

      <div class="thread-scope">
        <p class="ds-paragraph">Viser dine tråder</p>
        <span
          class="ds-link scope-toggle"
          aria-disabled="true"
          title="Krever at backenden kan liste tråder du ikke eier"
        >
          Vis andres tråder
        </span>
      </div>

      <div class="thread-section">
        <h2 class="ds-heading" data-size="2xs">
          Tidligere tråder
        </h2>

        <ul class="thread-list">
          {shown.map((c) => (
            <li key={c.id}>
              {editing === c.id ? (
                <input
                  class="ds-input"
                  data-size="sm"
                  aria-label="Nytt navn"
                  value={draft}
                  autofocus
                  onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
                  onBlur={() => commit(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commit(c.id);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <div class={`thread-row${c.id === activeId ? ' is-active' : ''}`}>
                  <button
                    type="button"
                    class="thread-open"
                    aria-current={c.id === activeId ? 'true' : undefined}
                    title={c.topic}
                    onClick={() => onOpen(c.id)}
                  >
                    {c.topic}
                  </button>
                  <span class="thread-actions">
                    <button
                      type="button"
                      aria-label={`Gi nytt navn til ${c.topic}`}
                      onClick={() => {
                        setEditing(c.id);
                        setDraft(c.topic);
                      }}
                    >
                      Endre
                    </button>
                    <button
                      type="button"
                      aria-label={`Slett ${c.topic}`}
                      onClick={() => onDelete(c.id)}
                    >
                      Slett
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
          {shown.length === 0 && (
            <li class="thread-empty">{needle ? 'Ingen treff.' : 'Ingen tråder ennå.'}</li>
          )}
        </ul>
      </div>

      <footer class="thread-footer">
        <a class="ds-link" href="/onboarding">
          <BookIcon />
          Onboarding
        </a>
        <a class="ds-link" href="/endringslogg">
          <WrenchIcon />
          Endringslogg
        </a>
        <a class="ds-link" href="/om-prosjektet">
          <InfoIcon />
          Om prosjektet
        </a>
      </footer>
    </nav>
  );
}
