import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FilterFacet } from '../../model';
import { FacetField } from './FacetField';

/*
 * jsdom has no layout, so the field's box and the window's height are set here. The browser
 * part, that Designsystemet then keeps the list where it stands, is measured in e2e.
 */

const facet: FilterFacet = {
  dimension: 'organisation',
  label: 'Virksomheter',
  values: ['A', 'B', 'C'].map((label) => ({ value: label, label, count: 1 })),
};

function Harness() {
  const [selected, setSelected] = useState<string[]>([]);
  return <FacetField facet={facet} selected={selected} onChange={setSelected} />;
}

function input(): HTMLInputElement {
  return screen.getByRole('combobox') as HTMLInputElement;
}

function list(): HTMLElement {
  return document.querySelector('u-datalist') as HTMLElement;
}

/* u-datalist opens on a click in the field. ds-suggestion places the list on the popover's
   `toggle`, which comes as a task of its own, so this waits for it. */
async function open() {
  fireEvent.click(input());
  await act(() => new Promise((resolve) => setTimeout(resolve)));
}

function choose(value: string) {
  act(() => {
    input().value = value;
    input().dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: value }),
    );
  });
}

/** The field from `top` to `bottom` in a window 800 high, and the placements asked for. */
function layout(top: number, bottom: number) {
  vi.spyOn(input(), 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 0, y: top, width: 300, height: bottom - top }),
  );
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(800);
  const placed: unknown[] = [];
  list().addEventListener('ds-toggle-source', (event) =>
    placed.push((event as CustomEvent).detail),
  );
  return placed;
}

afterEach(() => vi.restoreAllMocks());

describe('lista følger feltet når det flytter seg', () => {
  it('passer høyden til plassen under feltet og plasserer lista på nytt etter et valg', async () => {
    render(<Harness />);
    await open();
    const placed = layout(500, 548);
    list().setAttribute('data-floating', 'bottom');

    choose('A');
    await act(async () => {});

    // 800 − 548, less Designsystemet's 20 px (no arrow in jsdom, so no gap).
    expect(list().style.maxHeight).toBe('232px');
    expect(placed).toEqual([input()]);
  });

  it('regner med plassen over feltet når lista står over', async () => {
    render(<Harness />);
    await open();
    layout(500, 548);
    list().setAttribute('data-floating', 'top');

    choose('A');
    await act(async () => {});

    expect(list().style.maxHeight).toBe('480px');
  });

  it('lar lista være når den er lukket', async () => {
    render(<Harness />);
    const placed = layout(500, 548);

    choose('A');
    await act(async () => {});

    expect(list().style.maxHeight).toBe('');
    expect(placed).toEqual([]);
  });
});
