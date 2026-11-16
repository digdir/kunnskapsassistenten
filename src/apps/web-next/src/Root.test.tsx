import type { AssistantApi } from '@genai/ui-assembly';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Root } from './Root';
import type { Me } from './session';

const me: Me = {
  name: 'Testperson Testesen',
  signOut: '/auth/logout',
  model: 'kunnskapsassistenten__default',
  service: 'kunnskapsassistenten',
  tenant: 'digdir',
  writes: false,
};

const fakeApi = (): AssistantApi => ({
  loadModels: vi.fn(async () => []),
  loadThreads: vi.fn(async () => []),
  loadThread: vi.fn(async () => ({ title: '', turns: [] })),
  loadCorpora: vi.fn(async () => []),
  loadFields: vi.fn(async () => []),
  loadFacets: vi.fn(async () => []),
  loadAbout: vi.fn(async () => undefined),
  ask: async function* () {},
});

const at = (pathname: string, search = '') => ({ pathname, search });

afterEach(() => {
  cleanup();
  document.title = '';
});

describe('KA’s pages, in this client', () => {
  it('draws «Endringslogg» at its address, named in the tab, with the way back to the thread', () => {
    render(<Root me={me} at={at('/endringslogg', '?fra=%2F%3Ft%3Dabc')} api={fakeApi()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Endringslogg' })).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(document.title).toBe('Endringslogg – Kunnskapsassistenten');
    const back = screen.getAllByRole('link', { name: 'Tilbake til Kunnskapsassistenten' });
    expect(back).toHaveLength(2);
    for (const link of back) expect(link.getAttribute('href')).toBe('/?t=abc');
    // The way back is the first thing a keyboard reaches.
    expect(document.querySelector('main a')).toBe(back[0]);
  });

  it('draws «Om prosjektet» at its address, with the way back to the front page', () => {
    render(<Root me={me} at={at('/om-prosjektet')} api={fakeApi()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Om prosjektet' })).toBeTruthy();
    expect(screen.getByText(/Kudos-databasen/)).toBeTruthy();
    expect(document.title).toBe('Om prosjektet – Kunnskapsassistenten');
    for (const link of screen.getAllByRole('link', {
      name: 'Tilbake til Kunnskapsassistenten',
    }))
      expect(link.getAttribute('href')).toBe('/');
  });

  it('says «Siden finnes ikke» at an address that is none, with the way to the front page', () => {
    render(<Root me={me} at={at('/onboarding')} api={fakeApi()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Siden finnes ikke' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Gå til forsiden' }).getAttribute('href')).toBe(
      '/',
    );
    expect(document.title).toBe('Siden finnes ikke – Kunnskapsassistenten');
  });

  it('has none of KA’s pages for another service', () => {
    render(
      <Root
        me={{ ...me, service: 'rapportassistenten', model: 'rapportassistenten__default' }}
        at={at('/endringslogg')}
        api={fakeApi()}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Siden finnes ikke' })).toBeTruthy();
  });

  it('draws the assistant at its own addresses', async () => {
    render(<Root me={me} at={at('/')} api={fakeApi()} />);
    expect((await screen.findAllByRole('button', { name: me.name })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Siden finnes ikke' })).toBeNull();
  });
});
