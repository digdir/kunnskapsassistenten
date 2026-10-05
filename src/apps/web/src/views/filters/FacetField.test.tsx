import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { FilterFacet } from '../../model';
import { FacetField } from './FacetField';

const facet: FilterFacet = {
  dimension: 'documentType',
  label: 'Dokumenttype',
  values: [
    { value: 'arsrapport', label: 'Årsrapport', count: 3 },
    { value: 'tildelingsbrev', label: 'Tildelingsbrev', count: 2 },
  ],
};

/** The selection lives above the field, as it does in the view. */
function Harness({ partial = false }: { partial?: boolean }) {
  const [selected, setSelected] = useState<string[]>(partial ? ['arsrapport'] : []);
  return <FacetField facet={facet} selected={selected} onChange={setSelected} />;
}

describe('FacetField', () => {
  it('skiller de tre tilstandene i beskrivelsen', () => {
    // «Alle valgt» used to stand both on an untouched field and after the
    // user had picked every value, so the reader could not tell whether a
    // filter was set at all (brukerblikk, funn 3).
    render(<Harness />);

    expect(screen.getByText('Ingen avgrensning')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Velg alle dokumenttype' }));
    expect(screen.getByText('Alle 2 valgt, altså ingen avgrensning')).toBeTruthy();
    expect(screen.queryByText('Ingen avgrensning')).toBeNull();
  });

  describe('over the limit of 100 values per field', () => {
    const many: FilterFacet = {
      dimension: 'organisation',
      label: 'Virksomheter',
      values: Array.from({ length: 150 }, (_, index) => ({
        value: `Virksomhet ${index + 1}`,
        label: `Virksomhet ${index + 1}`,
      })),
    };
    const first = (count: number) => many.values.slice(0, count).map((value) => value.value);
    const warning = /^Høyst 100 kan brukes i ett felt/;

    it('says so, with the way out, when more than 100 are chosen', () => {
      render(<FacetField facet={many} selected={first(101)} onChange={() => {}} />);

      expect(
        screen.getByText(
          'Høyst 100 kan brukes i ett felt, og 101 er valgt. Fjern noen, eller velg alle.',
        ),
      ).toBeTruthy();
    });

    it('says nothing at 100', () => {
      render(<FacetField facet={many} selected={first(100)} onChange={() => {}} />);

      expect(screen.queryByText(warning)).toBeNull();
    });

    it('says nothing when all are chosen, which is no narrowing and is not sent', () => {
      render(<FacetField facet={many} selected={first(150)} onChange={() => {}} />);

      expect(screen.queryByText(warning)).toBeNull();
      expect(screen.getByText('Alle 150 valgt, altså ingen avgrensning')).toBeTruthy();
    });
  });

  it('teller opp et delvis utvalg', () => {
    render(<Harness partial />);

    expect(screen.getByText('1 av 2 valgt')).toBeTruthy();
    // Both actions are still on offer: one value is chosen, so there is both
    // something to add and something to clear.
    expect(screen.getByRole('button', { name: 'Velg alle dokumenttype' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tøm dokumenttype' })).toBeTruthy();
  });

  it('navngir søkefeltet etter dimensjonen', () => {
    // Three fields with the bare placeholder «Søk» read as one repeated
    // control (brukerblikk, funn 16).
    render(<Harness />);

    expect(screen.getByPlaceholderText('Søk i dokumenttype')).toBeTruthy();
  });

  it('sier hvilken dimensjon en chip fjernes fra', () => {
    /*
     * u-combobox names a chip `label`, then `data-sr-remove`: «Årsrapport,
     * Trykk for å fjerne fra dokumenttype». Three fields hold chips, and the
     * bare «Trykk for å fjerne» said the same four words in all three.
     */
    const { container } = render(<Harness partial />);

    expect(container.querySelector('ds-suggestion')?.getAttribute('data-sr-remove')).toBe(
      'Trykk for å fjerne fra dokumenttype',
    );
  });

  it('keeps focus in the field when «Velg alle» removes itself', () => {
    render(<Harness />);

    const input = screen.getByRole('combobox');
    fireEvent.click(screen.getByRole('button', { name: 'Velg alle dokumenttype' }));

    // The button is conditional on the state it changes, so it is gone now.
    // Without an explicit move, focus would be on <body>.
    expect(screen.queryByRole('button', { name: 'Velg alle dokumenttype' })).toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('keeps focus in the field when «Tøm» removes itself', () => {
    render(<Harness />);

    const input = screen.getByRole('combobox');
    fireEvent.click(screen.getByRole('button', { name: 'Velg alle dokumenttype' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tøm dokumenttype' }));

    expect(screen.queryByRole('button', { name: 'Tøm dokumenttype' })).toBeNull();
    expect(document.activeElement).toBe(input);
  });
});
