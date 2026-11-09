import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { FLAGS_STORAGE_KEY, forgetFlags, isFlagOn } from '../../flags';
import { getFooterMode, resetFooterMode } from '../../layout/footerMode';
import { getDisplayLevel, resetDisplayLevel } from '../../views/chat/displayLevel';
import { SettingsPage } from './SettingsPage';
import { useSettingsLinks } from './useSettingsLinks';

/** Writes the address out, so a test can read where an old link landed. */
function Address() {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="address">{pathname + search + hash}</p>;
}

function Links() {
  useSettingsLinks();
  return <Address />;
}

function open(at = '/innstillinger') {
  render(
    <MemoryRouter initialEntries={[at]}>
      <Links />
      <Routes>
        <Route path="innstillinger" element={<SettingsPage />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDisplayLevel();
  resetFooterMode();
  forgetFlags();
});

describe('SettingsPage', () => {
  it('has colour mode, the answer view and the experiments', () => {
    open();

    expect(screen.getByRole('heading', { level: 1, name: 'Innstillinger' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Fargemodus' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Standard/u })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Eksperimenter' })).toBeTruthy();
  });

  it('switches the answer view at once', () => {
    open();

    const detailed = screen.getByRole('radio', { name: /Detaljert/u }) as HTMLInputElement;
    fireEvent.click(detailed);

    expect(getDisplayLevel()).toBe('detaljert');
    expect(detailed.checked).toBe(true);
  });

  it('has the foot choice locally, and two choices that do not change each other', () => {
    // Vitest runs with `import.meta.env.DEV`, like the development server.
    open();

    fireEvent.click(screen.getByRole('radio', { name: /Festet/u }));

    expect(getFooterMode()).toBe('pinned');
    expect(getDisplayLevel()).toBe('standard');
  });

  it('turns an experiment on with the switch', () => {
    open();

    const toggle = screen.getByRole('switch', {
      name: /Årsfilter med perioder/u,
    }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);

    expect(isFlagOn('year-ranges')).toBe(true);
    // The switch shows what it did, not only the flag.
    expect(toggle.checked).toBe(true);
  });

  it('links to the issue for the experiment, in a new tab and said in words', () => {
    open();

    const link = screen.getByRole('link', { name: /^Sak 115 ?\(åpnes i ny fane\)$/u });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('href')).toBe(
      'https://github.com/digdir/kunnskapsassistenten/issues/115',
    );
  });
});

describe('old links', () => {
  it('sends #innstillinger to the page', () => {
    open('/threads/abc#innstillinger');

    expect(screen.getByTestId('address').textContent).toBe('/innstillinger');
  });

  it('sends #feature-flags to the page', () => {
    open('/#feature-flags');

    expect(screen.getByTestId('address').textContent).toBe('/innstillinger');
  });

  it('turns on the flag in ?flagg= and takes the parameter out, but keeps the rest', () => {
    open('/?flagg=year-ranges&annet=1');

    expect(isFlagOn('year-ranges')).toBe(true);
    expect(screen.getByTestId('address').textContent).toBe('/innstillinger?annet=1');
    expect(
      (screen.getByRole('switch', { name: /Årsfilter med perioder/u }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('lands a link to the retired flag mobile-top-row on the page, with every switch off', () => {
    open('/?flagg=mobile-top-row');

    expect(screen.getByTestId('address').textContent).toBe('/innstillinger');
    const switches = screen.getAllByRole('switch') as HTMLInputElement[];
    expect(switches.length).toBeGreaterThan(0);
    expect(switches.filter((toggle) => toggle.checked)).toEqual([]);
    expect(localStorage.getItem(FLAGS_STORAGE_KEY)).toBeNull();
  });

  it('leaves other addresses alone', () => {
    open('/threads/abc');

    expect(screen.getByTestId('address').textContent).toBe('/threads/abc');
  });
});
