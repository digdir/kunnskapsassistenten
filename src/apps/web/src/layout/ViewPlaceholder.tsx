import { Paragraph } from '@digdir/designsystemet-react';
import { PanelHeader } from '../components';
import { views, type SlotViewProps } from './viewModel';

/** Stands in for a view that has not been built yet. */
export function ViewPlaceholder({ view }: SlotViewProps) {
  return (
    <PanelHeader title={views[view].label}>
      <Paragraph data-size="sm">Denne visningen er ikke bygget ennå.</Paragraph>
    </PanelHeader>
  );
}
