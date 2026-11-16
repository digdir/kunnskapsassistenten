import { Card, Details, Link, List, Spinner } from '@digdir/designsystemet-react';
import { useFormat } from '@genai/i18n/react';
import { CheckmarkIcon, RobotIcon } from '@navikt/aksel-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from './i18n.js';
import { linesOf, type ApproachLine } from './runs.js';

export type ApproachStatus = 'done' | 'active' | 'waiting';

export interface ApproachDocument {
  title: string;
  /** Where in the document, for example the pages. */
  detail?: string;
}

export interface ApproachStep {
  id: string;
  /** As the platform sent it, or translated by the app. */
  title: string;
  description?: string;
  status: ApproachStatus;
  documents?: readonly ApproachDocument[];
  /** How many documents the step read in all, when more than are listed. */
  documentsRead?: number;
  /** How many excerpts the step read closely; the line then says so in place of the title. */
  excerptsRead?: number;
  /** The source numbers the answer used, as in its footnotes. */
  sourcesUsed?: readonly number[];
  /** The step says what the assistant did not find, and can link to more about it. */
  missing?: boolean;
  /** How long the step took, in milliseconds, when the platform said; drawn beside its title. */
  duration?: number;
}

export interface ApproachProps {
  /** In order. A run of steps with the same title one after another is drawn as one line. */
  steps: readonly ApproachStep[];
  /** True while the assistant works on the answer. */
  working: boolean;
  /** When the assistant started, in milliseconds since the epoch. */
  startedAt: number;
  finishedAt?: number;
  /** The host's clock, in milliseconds since the epoch, for the seconds while it works. */
  now?: () => number;
  /** Documents read in all, for the line at the bottom once the answer is done. */
  read?: number;
  /** Sources used in the answer. */
  used?: number;
  /** Open or shut, when the host keeps it. Without it the card is open while it works. */
  open?: boolean;
  /** The person opened or shut the card. */
  onOpenChange?: (open: boolean) => void;
  /** Shows the link to everything a step read. Where it leads is up to the app. */
  onShowRead?: (stepId: string) => void;
  /** Shows the link to more about what the assistant did not find. */
  onExplainMissing?: (stepId: string) => void;
  /**
   * `totals`: once the answer is done, how much was read and used stands beside the title, so the
   * folded card says it in one line, and the foot keeps only the time. The card is then the dev
   * boards' bar: tinted, its chevron at the end. Left out, the totals stand in the foot.
   */
  summary?: 'totals' | undefined;
  /** After the totals in the head, or over the list's scope, stronger: «filteret er endret». */
  note?: string | undefined;
  /** Before the steps, in the open card or the list, such as what the answer read from. */
  scope?: ReactNode;
  /**
   * `list`: the steps as the dev boards' «Fremgangsmåte» tool (dev-verktoy-1 to -3), with no card
   * and nothing that folds: «Slik jobbet assistenten med svaret», then each step with a mark, its
   * title and a line under it, its `description` or the excerpts it read. `card`, the default: the
   * card above the answer.
   */
  variant?: 'card' | 'list' | undefined;
}

const useSeconds = (
  startedAt: number,
  finishedAt: number | undefined,
  working: boolean,
  clock: () => number,
) => {
  const latest = useRef(clock);
  useEffect(() => {
    latest.current = clock;
  });
  const [now, setNow] = useState(clock);
  useEffect(() => {
    if (!working) return;
    setNow(latest.current());
    const timer = setInterval(() => setNow(latest.current()), 1000);
    return () => clearInterval(timer);
  }, [working]);
  return Math.max(0, Math.floor(((finishedAt ?? now) - startedAt) / 1000));
};

/** The card's own open state: open while it works, shut when the answer is done. */
const useOwnOpen = (working: boolean) => {
  const [open, setOpen] = useState(working);
  const wasWorking = useRef(working);
  useEffect(() => {
    if (wasWorking.current && !working) setOpen(false);
    wasWorking.current = working;
  }, [working]);
  return [open, setOpen] as const;
};

type T = ReturnType<typeof useT>;

