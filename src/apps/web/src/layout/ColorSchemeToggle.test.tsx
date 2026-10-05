import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetViewport, setViewportWidth } from '../test/matchMedia';
import { ColorSchemeToggle } from './ColorSchemeToggle';
import { setColorScheme, STORAGE_KEY } from './colorScheme';
import { LayoutProvider } from './LayoutProvider';
import { Shell } from './Shell';

/**
 * Simens issue 85: lys og mørk modus valgt av leseren, ikke bare fulgt fra
 * systemet. Det selve fargene gjør, er temaets sak og målt i nettleseren; det
 * som måles her, er valget, at det lagres, og hvor kontrollen står.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const scheme = () => document.documentElement.getAttribute('data-color-scheme');
const radio = (name: string) => screen.getByRole('radio', { name });

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-color-scheme');
  resetViewport();
});

describe('ColorSchemeToggle', () => {
  it('er en gruppe på tre, med navn, og står på «Auto» til noen velger', () => {
    render(<ColorSchemeToggle />);

    const group = screen.getByRole('group', { name: 'Fargemodus' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect((radio('Auto') as HTMLInputElement).checked).toBe(true);
  });

  it('bytter fargemodus, lagrer valget, og kan gå tilbake til systemet', () => {
    render(<ColorSchemeToggle />);

    fireEvent.click(radio('Mørk'));
    expect(scheme()).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect((radio('Mørk') as HTMLInputElement).checked).toBe(true);

    // «Auto» er standarden og må kunne nås igjen etter at leseren har
    // prøvd de to andre. Det er derfor dette ikke er en Switch.
    fireEvent.click(radio('Auto'));
    expect(scheme()).toBe('auto');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('auto');
  });

  it('viser et valg gjort et annet sted, som i konsollen', () => {
    render(<ColorSchemeToggle />);

    act(() => {
      setColorScheme('light');
    });

    expect((radio('Lys') as HTMLInputElement).checked).toBe(true);
  });

  it('følger et valg gjort i en annen fane', () => {
    render(<ColorSchemeToggle />);

    // `storage` kommer bare i fanene som IKKE skrev, så den andre fanens
    // skriving er lagret verdi pluss hendelsen.
    act(() => {
      localStorage.setItem(STORAGE_KEY, 'dark');
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    });

    expect(scheme()).toBe('dark');
    expect((radio('Mørk') as HTMLInputElement).checked).toBe(true);
  });
});

describe('hvor den står', () => {
  function open(width: number) {
    setViewportWidth(width);
    render(
      <MemoryRouter initialEntries={['/']}>
        <LayoutProvider>
          <Routes>
            <Route path="/" element={<Shell />} />
          </Routes>
        </LayoutProvider>
      </MemoryRouter>,
    );
  }

  it('står nederst i navigasjonspanelet, og bare der', () => {
    open(1440);

    const nav = screen.getByRole('navigation', { name: 'Tråder og filter' });
    expect(within(nav).getByRole('group', { name: 'Fargemodus' })).toBeDefined();
    expect(screen.getAllByRole('group', { name: 'Fargemodus' })).toHaveLength(1);
  });

  it('står ikke på skinnen, der tre valg ikke får plass', () => {
    open(1440);

    fireEvent.click(screen.getByRole('button', { name: 'Skjul tråder og filter' }));

    expect(screen.queryByRole('group', { name: 'Fargemodus' })).toBeNull();
  });

  it('står nederst i skuffen på en smal skjerm', () => {
    open(440);

    fireEvent.click(screen.getByRole('button', { name: 'Vis tråder og filter' }));

    const drawer = screen.getByRole('dialog', { name: 'Tråder og filter' });
    expect(within(drawer).getByRole('group', { name: 'Fargemodus' })).toBeDefined();
  });
});
