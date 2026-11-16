// The four settings pages of the dev-innstillinger boards. A page draws a row only for what the
// host can honour, given as a value and its handler together: a choice the host cannot keep is
// left out, never drawn dead. The info box speaks of what the rows do, so it comes with them.
import {
  Button,
  Chip,
  Heading,
  Link,
  Paragraph,
  Switch,
  Tag,
  Textfield,
} from '@digdir/designsystemet-react';
import { useFormat } from '@genai/i18n/react';
import { DownloadIcon, ExternalLinkIcon, PlusIcon, TrashIcon } from '@navikt/aksel-icons';
import { useId, type ReactNode } from 'react';
import { classes, plainClick } from '../dom.js';
import type { SettingsExperiment } from './Choices.js';
import type { ColorScheme } from './colorScheme.js';
import { generalLead, generalRowsOf } from './general.js';
import { useT } from './i18n.js';
import { ColorSchemeToggle } from './Settings.js';
import {
  ChoiceRow,
  SettingsPage,
  SettingsRow,
  SwitchRow,
  type SettingsChoice,
  type SettingsToggle,
} from './SettingsPage.js';

type HeadingLevel = 1 | 2 | 3 | 4 | 5;

/** A page or an action the host offers: a link, or a plain click it handles. */
export interface SettingsAction {
  href?: string | undefined;
  onSelect?: (() => void) | undefined;
}

const given = (action: SettingsAction | undefined): action is SettingsAction =>
  !!action && (action.href !== undefined || !!action.onSelect);

/** What every page takes from the host besides its rows. */
export interface SettingsPageNote {
  /** `SettingsPage`'s `note`, named apart from «Om deg»'s own `note`. */
  settingsNote?: ReactNode;
}

/** A button that is a link where the host gives one, as «Gi tilbakemelding» and «Last ned». */
const ActionButton = ({ action, children }: { action: SettingsAction; children: ReactNode }) =>
  action.href !== undefined ? (
    <Button asChild variant="secondary">
      <a
        href={action.href}
        onClick={(event) => {
          if (!action.onSelect || !plainClick(event)) return;
          event.preventDefault();
          action.onSelect();
        }}
      >
        {children}
      </a>
    </Button>
  ) : (
    <Button onClick={() => action.onSelect?.()} variant="secondary">
      {children}
    </Button>
  );

// ── Generelt ──

export type AnswerLanguage = 'nb' | 'nn' | 'en';
export type AnswerLength = 'short' | 'normal' | 'long';
export type OpenWith = 'new' | 'last';
export type TextSize = 'standard' | 'large' | 'larger';

export interface SettingsGeneralProps extends SettingsPageNote {
  /** «Utseende»: light, dark or the system's, as `ColorSchemeToggle` draws it. */
  colorScheme?: SettingsChoice<ColorScheme> | undefined;
  /** «Språk i svarene». The service must answer in the language chosen. */
  answerLanguage?: SettingsChoice<AnswerLanguage> | undefined;
  /** «Svarlengde». The service must write to the length chosen. */
  answerLength?: SettingsChoice<AnswerLength> | undefined;
  /** «Når du åpner tjenesten»: a new thread, or the last one. */
  openWith?: SettingsChoice<OpenWith> | undefined;
  /** «Tekststørrelse», for the answers and the sources, not the menus. */
  textSize?: SettingsChoice<TextSize> | undefined;
  headingLevel?: HeadingLevel | undefined;
  /** The host's own rows, after the block's. */
  children?: ReactNode;
  className?: string | undefined;
}