/** How long a line took, «2,4 s», with the duration in ISO 8601 for the machine. */
const StepTime = ({ ms, lead = '' }: { ms: number; lead?: string }) => {
  const t = useT();
  const f = useFormat();
  const seconds = ms / 1000;
  const shown = seconds < 10 ? f.decimal(seconds, 1) : f.number(Math.round(seconds));
  return (
    <span className="uib-approach-step-time">
      {lead}
      <time dateTime={`PT${seconds.toFixed(1)}S`}>
        {ms < 50
          ? t('approach.stepTimeUnder', { seconds: f.decimal(0.1, 1) })
          : t('approach.stepTime', { seconds: shown })}
      </time>
    </span>
  );
};

/** A line's words: the excerpts a reading run read, or the title with how many times it ran. */
const titleOf = (line: ApproachLine, t: T) =>
  line.excerpts > 0
    ? t('approach.excerptsRead', { count: line.excerpts })
    : line.count > 1
      ? t('approach.repeated', { title: line.step.title, count: line.count })
      : line.step.title;

const StepBody = ({
  step,
  onShowRead: show,
  onExplainMissing: explain,
}: {
  step: ApproachStep;
  onShowRead: ApproachProps['onShowRead'];
  onExplainMissing: ApproachProps['onExplainMissing'];
}) => {
  const t = useT();
  const f = useFormat();
  const more = step.documentsRead ?? step.documents?.length ?? 0;
  return (
    <>
      {step.description ? (
        <p className="uib-approach-step-description">{step.description}</p>
      ) : null}
      {step.documents?.length ? (
        <List.Unordered className="uib-approach-step-documents">
          {step.documents.map((d, i) => (
            <List.Item key={`${d.title}-${i}`}>
              {d.detail ? t('approach.document', { title: d.title, detail: d.detail }) : d.title}
            </List.Item>
          ))}
        </List.Unordered>
      ) : null}
      {show && more ? (
        <Link
          href="#"
          className="uib-approach-step-link"
          onClick={(event) => {
            event.preventDefault();
            show(step.id);
          }}
        >
          {step.status === 'active'
            ? t('approach.showReadSoFar', { count: more })
            : t('approach.showRead', { count: more })}
        </Link>
      ) : null}
      {step.missing && explain ? (
        <Link
          href="#"
          className="uib-approach-step-link"
          onClick={(event) => {
            event.preventDefault();
            explain(step.id);
          }}
        >
          {t('approach.explainMissing')}
        </Link>
      ) : null}
      {step.sourcesUsed?.length ? (
        <p className="uib-approach-step-description">
          {t('approach.usedInAnswer', {
            sources: f.list(step.sourcesUsed.map(String)),
          })}
        </p>
      ) : null}
    </>
  );
};

