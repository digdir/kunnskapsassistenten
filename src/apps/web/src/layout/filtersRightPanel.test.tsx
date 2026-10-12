import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { resetFlags, setFlag } from '../flags/flags';
import { defaultViewportWidth, setViewportWidth } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { LAYOUT_STORAGE_KEY } from './persistence';
import { useLayout } from './useLayout';
import { bothSidebarsMinViewport, drawerMaxViewport } from './viewModel';

/**
 * The trial with the filters over the sources in the secondary sidebar
 * (flag `filters-right-panel`, digdir/kunnskapsassistenten#84).
 */

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
document.getAnimations ??= () => [];

beforeEach(() => {
  resetFlags();
  window.localStorage.clear();
  setViewportWidth(defaultViewportWidth);
});
afterEach(() => {
  resetFlags();
  window.localStorage.clear();
  setViewportWidth(defaultViewportWidth);
});

function Probe() {
  const { layout } = useLayout();
  const side = layout.slots['secondary-sidebar'];
  return (
    <>
      <output data-testid="primary">{layout.slots['primary-sidebar'].views.join(',')}</output>
      <output data-testid="secondary">{side.views.join(',')}</output>
      <output data-testid="stacked">{String(side.stacked === true)}</output>
      <output data-testid="secondary-open">{String(!side.collapsed)}</output>
      <output data-testid="primary-open">
        {String(!layout.slots['primary-sidebar'].collapsed)}
      </output>
    </>
  );
}

const read = (id: string) => screen.getByTestId(id).textContent;

// What the browser keeps after the reader shut the sources panel.
function rememberShut() {
  window.localStorage.setItem(
    LAYOUT_STORAGE_KEY,
    JSON.stringify({
      collapsed: { 'primary-sidebar': false, 'secondary-sidebar': true },
      widths: {},
      sourcesDismissed: true,
    }),
  );
}

