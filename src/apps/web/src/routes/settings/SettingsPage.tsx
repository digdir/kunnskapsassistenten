import { Fieldset, Heading, Link, Paragraph, Radio, Switch } from '@digdir/designsystemet-react';
import { ExternalLinkIcon } from '@navikt/aksel-icons';
import { useEffect, useId, useState } from 'react';
import { fetchOfferedTrials } from '../../api/trials';
import { PageTitle } from '../../components';
import { FLAGS, setFlag, useFlag, type FlagId } from '../../flags';
import { ColorSchemeToggle } from '../../layout/ColorSchemeToggle';
import { setFooterMode, useFooterMode, type FooterMode } from '../../layout/footerMode';
import { setDisplayLevel, useDisplayLevel, type DisplayLevel } from '../../views/chat/displayLevel';
import './settings.css';

/** Route and footer link target, without a leading slash — see App.tsx. */
export const SETTINGS_PATH = 'innstillinger';

export const SETTINGS_TITLE = 'Innstillinger';

const LEVEL_OPTIONS: { value: DisplayLevel; label: string; description: string }[] = [
  {
    value: 'standard',
    label: 'Standard',
    description:
      'Fremgangsmåte over svaret, med stegene assistenten gikk gjennom og søkeordene den brukte.',
  },
  {
    value: 'detaljert',
    label: 'Detaljert',
    description:
      'Alt det tekniske i tillegg: søkestrengene for hvert steg, antall treff og tiden det tok.',
  },
];

/** Issue 123: is the panel's foot pinned, or does the whole panel scroll as one? Not a reader's
    choice, so only in the dev server, where the two can be compared on the same page. */
const FOOTER_OPTIONS: { value: FooterMode; label: string; description: string }[] = [
  {
    value: 'pinned',
    label: 'Festet',
    description: 'Lenkene står nederst i panelet, uansett hvor langt du har rullet.',
  },
  {
    value: 'scrolls',
    label: 'Ruller med',
    description: 'Alt ligger i én kolonne. Lenkene står etter den siste tråden og ruller med den.',
  },
];

/**
 * The reader's choices, on a page of their own in the main column, linked from the panel's foot
 * like the information pages. It replaces the hidden `#innstillinger` and `#feature-flags`
 * dialogs; old links land here (`useSettingsLinks`). Every choice takes effect at once and is
 * stored in this browser, so there is no «Lagre».
 */
export function SettingsPage() {
  const levelName = useId();
  const footerName = useId();
  const level = useDisplayLevel();
  const footerMode = useFooterMode();
  const offered = useOfferedTrials();
  const flags = FLAGS.filter((flag) => !('needsServer' in flag) || offered.includes(flag.id));

  return (
    <article className="settings-page">
      <PageTitle name={SETTINGS_TITLE} />
      <Heading level={1} data-size="lg">
        {SETTINGS_TITLE}
      </Heading>

      {/* The toggle names itself «Fargemodus» to a screen reader; the heading says it to the eye. */}
      <section className="settings-page__section" aria-labelledby={`${levelName}-scheme`}>
        <Heading level={2} data-size="sm" id={`${levelName}-scheme`}>
          Fargemodus
        </Heading>
        <ColorSchemeToggle />
      </section>

      <section className="settings-page__section" aria-labelledby={`${levelName}-answers`}>
        <Heading level={2} data-size="sm" id={`${levelName}-answers`}>
          Svar
        </Heading>
        <Fieldset>
          <Fieldset.Legend>Hvor mye skal svaret vise om hvordan det ble til?</Fieldset.Legend>
          {LEVEL_OPTIONS.map((option) => (
            <Radio
              checked={level === option.value}
              description={option.description}
              key={option.value}
              label={option.label}
              name={levelName}
              onChange={() => setDisplayLevel(option.value)}
              value={option.value}
            />
          ))}
        </Fieldset>
      </section>

      <section className="settings-page__section" aria-labelledby={`${levelName}-flags`}>
        <Heading level={2} data-size="sm" id={`${levelName}-flags`}>
          Eksperimenter
        </Heading>
        <Paragraph data-size="sm" variant="long">
          Forsøk som ikke er bestemt ennå. Alle er av til du slår dem på.
        </Paragraph>
        <div className="settings-page__flags">
          {flags.map((flag) => (
            <FlagSwitch flag={flag} key={flag.id} />
          ))}
        </div>
      </section>

      {import.meta.env.DEV && (
        <section className="settings-page__section" aria-labelledby={`${levelName}-dev`}>
          <Heading level={2} data-size="sm" id={`${levelName}-dev`}>
            Utvikling
          </Heading>
          <Fieldset>
            <Fieldset.Legend>Foten i navigasjonspanelet. Vises bare lokalt.</Fieldset.Legend>
            {FOOTER_OPTIONS.map((option) => (
              <Radio
                checked={footerMode === option.value}
                description={option.description}
                key={option.value}
                label={option.label}
                name={footerName}
                onChange={() => setFooterMode(option.value)}
                value={option.value}
              />
            ))}
          </Fieldset>
        </section>
      )}

      <Paragraph className="settings-page__note" data-size="sm" variant="long">
        Valgene huskes i denne nettleseren. Eksperimentene slås av når du logger ut.
      </Paragraph>
    </article>
  );
}

/** The flags the BFF offers (`needsServer`), asked once when the page opens. */
function useOfferedTrials(): readonly FlagId[] {
  const [offered, setOffered] = useState<readonly FlagId[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    void fetchOfferedTrials(abort.signal).then((found) => {
      if (!abort.signal.aborted) setOffered(found);
    });
    return () => abort.abort();
  }, []);
  return offered;
}

function FlagSwitch({ flag }: { flag: (typeof FLAGS)[number] }) {
  const on = useFlag(flag.id);
  const issueNumber = flag.issue.split('/').at(-1);

  // A switch: it takes effect at once, which is what Designsystemet says a switch is for.
  return (
    <Switch
      checked={on}
      description={
        <>
          {flag.description}{' '}
          <Link href={flag.issue} rel="noreferrer" target="_blank">
            Sak {issueNumber}
            {/* The icon is aria-hidden, so the new tab is said in words too. */}
            <span className="ds-sr-only"> (åpnes i ny fane)</span>
            <ExternalLinkIcon aria-hidden />
          </Link>
        </>
      }
      label={flag.title}
      onChange={(event) => setFlag(flag.id, event.currentTarget.checked)}
    />
  );
}
