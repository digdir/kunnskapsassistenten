import { useEffect, useRef, useState } from 'preact/hooks';
import type { AgentOption, Stage } from '@ka/contract';
import { Filters, type Selection } from './Filters.tsx';
import { CopyIcon } from './icons.tsx';
import { Sidebar } from './Sidebar.tsx';
import { SourcesPanel } from './SourcesPanel.tsx';
import { useConversations } from './useConversations.ts';
import { useTurn } from './useTurn.ts';
import { renderMarkdown } from './markdown.ts';

const STAGE_LABEL: Record<Stage, string> = {
  starting: 'Tenker',
  searching: 'Ser etter dokumenter',
  reading: 'Leser kilder',
  writing: 'Skriver svar',
  done: 'Ferdig',
};

function Answer({ text }: { text: string }) {
  return <div class="answer" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />;
}

function AnswerBlock({
  text,
  queries,
  threadUrl,
}: {
  text: string;
  queries?: string[];
  threadUrl: string;
}) {
  return (
    <article class="msg-assistant">
      <div class="answer-card">
        <Answer text={text} />
        {queries?.length ? (
          <p class="keywords ds-paragraph" data-size="sm">
            Nøkkelord: {queries.join(', ')}
          </p>
        ) : null}
        <div class="msg-actions">
          <CopyButton text={text} label="Kopier svaret" />
          <CopyButton text={threadUrl} label="Kopier link til tråden" />
        </div>
      </div>
      <p class="ds-paragraph feedback" data-size="sm">
        Fant du det du lette etter?{' '}
        <a class="ds-link" href="/tilbakemelding">
          Gi tilbakemelding her
        </a>
      </p>
    </article>
  );
}

function Home() {
  return (
    <div class="home">
      <h2 class="ds-heading home-title" data-size="xs">
        Presis og pålitelig innsikt, skreddersydd for deg.
      </h2>
      <p class="ds-paragraph home-lead">Utforsk Kudos-dokumenter fra 2020&ndash;2025</p>
      <ul class="home-list">
        <li>tildelingsbrev, årsrapporter</li>
        <li>evalueringer, statusrapporter</li>
        <li>proposisjoner til Stortinget</li>
        <li>strategier og planer</li>
      </ul>
      <p class="ds-paragraph">Kjapt og enkelt.</p>
    </div>
  );
}

function LoadingState({
  stage,
  iteration,
  maxIterations,
}: {
  stage: Stage;
  iteration: number;
  maxIterations: number;
}) {
  return (
    <div class="loading">
      <div class="loading-banner" role="status" aria-live="polite">
        <span class="ds-spinner" data-size="md" aria-hidden="true" />
        <span>{STAGE_LABEL[stage]}</span>
        <span class="loading-step">
          steg {iteration + 1} av {maxIterations}
        </span>
      </div>
      <div class="skeletons" aria-hidden="true">
        <div class="ds-skeleton skel-line" />
        <div class="ds-skeleton skel-line" />
        <div class="ds-skeleton skel-line short" />
        <div class="ds-skeleton skel-block" />
        <div class="ds-skeleton skel-line" />
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      <CopyIcon />
      {copied ? 'Kopiert' : label}
    </button>
  );
}