/** «Generelt» (dev-innstillinger-1): language, how the answers look, and where the reader starts. */
export const SettingsGeneral = ({
  colorScheme,
  answerLanguage,
  answerLength,
  openWith,
  textSize,
  headingLevel,
  children,
  settingsNote,
  className,
}: SettingsGeneralProps) => {
  const t = useT();
  const f = useFormat();
  const rows = generalRowsOf({ answerLanguage, answerLength, openWith, colorScheme, textSize });
  return (
    <SettingsPage
      className={classes('uib-settings-general', className)}
      empty={rows.length === 0 && !children}
      headingLevel={headingLevel}
      lead={generalLead(t, f, rows)}
      note={settingsNote}
      // It speaks of the answers' instructions, so it comes with a choice the service honours.
      notice={
        answerLanguage || answerLength
          ? { title: t('settings.generalNoticeTitle'), text: t('settings.generalNotice') }
          : undefined
      }
      title={t('settings.general')}
    >
      {answerLanguage ? (
        <ChoiceRow
          choice={answerLanguage}
          description={t('settings.answerLanguageDescription')}
          options={[
            { value: 'nb', label: t('settings.languageNb') },
            { value: 'nn', label: t('settings.languageNn') },
            { value: 'en', label: t('settings.languageEn') },
          ]}
          title={t('settings.answerLanguage')}
        />
      ) : null}
      {answerLength ? (
        <ChoiceRow
          choice={answerLength}
          description={t('settings.answerLengthDescription')}
          options={[
            { value: 'short', label: t('settings.lengthShort') },
            { value: 'normal', label: t('settings.lengthNormal') },
            { value: 'long', label: t('settings.lengthLong') },
          ]}
          title={t('settings.answerLength')}
        />
      ) : null}
      {openWith ? (
        <ChoiceRow
          choice={openWith}
          options={[
            { value: 'new', label: t('settings.openNew') },
            { value: 'last', label: t('settings.openLast') },
          ]}
          title={t('settings.openWith')}
        />
      ) : null}
      {colorScheme ? (
        <SettingsRow title={t('settings.appearance')}>
          {(ids) => (
            <ColorSchemeToggle
              labelledBy={ids.title}
              look="full"
              onChange={colorScheme.onChange}
              value={colorScheme.value}
            />
          )}
        </SettingsRow>
      ) : null}
      {textSize ? (
        <ChoiceRow
          choice={textSize}
          description={t('settings.textSizeDescription')}
          options={[
            { value: 'standard', label: t('settings.sizeStandard') },
            { value: 'large', label: t('settings.sizeLarge') },
            { value: 'larger', label: t('settings.sizeLarger') },
          ]}
          title={t('settings.textSize')}
        />
      ) : null}
      {children}
    </SettingsPage>
  );
};

// ── Om deg ──

/** One thing the assistant remembers about the reader, with where it learnt it. */
export interface SettingsMemory {
  id: string;
  text: string;
  /** The thread it is from, by its title. */
  thread?: string | undefined;
  /** When, as the host words it: «2. okt.», «i dag». */
  when?: string | undefined;
  /** What it changes, as a tag under it: «Påvirker hvilke kilder som vektes». */
  effect?: string | undefined;
}

export interface SettingsAboutYouProps extends SettingsPageNote {
  /** The reader's name from the sign-in, shown locked. */
  name?: string | undefined;
  /** Their organisation from the sign-in, shown locked. */
  organisation?: string | undefined;
  /** «Rolle», kept by the service and used in its answers. */
  role?: SettingsChoice<string> | undefined;
  /** «Fagområder»: each can be removed, and `onAdd` asks the host for one more. */
  subjects?:
    | { values: readonly string[]; onRemove: (subject: string) => void; onAdd: () => void }
    | undefined;
  /** «Noe mer assistenten bør vite?», free text. */
  note?: SettingsChoice<string> | undefined;
  /** «Husk ting fra tidligere tråder». */
  remember?: SettingsToggle | undefined;
  /** «Dette husker assistenten», in groups, each item forgotten with `onForget`. */
  memories?:
    | {
        groups: readonly { title: string; items: readonly SettingsMemory[] }[];
        onForget: (id: string) => void;
        /** «Endre». Without it, only «Glem». */
        onEdit?: ((id: string) => void) | undefined;
      }
    | undefined;
  headingLevel?: HeadingLevel | undefined;
  children?: ReactNode;
  className?: string | undefined;
}