/** How the assistant worked on an answer, as a card above it, open while it works. */
export const Approach = ({
  steps,
  working,
  startedAt,
  finishedAt,
  now = Date.now,
  read,
  used,
  open,
  onOpenChange,
  onShowRead,
  onExplainMissing,
  summary: summaryPlace,
  note,
  scope,
  variant = 'card',
}: ApproachProps) => {
  const t = useT();
  const [ownOpen, setOwnOpen] = useOwnOpen(working);
  const isOpen = open ?? ownOpen;
  const toggle = (next: boolean) => {
    if (open === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };

  const seconds = useSeconds(startedAt, finishedAt, working, now);
  const lines = linesOf(steps);
  const activeIndex = lines.findIndex((line) => line.step.status === 'active');
  const active = lines[activeIndex];
  const activeTitle = active ? titleOf(active, t) : undefined;
  const knowsTotal = lines.some((line) => line.step.status === 'waiting');
  const [announced, setAnnounced] = useState('');
  useEffect(() => {
    if (!activeTitle) return;
    const n = activeIndex + 1;
    setAnnounced(
      knowsTotal
        ? t('approach.stepOf', { n, total: lines.length, title: activeTitle })
        : t('approach.step', { n, title: activeTitle }),
    );
  }, [active?.key, activeTitle]);

  const readText = read === undefined ? undefined : t('approach.read', { count: read });
  const summary =
    readText === undefined
      ? used === undefined
        ? undefined
        : t('approach.usedOnly', { count: used })
      : used === undefined
        ? readText
        : t('approach.readAndUsed', {
            read: readText,
            used: t('approach.used', { count: used }),
          });
  // In the head once done, with the totals: the foot then says only how long it took.
  const inHead = summaryPlace === 'totals' && !working;
  const footer = working
    ? t('approach.workingFor', { count: seconds })
    : summary === undefined || inHead
      ? t('approach.tookOnly', { count: seconds })
      : t('approach.footer', { summary, took: t('approach.took', { count: seconds }) });
  const headSummary = inHead ? summary : undefined;
  const headNote = inHead ? note : undefined;
  const live = (
    <p className="uib-visually-hidden" aria-live="polite">
      {working ? announced : ''}
    </p>
  );

  if (variant === 'list')
    return (
      <div className="uib-approach" data-variant="list">
        <p className="uib-approach-caption">{t('approach.caption')}</p>
        {note ? <p className="uib-approach-note">{note}</p> : null}
        {scope ? <div className="uib-approach-scope">{scope}</div> : null}
        <ol className="uib-approach-list" aria-label={t('approach.title')}>
          {lines.map((line) => {
            const { step } = line;
            // The title stays the step's; what it read goes on the line under it.
            const detail =
              step.description ??
              (line.excerpts > 0
                ? t('approach.excerptsRead', { count: line.excerpts })
                : undefined);
            return (
              <li
                key={line.key}
                data-status={step.status}
                aria-current={step.status === 'active' ? 'step' : undefined}
              >
                <span className="uib-approach-mark" aria-hidden="true">
                  {step.status === 'done' ? (
                    <CheckmarkIcon />
                  ) : step.status === 'active' ? (
                    <Spinner aria-hidden="true" data-size="2xs" />
                  ) : null}
                </span>
                <span className="uib-approach-entry">
                  <span className="uib-approach-step-title">
                    {line.count > 1
                      ? t('approach.repeated', { title: step.title, count: line.count })
                      : step.title}
                    <span className="uib-visually-hidden">
                      {' '}
                      {t('approach.hiddenStatus', { status: t(`approach.${step.status}`) })}
                    </span>
                  </span>
                  {detail && step.status !== 'waiting' ? (
                    <span className="uib-approach-step-line">{detail}</span>
                  ) : null}
                </span>
                {line.duration !== undefined && step.status !== 'waiting' ? (
                  <StepTime ms={line.duration} />
                ) : null}
              </li>
            );
          })}
        </ol>
        {read !== undefined || used !== undefined ? (
          <p className="uib-approach-footer">{footer}</p>
        ) : null}
        {live}
      </div>
    );

  return (
    <div className="uib-approach" data-summary={summaryPlace}>
      <Card data-color="neutral" variant="default" className="uib-approach-card">
        <Details
          aria-label={t('approach.title')}
          open={isOpen}
          onToggle={(event) => toggle((event.target as HTMLDetailsElement).open)}
        >
          <Details.Summary>
            <span className="uib-approach-summary">
              <RobotIcon aria-hidden fontSize="18px" />
              <span className="uib-approach-title">{t('approach.title')}</span>
              {headSummary || headNote ? (
                <span className="uib-approach-subtitle">
                  {headSummary}
                  {headNote ? (
                    <span className="uib-approach-note">
                      {headSummary ? ` · ${headNote}` : headNote}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </span>
          </Details.Summary>
          <Details.Content className="uib-approach-content">
            {scope ? <div className="uib-approach-scope">{scope}</div> : null}
            <List.Ordered className="uib-approach-steps">
              {lines.map((line) => {
                const { step } = line;
                return (
                  <List.Item
                    key={line.key}
                    data-status={step.status}
                    aria-current={step.status === 'active' ? 'step' : undefined}
                  >
                    <span className="uib-approach-step-title">{titleOf(line, t)}</span>
                    {line.duration !== undefined && step.status !== 'waiting' ? (
                      <StepTime ms={line.duration} lead=" · " />
                    ) : null}
                    {step.status === 'done' ? (
                      <span className="uib-visually-hidden">
                        {' '}
                        {t('approach.hiddenStatus', { status: t('approach.done') })}
                      </span>
                    ) : (
                      <span className="uib-approach-step-status">
                        {' '}
                        {t('approach.shownStatus', { status: t(`approach.${step.status}`) })}
                      </span>
                    )}
                    {step.status === 'waiting' ? null : (
                      <StepBody
                        step={step}
                        onShowRead={onShowRead}
                        onExplainMissing={onExplainMissing}
                      />
                    )}
                  </List.Item>
                );
              })}
            </List.Ordered>
            <p className="uib-approach-footer">{footer}</p>
          </Details.Content>
        </Details>
      </Card>
      {live}
    </div>
  );
};
