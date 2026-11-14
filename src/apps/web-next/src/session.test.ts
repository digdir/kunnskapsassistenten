import { describe, expect, it, vi } from 'vitest';
import { loadMe, sessionGone, signInHref, SignedOut } from './session';

const ME = {
  name: 'Testperson',
  signOut: '/auth/logout',
  model: 'kunnskapsassistenten__default',
  service: 'kunnskapsassistenten',
  tenant: 'digdir',
  writes: true,
};

const answering = (status: number, body?: unknown) =>
  vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));

describe('the session', () => {
  it('is read from /api/next/me', async () => {
    const fetcher = answering(200, ME);
    await expect(loadMe(fetcher)).resolves.toEqual(ME);
    expect(fetcher).toHaveBeenCalledWith('/api/next/me', expect.anything());
  });

  it('without one, says so, so the page goes to the sign-in', async () => {
    await expect(loadMe(answering(401, { error: 'Ikke innlogget.' }))).rejects.toBeInstanceOf(
      SignedOut,
    );
  });

  it('refuses an answer of another shape, or another failure, as an error', async () => {
    await expect(loadMe(answering(200, { name: 'x' }))).rejects.toThrow(/shape/);
    await expect(loadMe(answering(502))).rejects.toThrow(/502/);
  });

  it('takes the layout from genki’s builder the server gives, and refuses one that is not a layout', async () => {
    const layout = {
      version: 1,
      zones: { primary: [], main: [{ block: 'chat' }], secondary: [] },
      profile: { assistantName: 'Rapportassistenten' },
    };
    await expect(loadMe(answering(200, { ...ME, layout }))).resolves.toEqual({ ...ME, layout });
    await expect(
      loadMe(answering(200, { ...ME, layout: { ...layout, version: 2 } })),
    ).rejects.toThrow(/shape/);
    await expect(
      loadMe(answering(200, { ...ME, layout: { ...layout, profile: { suggestions: 'one' } } })),
    ).rejects.toThrow(/shape/);
  });

  it('takes whether the server serves only this client, and refuses it when it is not true or false', async () => {
    await expect(loadMe(answering(200, { ...ME, nextOnly: true }))).resolves.toEqual({
      ...ME,
      nextOnly: true,
    });
    await expect(loadMe(answering(200, { ...ME, nextOnly: 'yes' }))).rejects.toThrow(/shape/);
  });

  it('signs in with the way back to this address, its thread included', () => {
    expect(signInHref({ pathname: '/', search: '?t=abc' } as Location)).toBe(
      '/auth/login?next=%2F%3Ft%3Dabc',
    );
  });

  it('is gone only when the server answers 401', async () => {
    expect(await sessionGone(answering(401))).toBe(true);
    expect(await sessionGone(answering(200, ME))).toBe(false);
    expect(
      await sessionGone(
        vi.fn(async () => {
          throw new TypeError('fetch failed');
        }),
      ),
    ).toBe(false);
  });
});
