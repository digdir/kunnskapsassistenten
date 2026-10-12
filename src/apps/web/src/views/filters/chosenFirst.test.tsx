import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetFlags } from '../../flags/flags';
import type { FilterFacet } from '../../model';
import { FacetField } from './FacetField';

const facet: FilterFacet = {
  dimension: 'documentType',
  label: 'Dokumenttyper',
  values: ['Årsrapport', 'Tildelingsbrev', 'Evaluering', 'Instruks'].map((label) => ({
    value: label.toLocaleLowerCase('nb-NO'),
    label,
    count: 1,
  })),
};

function Harness({ initial = [] as string[] }) {
  const [selected, setSelected] = useState(initial);
  return <FacetField facet={facet} selected={selected} onChange={setSelected} />;
}

function input(): HTMLInputElement {
  return screen.getByRole('combobox') as HTMLInputElement;
}

/** The options in the order the list holds them, leaving out those the text filters away. */
function order(): string[] {
  return [...document.querySelectorAll('u-datalist u-option:not([data-empty])')]
    .filter((option) => !option.hasAttribute('disabled'))
    .map((option) => option.getAttribute('label') ?? '');
}

/* u-datalist opens on a click in the field and shuts on Escape, with `hidden`; the field sees
   it in a MutationObserver, hence the async act. */
async function open() {
  fireEvent.click(input());
  await act(async () => {});
  expect(document.querySelector('u-datalist')?.hasAttribute('hidden')).toBe(false);
}

async function shut() {
  fireEvent.keyDown(input(), { key: 'Escape' });
  await act(async () => {});
  expect(document.querySelector('u-datalist')?.hasAttribute('hidden')).toBe(true);
}

/** A choice in the list, as u-datalist sends it (yearRangesAndCompactChips.test.tsx). */
function choose(label: string) {
  const value = label.toLocaleLowerCase('nb-NO');
  act(() => {
    input().value = value;
    input().dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: value }),
    );
  });
}

function type(text: string) {
  act(() => {
    input().value = text;
    input().dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
    );
  });
}

beforeEach(() => {
  localStorage.clear();
  resetFlags();
});

describe('valgte verdier øverst i lista', () => {
  it('setter det som er valgt, først, i samme rekkefølge som ellers', () => {
    render(<Harness initial={['instruks', 'tildelingsbrev']} />);

    expect(order()).toEqual(['Tildelingsbrev', 'Instruks', 'Årsrapport', 'Evaluering']);
  });

  it('flytter ingenting mens lista er åpen, og flytter når den lukkes', async () => {
    render(<Harness />);

    await open();
    choose('Evaluering');
    expect(order()).toEqual(['Årsrapport', 'Tildelingsbrev', 'Evaluering', 'Instruks']);

    await shut();
    expect(order()).toEqual(['Evaluering', 'Årsrapport', 'Tildelingsbrev', 'Instruks']);

    // Taken off with the list open: it stays first until the list shuts.
    await open();
    choose('Evaluering');
    expect(order()).toEqual(['Evaluering', 'Årsrapport', 'Tildelingsbrev', 'Instruks']);

    await shut();
    expect(order()).toEqual(['Årsrapport', 'Tildelingsbrev', 'Evaluering', 'Instruks']);
  });

  it('viser «Tøm» og «Velg alle» med lista lukket ved neste åpning', async () => {
    render(<Harness initial={['instruks']} />);
    expect(order()).toEqual(['Instruks', 'Årsrapport', 'Tildelingsbrev', 'Evaluering']);

    fireEvent.click(screen.getByRole('button', { name: 'Tøm dokumenttyper' }));
    await open();
    expect(order()).toEqual(['Årsrapport', 'Tildelingsbrev', 'Evaluering', 'Instruks']);
  });

  it('setter de valgte treffene først også når noe er skrevet', async () => {
    render(<Harness initial={['instruks']} />);

    await open();
    type('s');

    expect(order()).toEqual(['Instruks', 'Årsrapport', 'Tildelingsbrev']);
  });
});