export function App() {
  const [input, setInput] = useState('');
  const [threadsOpen, setThreadsOpen] = useState(true);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentId, setAgentId] = useState<string>('');
  const [showMode, setShowMode] = useState(false);
  const [model, setModel] = useState<string>('');
  const [filters, setFilters] = useState<Selection>({});
  const [composing, setComposing] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const convos = useConversations();
  const { turn, ask, stop, reset } = useTurn({
    onConversationCreated: (c) =>
      convos.noteCreated({ id: c.id, topic: c.topic, created: Date.now() }),
  });
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch('/api/models')
      .then((r) => (r.ok ? r.json() : { agents: [] }))
      .then((b: { agents: AgentOption[] }) => {
        setAgents(b.agents);
        const first = b.agents[0];
        if (first) {
          setAgentId(first.id);
          setModel((first.modes.find((m) => m.isDefault) ?? first.modes[0])?.id ?? '');
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [convos.messages.length, turn?.answer, turn?.stage]);

  const settled = useRef<number | null>(null);
  useEffect(() => {
    if (turn && !turn.running && !turn.error && turn.answer && settled.current !== turn.id) {
      settled.current = turn.id;
      convos.appendTurn(turn.question, turn.answer);
      if (convos.activeId) convos.rememberSources(convos.activeId, turn.sources);
    }
  }, [turn, convos]);

  const submit = () => {
    const q = input.trim();
    if (!q || turn?.running) return;
    void ask(q, convos.activeId ?? undefined, model || undefined, filters);
    setInput('');
  };

  const showLive = turn && (turn.running || turn.error || settled.current !== turn.id);
  const empty = convos.messages.length === 0 && !turn;
  const inThread = !empty || composing;
  const threadUrl = convos.activeId
    ? `${location.origin}/chat/${convos.activeId}`
    : location.href;

  return (
    <div class="shell">
      <Sidebar
        conversations={convos.list}
        activeId={convos.activeId}
        open={threadsOpen}
        onToggle={() => setThreadsOpen((v) => !v)}
        onOpen={(id) => {
          settled.current = null;
          reset();
          setComposing(false);
          setFilters({});
          void convos.open(id).then(setFilters);
        }}
        onNew={() => {
          settled.current = null;
          reset();
          setFilters({});
          setComposing(true);
          convos.startNew();
        }}
        onRename={convos.rename}
        onDelete={convos.remove}
      />

      <main class="main">
        <div class="column">
          {inThread && (
            <Filters
              selection={filters}
              locked={convos.messages.length > 0}
              onChange={setFilters}
            />
          )}

          <div class="thread" role="log" aria-label="Samtale">
            {!inThread && <Home />}
            {convos.loading && <span class="ds-spinner" aria-label="Laster samtale" />}

            {convos.messages.map((m) =>
              m.role === 'assistant' ? (
                <AnswerBlock key={m.id} text={m.text} threadUrl={threadUrl} />
              ) : (
                <p key={m.id} class="question">
                  {m.text}
                </p>
              ),
            )}

            {showLive && turn && (
              <>
                <p class="question">{turn.question}</p>
                <div class="msg-assistant">
                  {turn.running && !turn.answer && turn.stage && (
                    <LoadingState
                      stage={turn.stage}
                      iteration={turn.iteration}
                      maxIterations={turn.maxIterations}
                    />
                  )}
                  {turn.answer && turn.running && (
                    <div class="answer-card">
                      <Answer text={turn.answer} />
                    </div>
                  )}
                  {turn.error && (
                    <div class="ds-alert" data-color="danger">
                      {turn.error}
                    </div>
                  )}
                  {turn.answer && !turn.running && !turn.error && (
                    <>
                      {turn.sources.length === 0 && (
                        <div class="ds-alert" data-color="warning">
                          Svaret har ingen kilder fra dokumentgrunnlaget. Kontroller det mot
                          originaldokumentene før du bruker det.
                        </div>
                      )}
                      <AnswerBlock
                        text={turn.answer}
                        queries={turn.queries}
                        threadUrl={threadUrl}
                      />
                    </>
                  )}
                </div>
              </>
            )}
            <div ref={bottom} />
          </div>

          {inThread && (
            <div class="composer">
              {agents.length > 0 && (
                <div class="model-row">
                  <label class="ds-label" data-size="sm" for="agent">
                    Agent:
                  </label>
                  <select
                    id="agent"
                    class="ds-input"
                    data-size="sm"
                    value={agentId}
                    onChange={(e) => {
                      const next = agents.find(
                        (a) => a.id === (e.target as HTMLSelectElement).value,
                      );
                      if (!next) return;
                      setAgentId(next.id);
                      setModel(
                        (next.modes.find((m) => m.isDefault) ?? next.modes[0])?.id ?? '',
                      );
                    }}
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  {(agents.find((a) => a.id === agentId)?.modes.length ?? 0) > 1 &&
                    (showMode ? (
                      <select
                        id="mode"
                        class="ds-input"
                        data-size="sm"
                        value={model}
                        onChange={(e) => setModel((e.target as HTMLSelectElement).value)}
                      >
                        {agents
                          .find((a) => a.id === agentId)
                          ?.modes.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        class="ds-button mode-toggle"
                        data-variant="tertiary"
                        data-size="sm"
                        onClick={() => setShowMode(true)}
                      >
                        Avansert
                      </button>
                    ))}
                  {agents.find((a) => a.id === agentId)?.description && (
                    <p class="ds-paragraph agent-description" data-size="sm">
                      {agents.find((a) => a.id === agentId)?.description}
                    </p>
                  )}
                </div>
              )}

              <div class="ds-field composer-field">
                <label class="ds-label sr-only" for="prompt">
                  Hva kan jeg hjelpe deg med?
                </label>
                <textarea
                  id="prompt"
                  class="ds-input"
                  rows={3}
                  placeholder="Hva kan jeg hjelpe deg med?"
                  value={input}
                  disabled={turn?.running}
                  onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                />
                {turn?.running ? (
                  <button type="button" class="send-button" aria-label="Stopp" onClick={stop}>
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    class="send-button"
                    aria-label="Send"
                    disabled={!input.trim()}
                    onClick={submit}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path d="M3 20.5 21 12 3 3.5l4 8.5-4 8.5Z" fill="currentColor" />
                    </svg>
                  </button>
                )}
              </div>

              <p class="ds-paragraph disclaimer" data-size="sm">
                Kunnskapsassistenten kan gjøre feil. Husk å sjekke viktig informasjon.
              </p>
            </div>
          )}
        </div>
      </main>

      <SourcesPanel
        sources={
          turn?.sources?.length
            ? turn.sources
            : ((convos.activeId ? convos.sourcesByThread[convos.activeId] : undefined) ?? [])
        }
        open={sourcesOpen}
        onToggle={() => setSourcesOpen((v) => !v)}
      />
    </div>
  );
}
