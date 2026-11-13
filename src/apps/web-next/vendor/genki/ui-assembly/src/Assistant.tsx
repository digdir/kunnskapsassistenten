// Draws an assistant from a layout: each catalogue block's members in its zone of the shell,
// linked through the channels `useAssistant` keeps. The arrangement inside each zone follows
// kunnskapsassistenten, as the UI blocks preview draws it; what the preview never drew follows
// the design's board 3: Filter in the main column as a strip with «Endre», Chat or Fremgangsmåte
// in the secondary panel, Dokumentvisning in either, and the secondary panel's tool rule.
import {
  Button,
  Details,
  Heading,
  Paragraph,
  SkipLink,
  Tooltip,
} from '@digdir/designsystemet-react';
import {
  AnswerActions,
  Approach,
  Composer,
  ComposerDisclaimer,
  Conversation,
  CorpusChoice,
  CorpusLine,
  Documents,
  DocumentsInScope,
  DocumentView,
  EmptyState,
  ErrorState,
  Filter,
  FilterRead,
  NotFoundState,
  Settings,
  SettingsAboutYou,
  SettingsBeta,
  SettingsGeneral,
  SettingsLinks,
  SettingsMenu,
  SettingsPrivacy,
  Shell,
  ShellProfile,
  ShellTools,
  SignedIn,
  Sources,
  Suggestions,
  Threads,
  VariantPicker,
  Welcome,
  answerCopy,
  experimentsOn,
  fieldValueLabels,
  isEmptySelection,
  isSettingsPageId,
  narrowing,
  sameSelection,
  settingsPageIds,
  type AnswerCopied,
  type AnswerFeedbackStatus,
  type ConversationAnswer,
  type SettingsPageId,
  type ShellPanel,
  type ShellProfileProps,
  type ShellTool,
  type SourceDocument,
  type SourceTarget,
} from '@genai/ui-blocks';
import {
  ArrowLeftIcon,
  ChatIcon,
  FileSearchIcon,
  FileTextIcon,
  PlusIcon,
  RobotIcon,
} from '@navikt/aksel-icons';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { phrase, useT, type AssemblyTranslator } from './i18n.js';
import { stepsOf } from './procedure.js';
import { useAssistant, type AssistantOptions, type AssistantState } from './useAssistant.js';

// The cards frame's ground, the shell's, under the docked field: it fades into the card, not the
// page (the next look).
const cardGround = {
  '--genai-composer-sticky-background':
    'var(--genai-shell-card-background, var(--ds-color-neutral-surface-default))',
} as CSSProperties;

// The next look's «Kilder» heads are brand3's light blue, the board's (dev-kilder-hoyre), with the
// titles in the text's own grey, not in brand3's blue.
const sourcesTool = {
  '--genai-sources-head-color': 'var(--ds-color-neutral-text-default)',
  // As wide as the panel, also as the panel's only tool, where nothing stretches it.
  inlineSize: '100%',
} as CSSProperties;

// `compact-filter`: a field's ticks in one column, so the filter fits its narrow panel.
const oneColumnTicks = { '--genai-filter-checkboxes-columns': '1' } as CSSProperties;

// The next look's footnote marks, 16 px as dev-kilder-hoyre draws them.
const nextFootnotes = { '--genai-answer-footnote-size': 'var(--ds-size-4)' } as CSSProperties;

// The tools' icons in the next look, as the dev-verktoy boards draw them: Fremgangsmåte's robot,
// Kilder's page with a magnifier. Notater's pencil waits for the block.
const toolIcons: Record<string, ReactNode> = {
  approach: <RobotIcon aria-hidden />,
  chat: <ChatIcon aria-hidden />,
  sources: <FileSearchIcon aria-hidden />,
  'document-view': <FileTextIcon aria-hidden />,
};

// A plain main-button click is the host's; any other, for a new tab, is the browser's.
const plainClick = (event: MouseEvent<HTMLAnchorElement>) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

// The modifier to name; the shortcut takes both (kunnskapsassistenten's shortcutModifier.ts).
const modifier = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/u.test(navigator.userAgent) ? 'Cmd' : 'Ctrl';

export interface AssistantProps extends AssistantOptions {
  /** The `id` of `<main>`, the target of «Hopp til hovedinnhold». */
  mainId?: string | undefined;
}

/** The assistant a layout describes, live against the service through `api`. */
export const Assistant = ({ mainId, ...options }: AssistantProps) => (
  <AssistantView assistant={useAssistant(options)} mainId={mainId} />
);

const AnswerRow = ({
  a,
  turn,
  end,
  search,
}: {
  a: AssistantState;
  turn: ConversationAnswer;
  end: ReactNode;
  search: ReactNode;
}) => {
  const t = useT();
  const [copied, setCopied] = useState<AnswerCopied>();
  const [status, setStatus] = useState<AnswerFeedbackStatus>();
  const copy = async (text: string, done: AnswerCopied) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(done);
    } catch {
      setCopied({ kind: 'failed' });
    }
  };
  const copying = a.option('chat', 'copy');
  const feedback = a.option('chat', 'feedback') && !!a.onFeedback;
  return (
    <AnswerActions
      {...(copying
        ? {
            // What the screen says: the footnotes numbered as drawn, and a line per reference.
            onCopyAnswer: () => {
              const { text, sources } = answerCopy(turn.text, {
                sources: turn.sources,
                markers: turn.markers,
                locale: t.locale,
                documentFootnotes: a.look === 'next',
              });
              void copy(text, { kind: 'answer', sources });
            },
            // A link that opens the thread: only where the thread is in the address.
            ...(a.urlThreads && a.currentId
              ? {
                  onCopyLink: () =>
                    void copy(new URL(a.hrefOf(a.currentId), location.href).href, {
                      kind: 'link',
                    }),
                  // The next look keeps the answer's time but no note that the link works only here.
                  linkOnlyHere: a.look !== 'next',
                }
              : {}),
          }
        : {})}
      copied={copied}
      feedback={feedback}
      onFeedback={(given) => {
        setStatus('sending');
        const runId = a.turns.find((one) => one.id === turn.id)?.answer?.runId;
        void Promise.resolve(
          a.onFeedback?.({
            answerId: turn.id,
            ...(runId ? { runId } : {}),
            rating: given.rating,
            reasons: given.reasons,
            comment: given.comment,
          }),
        ).then(
          () => setStatus('sent'),
          () => setStatus('failed'),
        );
      }}
      feedbackStatus={status}
      actions={search}
      end={end}
    />
  );
};

