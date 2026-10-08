import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSession } from '../../api/session';
import { SignedIn } from './SignedIn';

describe('SignedIn', () => {
  it('names who is signed in, and signs out through the BFF', () => {
    render(
      <SignedIn
        session={{ name: 'Kari Nordmann', email: 'kari@digdir.no', logoutUrl: '/auth/logout' }}
      />,
    );

    expect(screen.getByText('Kari Nordmann')).toBeTruthy();
    expect(screen.getByText('Innlogget som')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Logg ut' }).getAttribute('href')).toBe('/auth/logout');
  });

  it('empties what this browser kept of the answers before it signs out', () => {
    // ka.sources.v1 holds what came of the reader's questions, per browser
    // and not per user (src/decisions/0008). Valgt 5.10.
    localStorage.setItem('ka.sources.v1', '{"threads":{"conv-1":{"usedAt":1,"answers":{}}}}');
    render(<SignedIn session={{ name: 'Kari Nordmann', logoutUrl: '/auth/logout' }} />);
    // jsdom does not navigate; this keeps it from saying so in the console.
    const stay = (event: Event) => event.preventDefault();
    document.addEventListener('click', stay);

    fireEvent.click(screen.getByRole('link', { name: 'Logg ut' }));

    document.removeEventListener('click', stay);
    expect(localStorage.getItem('ka.sources.v1')).toBeNull();
  });

  /*
   * The filter and the corpus the reader chose are kept per browser too, and
   * on a shared machine the next one to sign in started with them: the
   * filter went with their first question. The layout is how the page sits,
   * not what anyone asked, and stays.
   */
  it('empties the filter and the corpus the reader chose, and leaves the layout', () => {
    localStorage.setItem(
      'ka.filter.v1',
      '{"documentType":["Årsrapport"],"organisation":[],"year":[]}',
    );
    localStorage.setItem('ka.corpus.v1', 'kudos-full');
    localStorage.setItem('ka.layout.v1', '{"collapsed":{},"widths":{}}');
    render(<SignedIn session={{ name: 'Kari Nordmann', logoutUrl: '/auth/logout' }} />);
    const stay = (event: Event) => event.preventDefault();
    document.addEventListener('click', stay);

    fireEvent.click(screen.getByRole('link', { name: 'Logg ut' }));

    document.removeEventListener('click', stay);
    expect(localStorage.getItem('ka.filter.v1')).toBeNull();
    expect(localStorage.getItem('ka.corpus.v1')).toBeNull();
    expect(localStorage.getItem('ka.layout.v1')).not.toBeNull();
  });

  it('empties it too on a middle click, which opens the link in a new tab', () => {
    localStorage.setItem('ka.sources.v1', '{"threads":{}}');
    render(<SignedIn session={{ name: 'Kari Nordmann', logoutUrl: '/auth/logout' }} />);
    const link = screen.getByRole('link', { name: 'Logg ut' });

    // A right click opens a menu; nothing has been chosen yet.
    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, button: 2 }));
    expect(localStorage.getItem('ka.sources.v1')).not.toBeNull();

    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(localStorage.getItem('ka.sources.v1')).toBeNull();
  });

  it('draws nothing when nobody is signed in', () => {
    const { container } = render(<SignedIn session={null} />);

    expect(container.textContent).toBe('');
    expect(screen.queryByRole('link', { name: 'Logg ut' })).toBeNull();
  });
});

describe('fetchSession', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const me = (body: unknown, status = 200) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_API_MODE', 'bff');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('reads the name from /api/me when sign-in is on', async () => {
    me({ authEnabled: true, user: { name: 'Kari Nordmann', email: 'kari@digdir.no' } });

    expect(await fetchSession()).toEqual({
      name: 'Kari Nordmann',
      email: 'kari@digdir.no',
      logoutUrl: '/auth/logout',
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v2/me');
  });

  it('falls back to the address when the sign-in gave no name', async () => {
    me({ authEnabled: true, user: { name: '', email: 'kari@digdir.no' } });

    expect((await fetchSession())?.name).toBe('kari@digdir.no');
  });

  it('has nothing to show with sign-in turned off, as in the local pod', async () => {
    me({ authEnabled: false, user: null });

    expect(await fetchSession()).toBeUndefined();
  });

  it('offers no «Logg ut» with sign-in off, even if a user came along', async () => {
    // There is no session to end then, and /auth/logout would send the
    // reader to Entra for nothing.
    me({ authEnabled: false, user: { name: 'Lokal bruker', email: '' } });

    expect(await fetchSession()).toBeUndefined();
  });

  it('has nothing to show when /api/me fails', async () => {
    me({ error: 'feil' }, 502);
    expect(await fetchSession()).toBeUndefined();

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await fetchSession()).toBeUndefined();
  });

  it('does not ask anywhere but behind the BFF', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock');

    expect(await fetchSession()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
