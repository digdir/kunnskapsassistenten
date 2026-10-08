import { Dialog, Fieldset, Heading, Link, Paragraph, Radio } from '@digdir/designsystemet-react';
import { useId } from 'react';
import { kaEnv } from '../../api/runtimeConfig';
import { setFooterMode, type FooterMode } from '../../layout/footerMode';
import { setDisplayLevel, type DisplayLevel } from './displayLevel';

export type SettingsDialogProps = {
  /** The level on screen now. */
  level: DisplayLevel;
  /** Where the navigation panel's foot sits now. */
  footerMode: FooterMode;
  /** Takes `#innstillinger` back out of the address. */
  onClose: () => void;
};

const OPTIONS: { value: DisplayLevel; label: string; description: string }[] = [
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

/** Issue 123, which asks whether the panel's foot has to be pinned at
   all or whether the whole panel could be one container with nothing fixed.
   Both are here so the two can be compared on the same page. */
const FOOTER_OPTIONS: { value: FooterMode; label: string; description: string }[] = [
  {
    value: 'pinned',
    label: 'Festet',
    description: 'Lenkene og fargemodus står nederst i panelet, uansett hvor langt du har rullet.',
  },
  {
    value: 'scrolls',
    label: 'Ruller med',
    description: 'Alt ligger i én kolonne. Lenkene står etter den siste tråden og ruller med den.',
  },
];

/**
 * The hidden settings menu, **opened by `#innstillinger`** and not a query: a
 * hash never reaches the server, never changes the route and never travels in
 * a pasted link. Radios and not a switch, because a third level is coming.
 */
export function SettingsDialog({ level, footerMode, onClose }: SettingsDialogProps) {
  const headingId = useId();
  const groupName = useId();
  const footerGroupName = useId();

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
          Innstillinger
        </Heading>
      </Dialog.Block>
      <Dialog.Block>
        <Fieldset>
          <Fieldset.Legend>Hvor mye skal svaret vise om hvordan det ble til?</Fieldset.Legend>
          {OPTIONS.map((option) => (
            <Radio
              checked={level === option.value}
              description={option.description}
              key={option.value}
              label={option.label}
              name={groupName}
              onChange={() => setDisplayLevel(option.value)}
              value={option.value}
            />
          ))}
        </Fieldset>
        <Fieldset className="ka-settings__group">
          <Fieldset.Legend>Foten i navigasjonspanelet</Fieldset.Legend>
          {FOOTER_OPTIONS.map((option) => (
            <Radio
              checked={footerMode === option.value}
              description={option.description}
              key={option.value}
              label={option.label}
              name={footerGroupName}
              onChange={() => setFooterMode(option.value)}
              value={option.value}
            />
          ))}
        </Fieldset>
        <Paragraph className="ka-settings__note" data-size="sm" variant="long">
          Valgene huskes i denne nettleseren.
        </Paragraph>
        {/* The BFF serves the previous client too and switches by a cookie
            `?klient=gammel` sets. A full navigation, so the BFF sees it, and
            only behind the BFF, which is the one that can answer it. */}
        {kaEnv().VITE_API_MODE === 'bff' && (
          <Paragraph data-size="sm">
            <Link href="/?klient=gammel">Bytt til forrige klient</Link>
          </Paragraph>
        )}
      </Dialog.Block>
    </Dialog>
  );
}