/**
 * «Fremgangsmåte» for one turn asked here, at the reader's level. Stored turns carry no steps.
 * `card` stands over the answer, `compact` beside the tool, and `tool` has every detail.
 */
const approachOf = (
  a: AssistantState,
  turnId: string | undefined,
  t: AssemblyTranslator,
  place: 'card' | 'compact' | 'tool' = 'card',
) => {
  const turn = a.turns.find((one) => one.id === turnId);
  const approach = turn?.approach;
  if (!turn || !approach) return null;
  const busy = turn.answer?.status === 'streaming';
  const tool = place === 'tool';
  const steps = stepsOf(approach, busy, t.locale, tool);
  if (steps.length === 0) return null;
  // The next look's card and every tool say the filter (dev-filter-panel; «9 · Filtrering» B):
  // the totals and «filteret er endret» when folded, what the answer read from when open. Only for
  // a question asked here, since genki keeps no filter with a turn.
  const next = a.look === 'next';
  const asked = next || tool ? turn.scope?.selection : undefined;
  const before = a.turns
    .slice(0, a.turns.indexOf(turn))
    .reverse()
    .find((one) => one.answer && one.scope?.selection);
  const changed =
    asked && before?.scope?.selection ? !sameSelection(before.scope.selection, asked) : false;
  const count = turn.scope?.documents;
  // Beside the tool, the card says only how many documents the answer read from.
  const scope =
    asked && place !== 'compact' ? (
      <FilterRead selection={asked} fields={a.facets} count={count} />
    ) : asked && count !== undefined ? (
      <FilterRead selection={{}} count={count} />
    ) : undefined;
  return (
    <>
      <Approach
        steps={steps}
        working={busy}
        startedAt={approach.startedAt}
        {...(approach.finishedAt ? { finishedAt: approach.finishedAt } : {})}
        {...(turn.answer?.sources ? { used: turn.answer.sources.length } : {})}
        // The next look's tool is the dev-verktoy boards' list; its card is their bar.
        {...(next ? (tool ? { variant: 'list' as const } : { summary: 'totals' as const }) : {})}
        {...(changed ? { note: t('filter.changed') } : {})}
        {...(scope ? { scope } : {})}
      />
      {a.level === 'detailed' && place !== 'compact' ? (
        // No block draws the detailed level yet: the step frames as genki sent them, for now.
        <Details data-size="sm">
          <Details.Summary>{t('assembly.technicalDetails')}</Details.Summary>
          <Details.Content>
            <ol className="uia-frames">
              {approach.frames.map((frame, i) => (
                <li key={i}>
                  <code>
                    {[
                      frame.event,
                      frame.stage,
                      frame.tool,
                      frame.iteration !== undefined ? `#${frame.iteration}` : '',
                      frame.label,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </code>
                </li>
              ))}
            </ol>
          </Details.Content>
        </Details>
      ) : null}
    </>
  );
};

export const AssistantView = ({
  assistant: a,
  mainId = 'main-content',
}: {
  assistant: AssistantState;
  mainId?: string | undefined;
}) => {
  const t = useT();
  const approachHeadingId = useId();
  const chatZone = a.where('chat');
  // Fremgangsmåte as the card in the main column, the tool in the secondary panel, or both.
  const approachCard = a.standsIn('approach', 'main');
  const approachTool = a.standsIn('approach', 'secondary');
  const cardPlace = approachTool ? 'compact' : 'card';
  const filterZone = a.where('filter');
  const threadsOn = a.has('threads');
  const sourcesOn = a.has('sources');
  const documentOn = a.has('document-view');
  const settingsOn = a.has('settings');
  const name = a.assistantName;
  // The dev boards' look, the layout's `next`: cards, every panel titled, the thread's title as
  // the `h1`, and the reader at the primary panel's foot with the profile menu.
  const next = a.look === 'next';
  // The document stands where the conversation was, with Dokumentvisning beside Chat in «Innhold».
  const chatHidden = a.documentOverChat && !!a.openDoc;

  /** A footnote, or a document under the answer: Kilder when it is there, else Dokumentvisning. */
  const follow = (
    turn: ConversationAnswer,
    target: SourceTarget,
    followed: NonNullable<AssistantState['lastFollowed']['current']>,
  ) => {
    a.lastFollowed.current = followed;
    if (sourcesOn) a.showSources(turn.id, target);
    else if (documentOn) a.openDocument(turn.id, target, 'answer');
  };

  // The primary panel holds Tråder and Filter as two views, as kunnskapsassistenten does, and a
  // first visit lands on the filter. The next look lands on «Tråder», as its boards draw it.
  const [primaryView, setPrimaryView] = useState<'threads' | 'filters'>(
    next ? 'threads' : 'filters',
  );
  const [switchedView, setSwitchedView] = useState(false);
  const [filterPin, setFilterPin] = useState<HTMLDivElement | null>(null);
  // The secondary panel's pinned region, where its tools' switcher stays while a tool scrolls. The
  // shell pads the panel's region as tall as it from the moment the panel opens, and hands its
  // tools that height as `--uib-shell-pinned-block-size`.
  const [toolsPin, setToolsPin] = useState<HTMLDivElement | null>(null);
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (switchedView && primaryView === 'filters') back.current?.focus();
  }, [switchedView, primaryView]);
  // The strip in the main column opens the filter under it with «Endre».
  const [stripOpen, setStripOpen] = useState(false);
  // The next look's «Innstillinger»: the page of it on screen, Generelt from the profile menu.
  const [settingsView, setSettingsView] = useState<SettingsPageId>('general');

  // kunnskapsassistenten's trials, where the profile offers them and the reader turned them on.
  const filtersBeside = a.flags.has('filters-right-panel') && filterZone === 'primary';
  // The next look draws the filter as its own panel beside the threads, in their card
  // (dev-filter-panel; «9 · Filtrering» A), not as a second view of the same panel.
  const filterPanel = next && threadsOn && filterZone === 'primary' && !filtersBeside;
  // `compact-filter`: that panel 230 wide at every width of the card, and the threads the rest.
  const compactFilter = filterPanel && a.flags.has('compact-filter');
  const twoViews = threadsOn && filterZone === 'primary' && !filtersBeside && !filterPanel;

  const [atEnd, setAtEnd] = useState(true);
  const start = a.view === 'new' || (a.view === 'ready' && a.turns.length === 0);
  const lastAnswer = a.turns.at(-1)?.answer;

  // The skip link goes to the field's id, so it has a target (axe `region`). Read again only when
  // the field may be another: on the other page, in another zone, or back from a missing thread.
  const [fieldId, setFieldId] = useState<string>();
  const fieldShown = a.page === 'chat' && chatZone !== undefined && a.view !== 'notfound';
  useEffect(() => {
    const field = a.fieldRef.current;
    if (field && !field.id) field.id = 'composer-field';
    setFieldId(field?.id || undefined);
  }, [a.fieldRef, fieldShown, chatZone]);
  // When the answer is done, «Avbryt genereringen» turns back into a disabled send button; focus
  // that was on it goes to the field, not to the page. Focus the reader moved elsewhere stays.
  const wasWorking = useRef(false);
  useEffect(() => {
    const ended = wasWorking.current && !a.working;
    wasWorking.current = a.working;
    if (!ended) return;
    const lost = () => {
      const active = document.activeElement;
      return active === null || active === document.body || !active.isConnected;
    };
    if (lost()) a.fieldRef.current?.focus();
    requestAnimationFrame(() => {
      if (lost()) a.fieldRef.current?.focus();
    });
  }, [a.working, a.fieldRef]);

  // The page's one `h1`, the assistant's name, before everything else on it (WCAG 1.3.1, 2.4.6).
  // Chat alone in the main column draws it, as kunnskapsassistenten does; otherwise the column.
  // In the next look the `h1` is the thread's title, at the top of the main card (`mainTitle`).
  const pageHeading = next ? null : <h1 className="ds-sr-only">{name}</h1>;

  // ── Chat ──
  const chat = (inPanel: boolean, titled: boolean) => {
    let middle;
    if (a.view === 'notfound') {
      middle = (
        <NotFoundState
          homeHref={a.hrefOf()}
          onGoHome={() => a.leave(undefined)}
          title={t('assembly.threadNotFoundTitle')}
          description={t('assembly.threadNotFound')}
        />
      );
    } else if (a.view === 'error') {
      middle = (
        <ErrorState
          title={t('assembly.threadFailed')}
          message={
            a.viewError?.status === undefined
              ? t('assembly.unreached')
              : t('assembly.answeredWithStatus', { status: a.viewError.status })
          }
          onRetry={a.retryThread}
        />
      );
    } else if (start) {
      middle = (
        <div className="uia-greeting">
          <Welcome className="uia-welcome" />
          {a.view === 'ready' ? (
            <EmptyState
              title={t('assembly.emptyThreadTitle')}
              description={t('assembly.emptyThread')}
            />
          ) : null}
        </div>
      );
    } else {
      middle = (
        <Conversation
          turns={a.conversation}
          loading={a.view === 'loading'}
          assistantName={name}
          answerColor="neutral"
          // The next look's answer has no card and no name over it (dev-kilder-hoyre).
          {...(next ? { answerVariant: 'plain' as const, answerLabel: false } : {})}
          // The next look names the thread once, in the main card's `h1`.
          {...(a.named && !next ? { title: a.named, titleRepeatsQuestion: a.repeatsQuestion } : {})}
          target={a.answerTarget}
          header={(turn) =>
            turn.kind === 'answer' && approachCard && chatZone === 'main'
              ? approachOf(a, turn.id, t, cardPlace)
              : null
          }
          {...(a.footnotes
            ? {
                onOpenCitation: (
                  turn: ConversationAnswer,
                  citation: number,
                  target: SourceTarget,
                ) => follow(turn, target, { turnId: turn.id, citation }),
                onOpenDocument: (turn: ConversationAnswer, source: SourceDocument) => {
                  const target = { documentId: source.documentId, index: source.index };
                  follow(turn, target, { turnId: turn.id, document: target });
                },
                sourcesUsed: true,
                // Until genki cites excerpts, the next look marks each cited document.
                ...(next ? { documentFootnotes: true } : {}),
              }
            : {})}
          onRegenerate={(turn, question) => {
            const own = a.turns.find((t) => t.id === turn.id || `${t.id}-q` === question?.id);
            const asked = question?.text ?? own?.question;
            if (asked) a.send(asked, { replaces: own?.id ?? turn.id });
          }}
          closingQuestion
          onAtEndChange={setAtEnd}
          actions={(turn, parts) => (
            <AnswerRow a={a} turn={turn} end={parts.end} search={parts.search} />
          )}
        />
      );
    }
    const suggestions = a.option('chat', 'suggestions') ? (a.profile?.suggestions ?? []) : [];
    // The catalogue keeps follow-ups to the current look.
    const followUps = a.option('chat', 'followUps') ? a.profile?.followUps : undefined;
    const disclaimer = a.option('chat', 'disclaimer');
    // While a question is written, the next look hides the greeting and suggestions in place.
    const typing = next && start && a.draft !== '';
    return (
      <div
        className="uia-chat"
        data-start={start || undefined}
        data-typing={typing || undefined}
        data-in-panel={inPanel || undefined}
        // In the next look the docked field stands on the main card's ground, not the page's.
        style={next ? { ...nextFootnotes, ...(inPanel ? {} : cardGround) } : undefined}
      >
        {titled ? pageHeading : null}
        {middle}
        {a.serviceTrouble ? (
          // Without the service's facts the collection is unknown, so nothing can be asked.
          <ErrorState
            title={t('assembly.serviceFailedTitle')}
            // In the reader's language: the status genki answered with, never an error's own
            // words, which are the browser's or genki's («Failed to fetch»).
            message={
              a.modelsFailed
                ? a.modelsFailed.status === undefined
                  ? t('assembly.serviceFailed')
                  : t('assembly.serviceFailedStatus', { status: a.modelsFailed.status })
                : undefined
            }
            onRetry={a.retryModels}
            headingLevel={2}
          />
        ) : null}
        {a.view === 'notfound' ? null : (
          <Composer
            className="uia-composer"
            value={a.draft}
            onChange={a.setDraft}
            onSubmit={(question) => a.send(question, { fromField: true })}
            working={a.working}
            onCancel={a.cancel}
            assistantName={name}
            showDisclaimer={disclaimer && !start}
            followUps={
              !a.working && lastAnswer?.status === 'complete' && !lastAnswer.noAnswer
                ? followUps
                : undefined
            }
            {...(atEnd || start || inPanel
              ? {}
              : {
                  onScrollToBottom: () => {
                    const main = document.getElementById(mainId);
                    main?.scrollTo({ top: main.scrollHeight, behavior: 'smooth' });
                  },
                })}
            actions={
              a.option('chat', 'variantPicker') ? (
                <VariantPicker variants={a.variants} value={a.model} onChange={a.setModel} />
              ) : undefined
            }
            // Docked, the field keeps the rest of the column clear of itself (WCAG 2.4.11) with a
            // scroll margin as tall as it, as kunnskapsassistenten does.
            sticky={!start && !inPanel}
            fieldRef={a.fieldRef}
          />
        )}
        {start ? (
          <>
            {suggestions.length > 0 ? (
              <div className="uia-suggestions">
                <Suggestions
                  suggestions={suggestions}
                  onPick={(question) => {
                    a.setDraft(question);
                    a.fieldRef.current?.focus();
                  }}
                />
              </div>
            ) : null}
            {disclaimer ? (
              <ComposerDisclaimer assistantName={name} className="uia-disclaimer" />
            ) : null}
          </>
        ) : null}
      </div>
    );
  };

  // ── Filter ──
  // In the strip, the corpus line stands over the filter already: the documents go without it.
  const filter = (
    pinIn: HTMLDivElement | null | undefined,
    headingLevel: 2 | 3,
    inStrip = false,
  ) => (
    <Filter
      {...(pinIn !== undefined ? { pinIn } : {})}
      // Years as periods and many chosen values as one chip: standard since 13.11, no longer trials.
      yearPeriods
      compactChips
      yearFields={(a.fields ?? [])
        .filter((field) => field.kind === 'year')
        .map((field) => field.id)}
      fields={a.facets}
      selection={a.selection}
      onChange={a.setSelection}
      failed={a.facetsFailed}
      onRetry={a.retryFacets}
      // In the next look the filter belongs to the thread and «filteret er endret» says a change
      // in the answer, so there is no note in the filter about a thread under way.
      thread={filterPanel ? undefined : a.currentId}
      {...(filterPanel ? { variant: 'panel' as const, title: false as const } : {})}
      newThreadHref={a.hrefOf()}
      onNewThread={(event) => {
        event.preventDefault();
        a.leave(undefined);
      }}
      headingLevel={headingLevel}
      head={
        a.corpusChoice && a.corpus ? (
          <CorpusChoice
            options={a.corpora.length > 0 ? a.corpora : [a.corpus]}
            value={a.corpus.key}
            onChange={a.chooseCorpus}
            resetsFilter={!isEmptySelection(a.selection)}
          />
        ) : undefined
      }
    >
      {a.option('filter', 'documents') ? (
        filterPanel ? (
          // «Dokumentene som blir med»: the count from the facets. genki lists no documents for a
          // filter and cannot leave one out, so the box draws no list and no ticks.
          <DocumentsInScope
            count={a.readFrom}
            total={a.collectionSize}
            corpus={a.corpus}
            headingLevel={(headingLevel + 1) as 3 | 4}
          />
        ) : (
          <Documents
            documents={a.documents}
            corpus={a.corpus}
            {...(inStrip ? {} : { corpusLine })}
            headingLevel={(headingLevel + 1) as 3 | 4}
          />
        )
      ) : null}
    </Filter>
  );
  const corpusProfile = a.corpusKey ? a.profile?.corpora?.[a.corpusKey] : undefined;
  const corpusLine = (
    <CorpusLine
      corpus={a.corpus}
      fields={a.baseFacets}
      typeField={corpusProfile?.typeField}
      typePlurals={corpusProfile?.typePlurals}
    />
  );
  // A field with every value it lists chosen narrows nothing, so the strip does not name it.
  const narrowed = narrowing(a.selection, a.facets);
  const narrowedTo = (a.facets ?? []).flatMap((field) =>
    fieldValueLabels(field, narrowed[field.id] ?? []),
  );
  // The design's strip over the conversation: what the thread reads from, and «Endre».
  const filterStrip = (
    <section className="uia-filter-strip" aria-label={t('builder.filter')}>
      <div className="uia-filter-strip-row">
        <div className="uia-filter-strip-text">
          {corpusLine}
          {narrowedTo.length > 0 ? (
            <Paragraph data-size="sm" className="uia-filter-strip-narrowed">
              {t('conversation.narrowed', { values: narrowedTo.join(' · ') })}
            </Paragraph>
          ) : null}
        </div>
        <Button
          variant="secondary"
          data-size="sm"
          aria-expanded={stripOpen}
          onClick={() => setStripOpen((open) => !open)}
        >
          {stripOpen ? t('assembly.stripClose') : t('assembly.stripChange')}
        </Button>
      </div>
      {stripOpen ? <div className="uia-filter-strip-body">{filter(undefined, 2, true)}</div> : null}
    </section>
  );

  // ── Threads ──
  const threadList = (
    <Threads
      threads={a.threadRows}
      failed={a.threadsFailed}
      onRetry={a.reloadThreads}
      currentId={a.page === 'chat' ? a.currentId : undefined}
      threadHref={(thread) => a.hrefOf(thread.id)}
      onOpenThread={(thread) => a.leave(thread.id)}
      newThreadHref={a.hrefOf()}
      onNewThread={() => {
        // The next look stays on «Tråder»: its filter is to get a panel of its own.
        if (twoViews && !next) {
          setPrimaryView('filters');
          setSwitchedView(false);
        }
        a.newThread();
      }}
      {...(a.renameThread ? { onRename: a.renameThread } : {})}
      {...(a.deleteThread ? { onDelete: a.deleteThread } : {})}
      // Under the panel's title «Tråder» in the next look, which has the reader in the panel's foot.
      {...(next ? { headingLevel: 3 as const } : {})}
      foot={
        a.profile?.signedInAs && !next ? (
          <SignedIn
            name={a.profile.signedInAs}
            {...(a.profile.signOut
              ? { signOutHref: a.profile.signOut.href, onSignOut: a.signOut }
              : {})}
          />
        ) : undefined
      }
      {...(twoViews && !next
        ? {
            onShowFilters: () => {
              setPrimaryView('filters');
              setSwitchedView(true);
            },
            focusShowFilters: switchedView,
          }
        : {})}
      // The dev-trader board's list in the next look: no search, and no way to the filter here.
      {...(next ? { variant: 'nav' as const, search: false } : {})}
    />
  );

  // ── The reader in the next look: the profile button at the primary panel's foot, which opens
  // the profile menu, «Innstillinger» first. Only with a name to show; without one, the links. ──
  const profile: ShellProfileProps | undefined =
    next && a.profile?.signedInAs
      ? {
          name: a.profile.signedInAs,
          organisation: a.profile.organisation,
          ...(settingsOn
            ? {
                settings: {
                  href: a.settingsHref,
                  onSelect: () => {
                    setSettingsView('general');
                    a.showSettings();
                  },
                },
              }
            : {}),
          ...a.profile.menu,
          ...(a.profile.signOut
            ? { signOut: { href: a.profile.signOut.href, onSignOut: a.signOut } }
            : {}),
        }
      : undefined;
  // Pinned, so the list scrolls above it and never runs under it (WCAG 2.4.11). Not on the rail.
  const profileFoot: Partial<ShellPanel> = profile
    ? { foot: <ShellProfile {...profile} />, footPinned: true }
    : {};

  // The folded threads panel in the next look: its button, then «Ny tråd» as a plus (dev-navbar).
  const newThreadRail = (
    <Tooltip content={t('threads.newThread')} placement="right">
      <Button asChild data-size="md" icon>
        <a
          aria-label={t('threads.newThread')}
          href={a.hrefOf()}
          onClick={(event) => {
            if (!plainClick(event)) return;
            event.preventDefault();
            a.newThread();
          }}
        >
          <PlusIcon aria-hidden />
        </a>
      </Button>
    </Tooltip>
  );

  // ── Settings, from the primary panel's foot ──
  const foot =
    settingsOn && !profile ? (
      <SettingsLinks
        settingsHref={a.settingsHref}
        currentHref={a.page === 'settings' ? a.settingsHref : undefined}
        assistantName={name}
        onNavigate={() => a.showSettings()}
      />
    ) : undefined;

  // The next look's sizes, the dev-navbar board's at 1720: threads 220, tools 380.
  const nextPrimary: Partial<ShellPanel> = next
    ? { size: { width: 220, minWidth: 220 }, ...profileFoot }
    : {};
  const threadsTitle = next ? { title: t('builder.threads') } : {};

  const threadsAndFilter = phrase(t, [t('builder.threads'), t('builder.filter')]);
  let primary: ShellPanel | undefined;
  if (twoViews) {
    primary =
      primaryView === 'threads'
        ? { label: threadsAndFilter, ...threadsTitle, children: threadList, foot, ...nextPrimary }
        : {
            label: threadsAndFilter,
            head: (
              <Button
                ref={back}
                variant="tertiary"
                data-color="neutral"
                onClick={() => {
                  setPrimaryView('threads');
                  setSwitchedView(true);
                }}
              >
                <ArrowLeftIcon aria-hidden />
                {t('builder.threads')}
              </Button>
            ),
            pinnedRef: setFilterPin,
            children: filter(filterPin, 2),
            foot,
            ...nextPrimary,
          };
  } else if (threadsOn) {
    primary = {
      label: filterPanel ? threadsAndFilter : t('builder.threads'),
      ...threadsTitle,
      children: threadList,
      foot,
      ...nextPrimary,
      ...(next ? { rail: newThreadRail } : {}),
      // The filter's own panel in the threads' card, 220 + 440 at 1720 as dev-filter-panel draws
      // it: «Filter», «Gjelder neste spørsmål», and the card's button on its row.
      ...(filterPanel
        ? {
            // With `compact-filter`, no narrower than the threads' 220 beside the filter's 230.
            size: { width: 660, minWidth: compactFilter ? 220 + 230 : 660 },
            companion: {
              label: t('assembly.filterForThread'),
              title: t('builder.filter'),
              subtitle: t('filter.appliesNext'),
              width: compactFilter ? 230 : 440,
              ...(compactFilter
                ? {
                    keepWidth: true,
                    children: <div style={oneColumnTicks}>{filter(undefined, 2)}</div>,
                  }
                : { children: filter(undefined, 2) }),
            },
          }
        : {}),
    };
  } else if (filterZone === 'primary' && !filtersBeside) {
    primary = {
      label: t('builder.filter'),
      pinnedRef: setFilterPin,
      children: filter(filterPin, 2),
      foot,
      ...nextPrimary,
    };
  } else if (foot) {
    primary = { label: t('builder.settings'), foot, footPinned: true };
  } else if (profile) {
    primary = { label: t('builder.settings'), ...nextPrimary };
  }

  // ── The next look's «Innstillinger» (dev-innstillinger-1 to -4): the primary panel turns into
  // the settings menu, each page stands in the main card, and there is no secondary panel. ──
  const nextSettings = next && a.page === 'settings' && settingsOn;
  const experimentRows = (a.profile?.experiments ?? []).map((experiment) => ({
    ...experiment,
    on: a.flags.has(experiment.id),
  }));
  if (nextSettings)
    primary = {
      label: t('builder.settings'),
      title: t('builder.settings'),
      children: (
        <SettingsMenu
          pages={settingsPageIds.map((id) => ({
            id,
            ...(id === 'beta' ? { badge: experimentsOn(experimentRows) } : {}),
          }))}
          value={settingsView}
          onChange={(id) => {
            if (!isSettingsPageId(id)) return;
            setSettingsView(id);
            // On a phone the menu is a drawer over the page: it closes on the reader's choice.
            a.showSettings();
          }}
          backHref={a.hrefOf(a.urlThreads ? a.currentId : undefined)}
          onBack={a.backToThreads}
        />
      ),
      foot,
      ...nextPrimary,
      // The menu alone, 220 at 1720 (dev-innstillinger-1), and never wider: the threads' card, 660
      // with the filter beside them or as the reader dragged it, keeps its width for the way back.
      size: { width: 220, minWidth: 220, maxWidth: 220 },
    };

  // ── The secondary panel's tools, in the catalogue's order ──
  // The next look's «Kilder» tool (dev-kilder-hoyre): its search and caption, the documents' light
  // blue heads with their titles in the text's grey, and no disclaimer, answer pager or ids, which
  // the board does not draw. The answer it shows follows the footnote or the latest answer.
  const sourcesBlock = (titled: boolean) => (
    <Sources
      color="neutral"
      {...(titled ? {} : { title: false })}
      sources={a.activeAnswer?.sources}
      answerStatus={a.activeAnswer ? a.activeAnswer.status : 'unasked'}
      citations={a.citations}
      loading={a.activeAnswer?.status === 'streaming' && !a.activeAnswer.sources}
      corpus={a.corpus?.label}
      assistantName={name}
      target={a.sourceTarget}
      answerIndex={a.shownIndex}
      answerCount={a.answered.length}
      onShowUse={a.footnotes ? a.goToUse : undefined}
      onReturn={a.footnotes ? a.returnToAnswer : undefined}
      search={a.option('sources', 'search')}
      {...(next
        ? {
            variant: 'tool' as const,
            headerColor: 'brand3',
            disclaimer: false,
            foldUncited: true,
          }
        : {
            onAnswerChange: a.showAnswer,
            disclaimer: a.option('sources', 'disclaimer'),
            details: true,
          })}
      // The documents one under the panel's «Verktøy» in the next look, Kilder's own title unsaid.
      headingLevel={3}
      {...(documentOn
        ? {
            excerptActions: ({ source, excerpt }) => (
              <Button
                variant="tertiary"
                data-size="sm"
                onClick={() => {
                  if (!a.active) return;
                  a.openDocument(
                    a.active.id,
                    { chunkId: excerpt.chunkId, documentId: source.documentId },
                    'sources',
                  );
                }}
                // Named in one piece, the words seen and then which document: a hidden box after
                // the words would make a browser read a space before the comma.
                aria-label={`${t('documentView.show')}, ${source.title.trim() || t('sources.untitled')}`}
              >
                <FileTextIcon aria-hidden />
                {t('documentView.show')}
              </Button>
            ),
          }
        : {})}
    />
  );
  const sourcesView = (titled: boolean) =>
    next ? (
      <div className="uia-sources-tool" style={sourcesTool}>
        {sourcesBlock(titled)}
      </div>
    ) : (
      sourcesBlock(titled)
    );
  // Escape in the document is its way back. In a drawer, a modal dialog, the browser would also
  // close the drawer and put the focus on the drawer's button, wherever the way back sends it.
  // Not from the question field, where Escape is the field's.
  const escapeStaysInDrawer = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !a.openDoc) return;
    if (event.target instanceof Element && event.target.closest('form')) return;
    event.preventDefault();
  };
  const documentView = (titled: boolean) => (
    <DocumentView
      color="neutral"
      {...(titled ? {} : { title: false })}
      sources={a.documentAnswer?.sources}
      target={a.openDoc?.target}
      citations={a.documentCitations}
      answerIndex={a.documentIndex}
      answerCount={a.answered.length}
      onShowUse={a.footnotes ? a.showDocumentUse : undefined}
      onReturn={a.openDoc ? a.returnFromDocument : undefined}
      returnTo={a.openDoc?.returnTo}
      // Asked in the thread, where Chat is: without it there is nowhere to ask.
      onAsk={chatZone ? a.askAboutDocument : undefined}
      // Its hint names what opens a document here: «Vis i dokumentet» in Kilder, or else a
      // footnote, which goes to Kilder whenever Kilder is placed.
      opensFrom={sourcesOn ? 'sources' : 'answer'}
      corpus={a.corpus?.label}
      headingLevel={3}
    />
  );
  // Stored answers carry no steps, so a thread that has some says why none are shown.
  const approachSteps = approachOf(a, a.active?.id, t, cardPlace);
  const approachNote = (
    <Paragraph data-size="sm" className="uia-quiet">
      {a.working
        ? t('assembly.approachWaiting')
        : a.answered.length > 0
          ? t('assembly.approachNotKept')
          : t('assembly.approachEmpty')}
    </Paragraph>
  );
  // The tool is the detailed one, the next look's as the list of the dev-verktoy boards.
  const approachPanel = approachOf(a, a.active?.id, t, 'tool') ?? approachNote;
  // Each tool's icon, as the dev-verktoy boards draw it, in the switcher.
  const icon = (id: string) =>
    next ? { icon: toolIcons[id] ?? <FileTextIcon aria-hidden /> } : {};
  const tools: ShellTool[] = [
    ...(approachTool
      ? [
          {
            id: 'approach',
            label: t('builder.approach'),
            content: approachPanel,
            ...icon('approach'),
          },
        ]
      : []),
    ...(chatZone === 'secondary'
      ? [{ id: 'chat', label: t('builder.chat'), content: chat(true, false), ...icon('chat') }]
      : []),
    ...(sourcesOn
      ? [
          {
            id: 'sources',
            label: t('builder.sources'),
            content: sourcesView(false),
            ...icon('sources'),
          },
        ]
      : []),
    ...(a.documentZone === 'secondary'
      ? [
          {
            id: 'document-view',
            label: t('builder.documentView'),
            ...icon('document-view'),
            content: (
              <div
                onKeyDownCapture={escapeStaysInDrawer}
                // Dokumentvisning's jumps stay at the top while the document scrolls: under the
                // switcher the shell pins there, not behind it, at the height the shell measures.
                style={
                  {
                    '--genai-document-view-jumps-inset': 'var(--uib-shell-pinned-block-size, 0px)',
                  } as CSSProperties
                }
              >
                {documentView(false)}
              </div>
            ),
          },
        ]
      : []),
  ];
  // Kilder alone keeps its own heading, as kunnskapsassistenten draws it; the switcher names the
  // tools only when there is a choice, or for a tool with no heading of its own. In the next look
  // one tool's name is the panel's title (dev-verktoy-1), so the tool stands alone under it.
  const onlySources = !next && tools.length === 1 && tools[0]?.id === 'sources';
  const singleTool = next && tools.length === 1 ? tools[0] : undefined;
  const toolsView = onlySources ? (
    sourcesView(true)
  ) : singleTool ? (
    singleTool.content
  ) : tools.length > 0 ? (
    <ShellTools
      tools={tools}
      value={a.tool}
      onChange={a.setTool}
      pinIn={toolsPin}
      {...(next ? { headingLevel: 3 as const, variant: 'tinted' as const } : {})}
    />
  ) : null;
  // `filters-right-panel`: the filter over the tools, drawn first and named first, as
  // kunnskapsassistenten's withFiltersBesideSources.
  const secondary: ShellPanel | undefined =
    tools.length > 0 || filtersBeside
      ? {
          // Named after what is in it, as one phrase: «Filter og kilder», «Fremgangsmåte, kilder og
          // dokumentvisning».
          // The next look's card is «verktøypanelet», whatever it holds: «Skjul verktøypanelet».
          label:
            next && !filtersBeside
              ? t('assembly.toolsPanel')
              : phrase(t, [
                  ...(filtersBeside ? [t('builder.filter')] : []),
                  ...tools.map((tool) => tool.label),
                ]),
          ...(onlySources || singleTool || filtersBeside ? {} : { pinnedRef: setToolsPin }),
          children: filtersBeside ? (
            <>
              <section className="uia-stacked">{filter(undefined, 2)}</section>
              {toolsView ? <section className="uia-stacked">{toolsView}</section> : null}
            </>
          ) : (
            toolsView
          ),
          // Folded until it has something to show, as kunnskapsassistenten's Kilder; open from the
          // start when Chat stands here, or there would be nothing to ask in.
          ...(chatZone === 'secondary' ? { defaultCollapsed: false } : {}),
          // The next look titles the panel by how many tools it has: the tool's name for one
          // (dev-verktoy-1), else «Verktøy» with the switcher under it; 380 wide.
          ...(next
            ? { title: singleTool ? singleTool.label : t('shell.tools'), size: { width: 380 } }
            : {}),
        }
      : undefined;

  // ── The main column ──
  const experiments = a.profile?.experiments ?? [];
  let main: ReactNode;
  if (nextSettings) {
    // Each page draws only what works here: the colour scheme the host keeps, the reader from the
    // sign-in, and the profile's trials. What genki cannot honour yet is not given, so not drawn.
    const feedback = a.profile?.menu?.feedback;
    main =
      settingsView === 'about-you' ? (
        <SettingsAboutYou name={a.profile?.signedInAs} organisation={a.profile?.organisation} />
      ) : settingsView === 'beta' ? (
        <SettingsBeta
          experiments={experimentRows}
          onExperimentChange={a.setFlag}
          onAllOff={a.flagsOff}
          feedback={feedback}
        />
      ) : settingsView === 'privacy' ? (
        <SettingsPrivacy />
      ) : (
        <SettingsGeneral
          {...(a.onColorSchemeChange
            ? { colorScheme: { value: a.colorScheme, onChange: a.onColorSchemeChange } }
            : {})}
        />
      );
  } else if (a.page === 'settings' && settingsOn) {
    main = (
      <Settings
        headingLevel={1}
        colorScheme={a.colorScheme}
        onColorSchemeChange={(scheme) => a.onColorSchemeChange?.(scheme)}
        displayLevel={a.level}
        onDisplayLevelChange={a.setLevel}
        {...(experiments.length > 0
          ? {
              experiments: experiments.map((experiment) => ({
                ...experiment,
                on: a.flags.has(experiment.id),
              })),
              onExperimentChange: a.setFlag,
            }
          : {})}
        note={a.profile?.settingsNote}
      />
    );
  } else {
    // Chat alone is the shell's child, as in kunnskapsassistenten, with no wrapper around it. With
    // Dokumentvisning beside it the wrapper stays, so opening a document moves nothing.
    const chatAlone = chatZone === 'main' && filterZone !== 'main' && a.documentZone !== 'main';
    const parts: ReactNode[] = [];
    // Without Chat beside it, Fremgangsmåte has the column's head, as wide as the strip under it.
    // Its note is named by a heading, as the secondary panel's switcher names it there; the steps
    // name themselves on their own summary.
    if (approachCard && chatZone !== 'main')
      parts.push(
        approachSteps ? (
          <div key="approach" className="uia-main-approach">
            {approachSteps}
          </div>
        ) : (
          <section key="approach" className="uia-main-approach" aria-labelledby={approachHeadingId}>
            <Heading id={approachHeadingId} level={2} data-size="xs">
              {t('builder.approach')}
            </Heading>
            {approachNote}
          </section>
        ),
      );
    if (filterZone === 'main') parts.push(<div key="filter">{filterStrip}</div>);
    if (chatZone === 'main')
      parts.push(
        // Hidden, not gone, while a document stands in its place: the conversation keeps its
        // place and the field its text, and the way back finds the footnote.
        <div key="chat" className="uia-main-chat" hidden={chatHidden || undefined}>
          {chat(false, false)}
        </div>,
      );
    // Beside Chat only while a document is open; without Chat, the document has the column.
    if (a.documentZone === 'main' && (!a.documentOverChat || a.openDoc))
      parts.push(
        <div
          key="document-view"
          className="uia-main-document"
          onKeyDownCapture={escapeStaysInDrawer}
        >
          {documentView(true)}
        </div>,
      );
    if (!chatZone)
      parts.push(
        <EmptyState
          key="no-chat"
          title={t('assembly.noChatTitle')}
          description={t('assembly.noChat')}
        />,
      );
    // The main column cannot go, as a panel can: say it is empty rather than draw nothing.
    if (parts.length === 0)
      parts.push(
        <Paragraph key="empty" data-size="sm" className="uia-quiet">
          {t('assembly.emptyMain')}
        </Paragraph>,
      );
    main = chatAlone ? (
      chat(false, true)
    ) : (
      <div className="uia-main">
        {pageHeading}
        {parts}
      </div>
    );
  }

  const settingsPage = a.page === 'settings' && settingsOn;
  return (
    <Shell
      primary={primary}
      secondary={nextSettings ? undefined : secondary}
      request={a.request}
      // The next look: cards, and the thread's title as the page's `h1` over the conversation.
      // «Innstillinger» keeps its own `h1` until it gets its own panels.
      {...(next
        ? { frame: 'cards' as const, mainTitle: settingsPage ? undefined : a.threadTitle }
        : {})}
      // Beside the filter's panel the conversation is 624 wide at 1720 (dev-filter-panel), so both
      // panels stay open there.
      {...(filterPanel ? { mainSize: { minWidth: 600 } } : {})}
      mainId={mainId}
      initialLayout={a.shellLayout}
      onLayoutChange={a.onShellLayout}
      skipLinks={
        a.page === 'chat' && chatZone === 'main' && !chatHidden ? (
          <SkipLink
            href={`#${fieldId ?? 'composer-field'}`}
            onClick={(event) => {
              event.preventDefault();
              a.fieldRef.current?.focus();
            }}
          >
            {t('assembly.skipToField', { modifier: modifier() })}
          </SkipLink>
        ) : null
      }
    >
      {main}
    </Shell>
  );
};
