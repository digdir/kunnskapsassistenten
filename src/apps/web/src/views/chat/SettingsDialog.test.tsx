import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsDialog } from './SettingsDialog';

/**
 * The way back to the previous client, from the settings menu.
 *
 * The BFF serves both clients and picks one by a cookie, which `?klient=gammel`
 * sets. Only the BFF does that, so the link is there only behind it.
 */
afterEach(() => vi.unstubAllEnvs());

const open = () =>
  render(<SettingsDialog footerMode="scrolls" level="standard" onClose={() => {}} />);

describe('innstillingene, lenken til den forrige klienten', () => {
  it('står der bak BFF-en, og går til /?klient=gammel', () => {
    vi.stubEnv('VITE_API_MODE', 'bff');
    open();

    const link = screen.getByRole('link', { name: 'Bytt til forrige klient' });
    expect(link.getAttribute('href')).toBe('/?klient=gammel');
  });

  it('står ikke der uten BFF-en, som er den eneste som serverer den', () => {
    vi.stubEnv('VITE_API_MODE', 'mock');
    open();

    expect(screen.queryByRole('link', { name: 'Bytt til forrige klient' })).toBeNull();
  });
});
