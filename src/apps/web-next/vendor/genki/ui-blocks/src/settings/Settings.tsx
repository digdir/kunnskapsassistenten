import { Heading, Paragraph, ToggleGroup } from '@digdir/designsystemet-react';
import { MonitorIcon, MoonIcon, SunIcon } from '@navikt/aksel-icons';
import { createContext, useContext, useId, type ReactNode } from 'react';
import { classes } from '../dom.js';
import { DisplayLevelChoice, ExperimentSwitches, type SettingsExperiment } from './Choices.js';
import { isColorScheme, type ColorScheme } from './colorScheme.js';
import type { DisplayLevel } from './displayLevel.js';
import { useT } from './i18n.js';

type HeadingLevel = 1 | 2 | 3 | 4 | 5;

export interface ColorSchemeToggleProps {
  /** The scheme in use, as the host keeps it. Without it, «Auto» is chosen. */
  value?: ColorScheme | undefined;
  /** The reader chose a scheme. The host stores it and sets `data-color-scheme` on its root. */
  onChange: (scheme: ColorScheme) => void;
  /**
   * `compact`, the default: «Lys», «Mørk» and «Auto», each with its icon, small. `full`: «Lyst»,
   * «Mørkt» and «Følg systemet» in words alone, at the text's size, as the settings pages draw it
   * (the dev-innstillinger-1 board).
   */
  look?: 'compact' | 'full' | undefined;
  /** The `id` of a visible name, such as its row's title; «Fargemodus» names it without one. */
  labelledBy?: string | undefined;
  className?: string | undefined;
}

export interface SettingsProps {
  /** The reader's colour scheme, as the host keeps it. Without it, «Auto» is chosen. */
  colorScheme?: ColorScheme | undefined;
  /** The reader chose a colour scheme. The host stores it and sets `data-color-scheme`. */
  onColorSchemeChange: (scheme: ColorScheme) => void;
  /** How much an answer shows of how it was made, as the host keeps it. «Standard» without it. */
  displayLevel?: DisplayLevel | undefined;
  /** The reader chose a level. Without it there is no «Svar» section. */
  onDisplayLevelChange?: ((level: DisplayLevel) => void) | undefined;
  /** The trials the reader may turn on, each with whether it is on. */
  experiments?: readonly SettingsExperiment[] | undefined;
  /** The reader turned a trial on or off. Without it, or without trials, there is no section. */
  onExperimentChange?: ((id: string, on: boolean) => void) | undefined;
  /** The level of «Innstillinger». Each section's heading is one below. */
  headingLevel?: HeadingLevel | undefined;
  /** The host's own sections, after the block's, each a `SettingsSection`. */
  children?: ReactNode;
  /** A quiet line after every section, such as where the choices are kept. */
  note?: ReactNode;
  /** Designsystemet's `data-color` for the block, set only when given. */
  color?: string | undefined;
  className?: string | undefined;
}

export interface SettingsSectionProps {
  /** The section's heading, which also names it. */
  title: ReactNode;
  children?: ReactNode;
  className?: string | undefined;
}

const choices = [
  { value: 'light', Icon: SunIcon },
  { value: 'dark', Icon: MoonIcon },
  { value: 'auto', Icon: MonitorIcon },
] as const;

const colored = (color: string | undefined) => (color ? { 'data-color': color } : {});

/** The level of a section's heading, one below the block's. */
const SectionLevel = createContext<HeadingLevel | 6>(3);

/** Light, dark or the system's, as a `ToggleGroup` with words; it shows the host's value. */
export const ColorSchemeToggle = ({
  value,
  onChange,
  look = 'compact',
  labelledBy,
  className,
}: ColorSchemeToggleProps) => {
  const t = useT();
  const full = look === 'full';
  return (
    <ToggleGroup
      {...(labelledBy
        ? { 'aria-labelledby': labelledBy }
        : { 'aria-label': t('settings.colorScheme') })}
      className={classes('uib-settings-color-scheme', className)}
      // The page's look takes the text's size, as the settings pages' other choices do.
      {...(full ? {} : { 'data-size': 'sm' })}
      onChange={(chosen) => {
        if (isColorScheme(chosen)) onChange(chosen);
      }}
      value={isColorScheme(value) ? value : 'auto'}
      variant="secondary"
    >
      {choices.map(({ value: scheme, Icon }) => (
        <ToggleGroup.Item key={scheme} value={scheme}>
          {full ? null : <Icon aria-hidden />}
          {t(full ? `settings.${scheme}Full` : `settings.${scheme}`)}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup>
  );
};

/** A section of «Innstillinger» with its heading, for the host's own choices. */
export const SettingsSection = ({ title, children, className }: SettingsSectionProps) => {
  const level = useContext(SectionLevel);
  const id = useId();
  return (
    <section className={classes('uib-settings-section', className)} aria-labelledby={id}>
      <Heading className="uib-settings-section-title" data-size="sm" id={id} level={level}>
        {title}
      </Heading>
      {children}
    </section>
  );
};

/** «Innstillinger»: the reader's choices, each taking effect at once, stored by the host. */
export const Settings = ({
  colorScheme,
  onColorSchemeChange,
  displayLevel,
  onDisplayLevelChange,
  experiments = [],
  onExperimentChange,
  headingLevel = 2,
  children,
  note,
  color,
  className,
}: SettingsProps) => {
  const t = useT();
  return (
    <SectionLevel.Provider value={(headingLevel + 1) as HeadingLevel | 6}>
      <article className={classes('uib-settings', className)} {...colored(color)}>
        <Heading className="uib-settings-title" data-size="lg" level={headingLevel}>
          {t('settings.title')}
        </Heading>
        {/* First, the page's main choice; the toggle names itself «Fargemodus». */}
        <SettingsSection title={t('settings.colorScheme')}>
          <ColorSchemeToggle onChange={onColorSchemeChange} value={colorScheme} />
        </SettingsSection>
        {onDisplayLevelChange ? (
          <SettingsSection title={t('settings.answers')}>
            <DisplayLevelChoice onChange={onDisplayLevelChange} value={displayLevel} />
          </SettingsSection>
        ) : null}
        {onExperimentChange && experiments.length > 0 ? (
          <SettingsSection title={t('settings.experiments')}>
            <Paragraph data-size="sm" variant="long">
              {t('settings.experimentsIntro')}
            </Paragraph>
            <ExperimentSwitches experiments={experiments} onChange={onExperimentChange} />
          </SettingsSection>
        ) : null}
        {children}
        {note ? (
          <Paragraph className="uib-settings-note" data-size="sm" variant="long">
            {note}
          </Paragraph>
        ) : null}
      </article>
    </SectionLevel.Provider>
  );
};