/** «Om deg» (dev-innstillinger-2): who the reader is, and what the assistant remembers. */
export const SettingsAboutYou = ({
  name,
  organisation,
  role,
  subjects,
  note,
  remember,
  memories,
  headingLevel,
  children,
  settingsNote,
  className,
}: SettingsAboutYouProps) => {
  const t = useT();
  const memoriesId = useId();
  // What tailors the answers; the page's line and box speak of it, so they come with it.
  const tailors = !!(role || subjects || note || remember || memories);
  const drawn = tailors || !!name || !!organisation;
  return (
    <SettingsPage
      className={classes('uib-settings-about-you', className)}
      empty={!drawn && !children}
      headingLevel={headingLevel}
      lead={tailors ? t('settings.aboutYouLead') : undefined}
      note={settingsNote}
      notice={
        tailors
          ? { title: t('settings.aboutYouNoticeTitle'), text: t('settings.aboutYouNotice') }
          : undefined
      }
      title={t('settings.aboutYou')}
    >
      {name ? (
        <div className="uib-settings-row">
          <Textfield
            description={t('settings.fromLogin')}
            label={t('settings.name')}
            readOnly
            value={name}
          />
        </div>
      ) : null}
      {organisation ? (
        <div className="uib-settings-row">
          <Textfield label={t('settings.organisation')} readOnly value={organisation} />
        </div>
      ) : null}
      {role ? (
        <div className="uib-settings-row">
          <Textfield
            description={t('settings.roleDescription')}
            label={t('settings.role')}
            onChange={(event) => role.onChange(event.currentTarget.value)}
            value={role.value ?? ''}
          />
        </div>
      ) : null}
      {subjects ? (
        <SettingsRow description={t('settings.subjectsDescription')} title={t('settings.subjects')}>
          {() => (
            <div className="uib-settings-subjects">
              {subjects.values.map((subject) => (
                <Chip.Removable
                  aria-label={t('settings.removeSubject', { subject })}
                  key={subject}
                  onClick={() => subjects.onRemove(subject)}
                >
                  {subject}
                </Chip.Removable>
              ))}
              <Button data-size="sm" onClick={subjects.onAdd} variant="secondary">
                <PlusIcon aria-hidden />
                {t('settings.addSubject')}
              </Button>
            </div>
          )}
        </SettingsRow>
      ) : null}
      {note ? (
        <div className="uib-settings-row">
          <Textfield
            label={t('settings.moreToKnow')}
            multiline
            onChange={(event) => note.onChange(event.currentTarget.value)}
            rows={3}
            value={note.value ?? ''}
          />
        </div>
      ) : null}
      {remember ? (
        <SwitchRow
          description={t('settings.rememberDescription')}
          title={t('settings.remember')}
          toggle={remember}
        />
      ) : null}
      {memories ? (
        <section aria-labelledby={memoriesId} className="uib-settings-memories">
          <div className="uib-settings-row-text">
            <Heading
              className="uib-settings-row-title"
              data-size="2xs"
              id={memoriesId}
              level={((headingLevel ?? 1) + 1) as HeadingLevel}
            >
              {t('settings.memories')}
            </Heading>
            <span className="uib-settings-row-description">
              {t('settings.memoriesDescription')}
            </span>
          </div>
          {memories.groups.map((group) => (
            <div className="uib-settings-memory-group" key={group.title}>
              <span className="uib-settings-memory-group-title">{group.title}</span>
              <ul className="uib-settings-memory-list">
                {group.items.map((memory) => (
                  <li className="uib-settings-memory" key={memory.id}>
                    <span className="uib-settings-row-text">
                      <span>{memory.text}</span>
                      {memory.thread || memory.when ? (
                        <span className="uib-settings-row-description">
                          {[
                            memory.thread
                              ? t('settings.memoryFrom', { thread: memory.thread })
                              : undefined,
                            memory.when,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      ) : null}
                      {memory.effect ? (
                        <Tag className="uib-settings-memory-effect" data-color="warning">
                          {memory.effect}
                        </Tag>
                      ) : null}
                    </span>
                    {memories.onEdit ? (
                      <Button
                        data-size="sm"
                        onClick={() => memories.onEdit?.(memory.id)}
                        variant="tertiary"
                      >
                        {t('settings.editMemory')}
                        <span className="ds-sr-only">: {memory.text}</span>
                      </Button>
                    ) : null}
                    <Button
                      data-size="sm"
                      onClick={() => memories.onForget(memory.id)}
                      variant="tertiary"
                    >
                      {t('settings.forgetMemory')}
                      <span className="ds-sr-only">: {memory.text}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
      {children}
    </SettingsPage>
  );
};

// ── Beta-funksjoner ──

export interface SettingsBetaProps extends SettingsPageNote {
  /** The trials the reader may turn on, each with whether it is on. */
  experiments?: readonly SettingsExperiment[] | undefined;
  /** The reader turned a trial on or off. Without it, or without trials, there is no list. */
  onExperimentChange?: ((id: string, on: boolean) => void) | undefined;
  /** «Slå av alle», drawn while one is on. */
  onAllOff?: (() => void) | undefined;
  /** «Si hva du synes», with «Gi tilbakemelding»: the host's feedback page or form. */
  feedback?: SettingsAction | undefined;
  headingLevel?: HeadingLevel | undefined;
  children?: ReactNode;
  className?: string | undefined;
}

/** How many of the trials are on, for the page's count and the menu's badge. */
export const experimentsOn = (experiments: readonly SettingsExperiment[] | undefined) =>
  (experiments ?? []).filter((experiment) => experiment.on).length;

/** «Beta-funksjoner» (dev-innstillinger-3): the host's trials, each a switch, and how many are on. */
export const SettingsBeta = ({
  experiments = [],
  onExperimentChange,
  onAllOff,
  feedback,
  headingLevel,
  children,
  settingsNote,
  className,
}: SettingsBetaProps) => {
  const t = useT();
  const feedbackId = useId();
  const listed = !!onExperimentChange && experiments.length > 0;
  const on = experimentsOn(experiments);
  const asking = given(feedback);
  return (
    <SettingsPage
      className={classes('uib-settings-beta', className)}
      empty={!listed && !asking && !children}
      headingLevel={headingLevel}
      lead={t('settings.betaLead')}
      note={settingsNote}
      notice={
        listed
          ? { title: t('settings.betaNoticeTitle'), text: t('settings.betaNotice') }
          : undefined
      }
      title={t('settings.beta')}
    >
      {listed ? (
        <>
          <div className="uib-settings-count">
            <span>
              <strong>{on}</strong> {t('settings.betaCountOf', { all: experiments.length })}
            </span>
            {onAllOff && on > 0 ? (
              <Button data-size="sm" onClick={onAllOff} variant="secondary">
                {t('settings.allOff')}
              </Button>
            ) : null}
          </div>
          <div className="uib-settings-experiment-rows">
            {experiments.map((experiment) => (
              <div className="uib-settings-row uib-settings-switch-row" key={experiment.id}>
                <Switch
                  checked={experiment.on}
                  description={
                    experiment.description || experiment.href ? (
                      <>
                        {experiment.description}
                        {experiment.description && experiment.href ? ' ' : null}
                        {experiment.href ? (
                          <Link href={experiment.href} rel="noreferrer" target="_blank">
                            {experiment.hrefLabel ?? t('settings.readMore')}
                            <span className="ds-sr-only"> {t('settings.newTab')}</span>
                            <ExternalLinkIcon aria-hidden />
                          </Link>
                        ) : null}
                      </>
                    ) : undefined
                  }
                  label={experiment.title}
                  onChange={(event) =>
                    onExperimentChange?.(experiment.id, event.currentTarget.checked)
                  }
                  position="end"
                />
              </div>
            ))}
          </div>
        </>
      ) : null}
      {asking ? (
        <section aria-labelledby={feedbackId} className="uib-settings-box">
          <Heading
            className="uib-settings-box-title"
            data-size="2xs"
            id={feedbackId}
            level={((headingLevel ?? 1) + 1) as HeadingLevel}
          >
            {t('settings.betaFeedbackTitle')}
          </Heading>
          <Paragraph className="uib-settings-row-description" data-size="xs">
            {t('settings.betaFeedback')}
          </Paragraph>
          <ActionButton action={feedback}>{t('settings.giveFeedback')}</ActionButton>
        </section>
      ) : null}
      {children}
    </SettingsPage>
  );
};

// ── Personvern og data ──

/** A thread the reader shares, with the line under it as the host words it. */
export interface SettingsSharedThread {
  id: string;
  title: string;
  /** «Delt med 2 personer · 2. okt.» */
  detail?: string | undefined;
}

export interface SettingsPrivacyProps extends SettingsPageNote {
  /** The collection's name, for the box: «Dokumentene i Kudos er offentlige». */
  corpus?: string | undefined;
  /** «Lagre tråder», in days: 30, 60 or 90 unless the host offers others. */
  keepThreads?: (SettingsChoice<number> & { options?: readonly number[] | undefined }) | undefined;
  /** «Bruk samtalene mine til å forbedre tjenesten». */
  improve?: SettingsToggle | undefined;
  /** «Delte tråder», each with «Slutt å dele». */
  shared?:
    { threads: readonly SettingsSharedThread[]; onStopSharing: (id: string) => void } | undefined;
  /** «Last ned dataene dine». */
  download?: SettingsAction | undefined;
  /** «Slett all historikk». The host asks the reader to confirm. */
  clearHistory?: { onClear: () => void } | undefined;
  headingLevel?: HeadingLevel | undefined;
  children?: ReactNode;
  className?: string | undefined;
}

/** «Personvern og data» (dev-innstillinger-4): what is kept, who sees it, and for how long. */
export const SettingsPrivacy = ({
  corpus,
  keepThreads,
  improve,
  shared,
  download,
  clearHistory,
  headingLevel,
  children,
  settingsNote,
  className,
}: SettingsPrivacyProps) => {
  const t = useT();
  const drawn = !!(keepThreads || improve || shared || given(download) || clearHistory);
  const days = keepThreads?.options ?? [30, 60, 90];
  return (
    <SettingsPage
      className={classes('uib-settings-privacy', className)}
      empty={!drawn && !children}
      headingLevel={headingLevel}
      lead={t('settings.privacyLead')}
      note={settingsNote}
      notice={
        drawn
          ? {
              title: t('settings.privacyNoticeTitle'),
              text: corpus
                ? t('settings.privacyNotice', { corpus })
                : t('settings.privacyNoticeUnnamed'),
            }
          : undefined
      }
      title={t('settings.privacy')}
    >
      {keepThreads ? (
        <ChoiceRow
          choice={{
            value: keepThreads.value === undefined ? undefined : String(keepThreads.value),
            onChange: (chosen) => keepThreads.onChange(Number(chosen)),
          }}
          description={t('settings.keepThreadsDescription')}
          options={days.map((n) => ({ value: String(n), label: t('settings.days', { days: n }) }))}
          title={t('settings.keepThreads')}
        />
      ) : null}
      {improve ? (
        <SwitchRow
          description={t('settings.improveDescription')}
          title={t('settings.improve')}
          toggle={improve}
        />
      ) : null}
      {shared ? (
        <SettingsRow
          description={t('settings.sharedThreadsDescription')}
          title={t('settings.sharedThreads')}
        >
          {() =>
            shared.threads.length > 0 ? (
              <ul className="uib-settings-shared">
                {shared.threads.map((thread) => (
                  <li className="uib-settings-shared-thread" key={thread.id}>
                    <span className="uib-settings-row-text">
                      <span className="uib-settings-shared-title">{thread.title}</span>
                      {thread.detail ? (
                        <span className="uib-settings-row-description">{thread.detail}</span>
                      ) : null}
                    </span>
                    <Button
                      data-size="sm"
                      onClick={() => shared.onStopSharing(thread.id)}
                      variant="secondary"
                    >
                      {t('settings.stopSharing')}
                      <span className="ds-sr-only">: {thread.title}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null
          }
        </SettingsRow>
      ) : null}
      {given(download) ? (
        <SettingsRow
          description={t('settings.downloadDescription')}
          end
          title={t('settings.download')}
        >
          {() => (
            <ActionButton action={download}>
              <DownloadIcon aria-hidden />
              {t('settings.downloadAction')}
            </ActionButton>
          )}
        </SettingsRow>
      ) : null}
      {clearHistory ? (
        <SettingsRow
          description={t('settings.clearHistoryDescription')}
          end
          title={t('settings.clearHistory')}
        >
          {() => (
            <Button data-color="danger" onClick={clearHistory.onClear} variant="secondary">
              <TrashIcon aria-hidden />
              {t('settings.clearHistoryAction')}
            </Button>
          )}
        </SettingsRow>
      ) : null}
      {children}
    </SettingsPage>
  );
};