describe('flagget filters-right-panel i layouten', () => {
  it('er som før når flagget er av', () => {
    render(
      <LayoutProvider>
        <Probe />
      </LayoutProvider>,
    );

    expect(read('primary')).toBe('threads,filters');
    expect(read('secondary')).toBe('sources');
    expect(read('stacked')).toBe('false');
    expect(read('secondary-open')).toBe('false');
  });

  it('setter filteret over kildene og åpner høyre panel der begge får plass', () => {
    setFlag('filters-right-panel', true);
    render(
      <LayoutProvider>
        <Probe />
      </LayoutProvider>,
    );

    expect(read('primary')).toBe('threads');
    expect(read('secondary')).toBe('filters,sources');
    expect(read('stacked')).toBe('true');
    expect(read('secondary-open')).toBe('true');
  });

  it('åpner ikke høyre panel i et smalt vindu, der skuffene gjelder', () => {
    setViewportWidth(drawerMaxViewport - 1);
    setFlag('filters-right-panel', true);
    render(
      <LayoutProvider>
        <Probe />
      </LayoutProvider>,
    );

    expect(read('secondary')).toBe('filters,sources');
    expect(read('secondary-open')).toBe('false');
  });

  it('åpner ikke skuffen når flagget slås på mens siden er oppe', () => {
    setViewportWidth(drawerMaxViewport - 1);
    render(
      <LayoutProvider>
        <Probe />
      </LayoutProvider>,
    );

    act(() => setFlag('filters-right-panel', true));

    expect(read('secondary-open')).toBe('false');
  });

  // Too narrow for both sidebars, wide enough not to draw them as drawers: the one-sidebar rule.
  describe.each([drawerMaxViewport, bothSidebarsMinViewport - 1])(
    'i et vindu på %i px',
    (width) => {
      beforeEach(() => setViewportWidth(width));

      it('åpner høyre panel og lukker navigasjonspanelet ved innlasting med flagget på', () => {
        setFlag('filters-right-panel', true);
        render(
          <LayoutProvider>
            <Probe />
          </LayoutProvider>,
        );

        expect(read('secondary')).toBe('filters,sources');
        expect(read('secondary-open')).toBe('true');
        expect(read('primary-open')).toBe('false');
      });

      it('åpner høyre panel og lukker navigasjonspanelet når flagget slås på mens siden er oppe', () => {
        render(
          <LayoutProvider>
            <Probe />
          </LayoutProvider>,
        );
        expect(read('primary-open')).toBe('true');

        act(() => setFlag('filters-right-panel', true));

        expect(read('secondary-open')).toBe('true');
        expect(read('primary-open')).toBe('false');
      });

      it('lar navigasjonspanelet stå ved innlasting når leseren har lukket høyre panel selv', () => {
        rememberShut();
        setFlag('filters-right-panel', true);
        render(
          <LayoutProvider>
            <Probe />
          </LayoutProvider>,
        );

        expect(read('secondary-open')).toBe('false');
        expect(read('primary-open')).toBe('true');
      });
    },
  );

  describe('når leseren har lukket høyre panel selv', () => {
    it('åpner det ikke ved innlasting med flagget på', () => {
      rememberShut();
      setFlag('filters-right-panel', true);
      render(
        <LayoutProvider>
          <Probe />
        </LayoutProvider>,
      );

      expect(read('secondary')).toBe('filters,sources');
      expect(read('secondary-open')).toBe('false');
    });

    it('åpner det likevel når leseren slår på flagget mens siden er oppe', () => {
      rememberShut();
      render(
        <LayoutProvider>
          <Probe />
        </LayoutProvider>,
      );

      act(() => setFlag('filters-right-panel', true));

      expect(read('secondary-open')).toBe('true');
    });
  });

  it('flytter tilbake når flagget slås av, og lagrer det samme som uten flagget', () => {
    setFlag('filters-right-panel', true);
    render(
      <LayoutProvider>
        <Probe />
      </LayoutProvider>,
    );

    act(() => setFlag('filters-right-panel', false));

    expect(read('primary')).toBe('threads,filters');
    expect(read('secondary')).toBe('sources');
    // The stored layout never holds the move, only what opens and how wide.
    expect(window.localStorage.getItem(LAYOUT_STORAGE_KEY)).not.toContain('filters');
  });

  it('åpner høyre panel når flagget slås på mens siden er oppe', () => {
    render(
      <LayoutProvider>
        <Probe />
      </LayoutProvider>,
    );
    expect(read('secondary-open')).toBe('false');

    act(() => setFlag('filters-right-panel', true));

    expect(read('secondary')).toBe('filters,sources');
    expect(read('secondary-open')).toBe('true');
  });
});

describe('flagget filters-right-panel i skallet', () => {
  function openFrontPage() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
  }

  it('har filtreringen og kildene i høyre panel, hver med sitt eget hode', () => {
    setFlag('filters-right-panel', true);
    openFrontPage();

    const side = screen.getByRole('complementary', { name: 'Filter og kilder' });
    const heads = side.querySelectorAll('.stacked-view > .view-head');
    expect(heads).toHaveLength(2);
    expect(
      within(heads[0] as HTMLElement).getByRole('heading', { name: 'Filtrering' }),
    ).toBeTruthy();
    expect(within(heads[1] as HTMLElement).getByRole('heading', { name: 'Kilder' })).toBeTruthy();
  });

  it('har bare trådene i navigasjonspanelet, uten knapp for å bytte til filter', () => {
    setFlag('filters-right-panel', true);
    openFrontPage();

    const nav = screen.getByRole('navigation', { name: 'Tråder' });
    expect(within(nav).queryByRole('heading', { name: 'Filtrering' })).toBeNull();
    expect(within(nav).queryByRole('button', { name: 'Filter' })).toBeNull();
  });

  it('sier med knappene at høyre panel er åpent og navigasjonspanelet lukket i et smalt vindu', () => {
    setViewportWidth(bothSidebarsMinViewport - 1);
    setFlag('filters-right-panel', true);
    openFrontPage();

    expect(
      screen.getByRole('button', { name: 'Skjul filter og kilder' }).getAttribute('aria-expanded'),
    ).toBe('true');
    expect(screen.getByRole('button', { name: 'Vis tråder' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('er som før uten flagget', () => {
    openFrontPage();

    expect(screen.getByRole('navigation', { name: 'Tråder og filter' })).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Kilder' })).toBeTruthy();
    expect(document.querySelector('.stacked-view')).toBeNull();
  });
});
