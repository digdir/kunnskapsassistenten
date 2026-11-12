import { Fieldset, Link, Radio, Switch } from '@digdir/designsystemet-react';
import { ExternalLinkIcon } from '@navikt/aksel-icons';
import { useId } from 'react';
import { classes } from '../dom.js';
import { displayLevels, isDisplayLevel, type DisplayLevel } from './displayLevel.js';
import { useT } from './i18n.js';

export interface DisplayLevelChoiceProps {
  /** The level in use, as the host keeps it. Without it, «Standard» is chosen. */
  value?: DisplayLevel | undefined;
  /** The reader chose a level. The host stores it and passes it back. */
  onChange: (level: DisplayLevel) => void;
  className?: string | undefined;
}

/** «Standard» or «Detaljert», as radios with a line each; it shows the host's value. */
export const DisplayLevelChoice = ({ value, onChange, className }: DisplayLevelChoiceProps) => {
  const t = useT();
  const name = useId();
  const chosen = isDisplayLevel(value) ? value : 'standard';
  return (
    <Fieldset className={classes('uib-settings-display-level', className)}>
      <Fieldset.Legend>{t('settings.displayLevelQuestion')}</Fieldset.Legend>
      {displayLevels.map((level) => (
        <Radio
          checked={chosen === level}
          description={t(`settings.${level}Description`)}
          key={level}
          label={t(`settings.${level}`)}
          name={name}
          onChange={() => onChange(level)}
          value={level}
        />
      ))}
    </Fieldset>
  );
};

/** A trial the reader can turn on: meant to be removed once it is decided, unlike a setting. */
export interface SettingsExperiment {
  /** Stable, and never reused for another trial. */
  id: string;
  title: string;
  /** One line on what changes when it is on. */
  description?: string | undefined;
  on: boolean;
  /** Where the trial is discussed, such as its issue. Opens in a new tab. */
  href?: string | undefined;
  /** The link's text, such as «Sak 115». «Les mer» without it. */
  hrefLabel?: string | undefined;
}

export interface ExperimentSwitchesProps {
  experiments: readonly SettingsExperiment[];
  /** The reader turned a trial on or off. The host stores it and passes it back. */
  onChange: (id: string, on: boolean) => void;
  className?: string | undefined;
}

/** One switch per trial, with its line and a link, since a switch takes effect at once. */
export const ExperimentSwitches = ({
  experiments,
  onChange,
  className,
}: ExperimentSwitchesProps) => {
  const t = useT();
  return (
    <div className={classes('uib-settings-experiments', className)}>
      {experiments.map((experiment) => {
        const link = experiment.href ? (
          <Link href={experiment.href} rel="noreferrer" target="_blank">
            {experiment.hrefLabel ?? t('settings.readMore')}
            {/* The icon is aria-hidden, so the new tab is said in words too. */}
            <span className="ds-sr-only"> {t('settings.newTab')}</span>
            <ExternalLinkIcon aria-hidden />
          </Link>
        ) : null;
        return (
          <Switch
            checked={experiment.on}
            description={
              experiment.description || link ? (
                <>
                  {experiment.description}
                  {experiment.description && link ? ' ' : null}
                  {link}
                </>
              ) : undefined
            }
            key={experiment.id}
            label={experiment.title}
            onChange={(event) => onChange(experiment.id, event.currentTarget.checked)}
          />
        );
      })}
    </div>
  );
};
