import { Dialog, Heading, Link, Paragraph, Switch } from '@digdir/designsystemet-react';
import { ExternalLinkIcon } from '@navikt/aksel-icons';
import { useId } from 'react';
import { FLAGS, setFlag, useFlag } from './flags';
import './flags.css';

export type FeatureFlagsDialogProps = {
  /** Takes `#feature-flags` back out of the address. */
  onClose: () => void;
};

/**
 * The hidden menu for feature flags, opened by `#feature-flags`.
 *
 * Built like `SettingsDialog` on purpose, so the two hidden menus open, close
 * and look the same: a modal Designsystemet `Dialog`, mounted only while the
 * hash is there, and a choice that applies on the spot with nothing to save.
 *
 * A `Switch` per flag rather than radios: a flag is on or off, and turning it
 * on is meant to change the page at once, which is what Designsystemet says a
 * switch is for. The label names the trial, not the state.
 */
export function FeatureFlagsDialog({ onClose }: FeatureFlagsDialogProps) {
  const headingId = useId();

  return (
    <Dialog
      aria-labelledby={headingId}
      closeButton="Lukk"
      closedby="closerequest"
      data-size="sm"
      onClose={onClose}
      open
    >
      <Dialog.Block>
        <Heading data-size="xs" id={headingId} level={2}>
          Eksperimenter
        </Heading>
      </Dialog.Block>
      <Dialog.Block>
        <Paragraph data-size="sm" variant="long">
          Forsøk som ikke er bestemt ennå. Alle er av til du slår dem på.
        </Paragraph>
        <div className="ka-flags__list">
          {FLAGS.map((flag) => (
            <FlagSwitch flag={flag} key={flag.id} />
          ))}
        </div>
        <Paragraph className="ka-flags__note" data-size="sm" variant="long">
          Valgene huskes i denne nettleseren til du logger ut.
        </Paragraph>
      </Dialog.Block>
    </Dialog>
  );
}

function FlagSwitch({ flag }: { flag: (typeof FLAGS)[number] }) {
  const on = useFlag(flag.id);
  const issueNumber = flag.issue.split('/').at(-1);

  return (
    <Switch
      checked={on}
      description={
        <>
          {flag.description}{' '}
          <Link href={flag.issue} rel="noreferrer" target="_blank">
            Sak {issueNumber}
            {/* Leaving the app is said in words as well as with the icon, as
                on the source links (SourceExcerpt.tsx). */}
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
