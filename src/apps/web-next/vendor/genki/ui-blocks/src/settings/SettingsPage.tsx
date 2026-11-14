import { Alert, Heading, Paragraph, Switch, ToggleGroup } from '@digdir/designsystemet-react';
import { useId, type ReactNode } from 'react';
import { classes } from '../dom.js';
import { useT } from './i18n.js';

type HeadingLevel = 1 | 2 | 3 | 4 | 5;

/** A choice the host can honour: what is chosen, and how the reader changes it. One without the other is not drawn. */
export interface SettingsChoice<V> {
  /** As the host keeps it. Nothing is marked without it. */
  value: V | undefined;
  onChange: (value: V) => void;
}

/** Something the host can turn on and off. */
export interface SettingsToggle {
  on: boolean;
  onChange: (on: boolean) => void;
}

export interface SettingsPageProps {
  /** The page's heading, «Generelt». */
  title: ReactNode;
  /** One line under it, on what the page holds. */
  lead?: ReactNode;
  /** The box under the line, its first words bold: «Gjelder hele tjenesten.» and the rest. */
  notice?: { title: ReactNode; text: ReactNode } | undefined;
  /** The heading's level, the page's `h1` by default. */
  headingLevel?: HeadingLevel | undefined;
  /** Nothing to choose: says so, in place of the rows. */
  empty?: boolean | undefined;
  /** The page's rows. */
  children?: ReactNode;
  /** The host's quiet line under the rows, as `Settings`' `note`; not on an empty page. */
  note?: ReactNode;
  /** Designsystemet's `data-color` for the page, set only when given. */
  color?: string | undefined;
  className?: string | undefined;
}

const colored = (color: string | undefined) => (color ? { 'data-color': color } : {});

/**
 * One settings page, as the dev-innstillinger boards draw each: the heading, a line on what it
 * holds, an info box, then the rows, each under a thin line, in a column as wide as the boards'.
 */
export const SettingsPage = ({
  title,
  lead,
  notice,
  headingLevel = 1,
  empty = false,
  children,
  note,
  color,
  className,
}: SettingsPageProps) => {
  const t = useT();
  const id = useId();
  return (
    <article
      aria-labelledby={id}
      className={classes('uib-settings-page', className)}
      {...colored(color)}
    >
      <div className="uib-settings-page-head">
        <Heading className="uib-settings-page-title" data-size="md" id={id} level={headingLevel}>
          {title}
        </Heading>
        {lead ? (
          <Paragraph className="uib-settings-page-lead" data-size="sm">
            {lead}
          </Paragraph>
        ) : null}
        {notice ? (
          <Alert className="uib-settings-page-notice" data-color="info" data-size="sm">
            <Paragraph>
              <strong>{notice.title}</strong> {notice.text}
            </Paragraph>
          </Alert>
        ) : null}
      </div>
      {empty ? (
        <Paragraph className="uib-settings-note" data-size="sm">
          {t('settings.nothingYet')}
        </Paragraph>
      ) : (
        <>
          {children}
          {note ? (
            <Paragraph className="uib-settings-note" data-size="sm" variant="long">
              {note}
            </Paragraph>
          ) : null}
        </>
      )}
    </article>
  );
};

export interface SettingsRowProps {
  /** The row's name, which also names its control. */
  title: ReactNode;
  /** A line under the name. */
  description?: ReactNode;
  /** The control, under the words, or at the row's end with `end`. Handed the words' ids. */
  children: (ids: { title: string; description: string | undefined }) => ReactNode;
  /** The control at the row's end, beside the words, as a button is drawn. */
  end?: boolean | undefined;
  className?: string | undefined;
}

/** One row of a settings page under a thin line: the words, and the control they name. */
export const SettingsRow = ({ title, description, children, end, className }: SettingsRowProps) => {
  const id = useId();
  const ids = { title: `${id}-title`, description: description ? `${id}-description` : undefined };
  return (
    <div className={classes('uib-settings-row', className)} data-end={end || undefined}>
      <div className="uib-settings-row-text">
        <span className="uib-settings-row-title" id={ids.title}>
          {title}
        </span>
        {description ? (
          <span className="uib-settings-row-description" id={ids.description}>
            {description}
          </span>
        ) : null}
      </div>
      {children(ids)}
    </div>
  );
};

/** A row whose control is a group of joined buttons, one chosen (the boards' «Svarlengde»). */
export const ChoiceRow = <V extends string>({
  title,
  description,
  options,
  choice,
}: {
  title: ReactNode;
  description?: ReactNode;
  options: readonly { value: V; label: string }[];
  choice: SettingsChoice<V>;
}) => (
  <SettingsRow description={description} title={title}>
    {(ids) => (
      <ToggleGroup
        aria-labelledby={ids.title}
        {...(ids.description ? { 'aria-describedby': ids.description } : {})}
        className="uib-settings-choice"
        onChange={(chosen) => {
          const option = options.find((one) => one.value === chosen);
          if (option) choice.onChange(option.value);
        }}
        value={choice.value ?? ''}
        variant="secondary"
      >
        {options.map((option) => (
          <ToggleGroup.Item key={option.value} value={option.value}>
            {option.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup>
    )}
  </SettingsRow>
);

/** A row that is a switch, its words before it and the switch at the end (the boards' rows). */
export const SwitchRow = ({
  title,
  description,
  toggle,
}: {
  title: ReactNode;
  description?: ReactNode;
  toggle: SettingsToggle;
}) => (
  <div className="uib-settings-row uib-settings-switch-row">
    <Switch
      checked={toggle.on}
      description={description}
      label={title}
      onChange={(event) => toggle.onChange(event.currentTarget.checked)}
      position="end"
    />
  </div>
);
