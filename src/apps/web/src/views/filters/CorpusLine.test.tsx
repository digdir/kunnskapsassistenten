import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CorpusOption } from '../../api';
import type { FilterFacet } from '../../model';
import { CorpusLine } from './CorpusLine';

const kudos: CorpusOption = { key: 'mock', label: 'Kudos, 938 dokumenter (mock)' };

const facets: FilterFacet[] = [
  {
    dimension: 'documentType',
    label: 'Dokumenttyper',
    values: [
      { value: 'arsrapport', label: 'Årsrapport', count: 900 },
      { value: 'evaluering', label: 'Evaluering', count: 38 },
    ],
  },
  {
    dimension: 'year',
    label: 'År',
    values: [
      { value: '2020', label: '2020' },
      { value: '2027', label: '2027' },
    ],
  },
];

const detail = '938 dokumenter, årsrapporter og evalueringer, 2020–2027';

describe('korpuslinja', () => {
  it('viser navnet, og holder resten lukket', () => {
    // Hele setningen brøt til to linjer i et 327 px panel og tok 63 px av et
    // filterhode på 179 (målt på 1440). N2 i høydebudsjettet.
    render(<CorpusLine facets={facets} corpus={kudos} />);

    expect(screen.getByText('Dokumenter fra Kudos')).toBeTruthy();
    expect(screen.getByText(detail).hasAttribute('hidden')).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Vis mer om korpuset' }).getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('åpner og lukker resten', () => {
    render(<CorpusLine facets={facets} corpus={kudos} />);

    fireEvent.click(screen.getByRole('button', { name: 'Vis mer om korpuset' }));

    expect(screen.getByText(detail).hasAttribute('hidden')).toBe(false);
    const open = screen.getByRole('button', { name: 'Vis mindre om korpuset' });
    expect(open.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(open);
    expect(screen.getByText(detail).hasAttribute('hidden')).toBe(true);
  });

  it('peker knappen på teksten den åpner', () => {
    // `aria-controls` er det som gjør at en skjermleser kan følge pekeren til
    // det som åpnet seg, og derfor står teksten i dokumentet hele tida.
    render(<CorpusLine facets={facets} corpus={kudos} />);

    const button = screen.getByRole('button', { name: 'Vis mer om korpuset' });
    const controlled = document.getElementById(button.getAttribute('aria-controls') ?? '');

    expect(controlled?.textContent).toBe(detail);
  });

  it('tegner ingen knapp når det ikke er noe mer å vise', () => {
    // Et korpus uten beskrivelse og uten fasetter: linja er hele sannheten,
    // og en «Vis mer» som åpner ingenting er verre enn ingen knapp.
    render(<CorpusLine corpus={{ key: 'kudos-pilot', label: 'Kudos-pilot' }} />);

    expect(screen.getByText('Dokumenter fra Kudos-pilot')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Vis mer om korpuset' })).toBeNull();
  });
  it('sier i det tilgjengelige navnet hva det er mer om', () => {
    // Den som lister knappene med skjermleser hører dem uten linja som står
    // ved siden av på skjermen (KA CC på #114).
    render(<CorpusLine facets={facets} corpus={kudos} />);

    const button = screen.getByRole('button', { name: 'Vis mer om korpuset' });
    expect(button.textContent).toBe('Vis mer');

    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Vis mindre om korpuset' }).textContent).toBe(
      'Vis mindre',
    );
  });
});
