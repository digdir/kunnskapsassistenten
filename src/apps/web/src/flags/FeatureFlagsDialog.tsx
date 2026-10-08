import { Dialog, Heading, Link, Paragraph, Switch } from '@digdir/designsystemet-react';
import { ExternalLinkIcon } from '@navikt/aksel-icons';
import { useId } from 'react';
import { FLAGS, setFlag, useFlag } from './flags';
import './flags.css';

export type FeatureFlagsDialogProps = {
  /** Takes `#feature-flags` back out of the address. */
  onClose: () => void;
};

/** The hidden flags menu, opened by `#feature-flags`; built like `SettingsDialog`. */
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
