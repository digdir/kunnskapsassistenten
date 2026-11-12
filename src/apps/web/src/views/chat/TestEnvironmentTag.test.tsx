import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTestEnvironment } from '../../api/session';
import { TestEnvironmentTag } from './TestEnvironmentTag';

describe('TestEnvironmentTag', () => {
  it('shows «Testmiljø» to a tester', () => {
    render(<TestEnvironmentTag environment="test" />);

    expect(screen.getByText('Testmiljø')).toBeTruthy();
  });

  it('draws nothing for anyone who is not a tester', () => {
    const { container } = render(<TestEnvironmentTag environment={null} />);

    expect(container.textContent).toBe('');
  });
});

describe('fetchTestEnvironment', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const me = (body: unknown, status = 200) =>
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(body), { status }));

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_API_MODE', 'bff');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('reads the environment /api/me names for a tester, and the tag shows it', async () => {
    me({ authEnabled: true, environment: 'test' });

    expect(await fetchTestEnvironment()).toBe('test');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v2/me');
    render(<TestEnvironmentTag />);
    expect(await screen.findByText('Testmiljø')).toBeTruthy();
  });

  it('has none when /api/me names no environment, so the tag stays away', async () => {
    me({ authEnabled: true, user: { name: 'Kari Nordmann' } });

    expect(await fetchTestEnvironment()).toBeUndefined();
    const { container } = render(<TestEnvironmentTag />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(container.textContent).toBe('');
  });

  it('has none when /api/me fails', async () => {
    me({ error: 'feil' }, 502);
    expect(await fetchTestEnvironment()).toBeUndefined();

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await fetchTestEnvironment()).toBeUndefined();
  });

  it('does not ask anywhere but behind the BFF', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock');

    expect(await fetchTestEnvironment()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
