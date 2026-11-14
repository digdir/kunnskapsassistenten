import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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
      name: /Filtreringen i høyre panel/u,
    }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);

    expect(isFlagOn('filters-right-panel')).toBe(true);
    // The switch shows what it did, not only the flag.
    expect(toggle.checked).toBe(true);
  });

  it('shows the switch «Fotnoter som viser til utdraget» only where the server offers it', async () => {
    vi.stubEnv('VITE_API_MODE', 'bff');
    const me = vi.fn<typeof fetch>(async () => Response.json({ authEnabled: true }));
    vi.stubGlobal('fetch', me);
    const excerptSwitch = () =>
      screen.queryByRole('switch', { name: /Fotnoter som viser til utdraget/u });

    open();
    await waitFor(() => expect(me).toHaveBeenCalledWith('/api/v2/me', expect.anything()));
    expect(screen.getByRole('switch', { name: /Filtreringen i høyre panel/u })).toBeTruthy();
    expect(excerptSwitch()).toBeNull();

    cleanup();
    me.mockImplementation(async () => Response.json({ authEnabled: true, excerptTrial: true }));
    open();
    await waitFor(() => expect(excerptSwitch()).toBeTruthy());
    fireEvent.click(excerptSwitch() as HTMLElement);

    expect(isFlagOn('excerpt-citations')).toBe(true);
  });

  it('links to the issue for the experiment, in a new tab and said in words', () => {
    open();

    const link = screen.getByRole('link', { name: /^Sak 84 ?\(åpnes i ny fane\)$/u });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('href')).toBe(
      'https://github.com/digdir/kunnskapsassistenten/issues/84',
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
    open('/?flagg=filters-right-panel&annet=1');

    expect(isFlagOn('filters-right-panel')).toBe(true);
    expect(screen.getByTestId('address').textContent).toBe('/innstillinger?annet=1');
    expect(
      (screen.getByRole('switch', { name: /Filtreringen i høyre panel/u }) as HTMLInputElement)
        .checked,
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

  it('lands a link to the retired flags year-ranges and compact-filter-chips on the page, with every switch off', () => {
    open('/?flagg=year-ranges,compact-filter-chips');

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
