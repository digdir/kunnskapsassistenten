import { afterEach, describe, expect, it, vi } from 'vitest';
import { kaEnv } from './runtimeConfig';

/**
 * Byggetid og kjøretid, slått sammen.
 *
 * `vite build` baker `VITE_*` inn i bundelen, så et bilde ville vært låst til
 * modusen det ble bygget i. Serveren skriver derfor `window.__KA_CONFIG__`
 * i et lite skript klienten laster før bundelen (server/config.ts), og dette
 * er det ene stedet som vet at begge kildene finnes.
 */
afterEach(() => {
  delete window.__KA_CONFIG__;
  vi.unstubAllEnvs();
});

describe('kaEnv', () => {
  it('leser byggetidsverdien når serveren ikke har sagt noe', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock');
    expect(kaEnv().VITE_API_MODE).toBe('mock');
  });

  it('lar kjøretid vinne, for det er den senere og mer bestemte beskjeden', () => {
    // Bildet ble bygget med en standard; containeren ble startet med en hensikt.
    vi.stubEnv('VITE_API_MODE', 'mock');
    window.__KA_CONFIG__ = { VITE_API_MODE: 'live' };

    expect(kaEnv().VITE_API_MODE).toBe('live');
  });

  it('beholder byggetidsverdier kjøretid ikke nevner', () => {
    vi.stubEnv('VITE_MOCK_SPEED', 'fast');
    window.__KA_CONFIG__ = { VITE_API_MODE: 'live' };

    const env = kaEnv();
    expect(env.VITE_API_MODE).toBe('live');
    expect(env.VITE_MOCK_SPEED).toBe('fast');
  });

  it('tar med korpusvariablene serveren sender', () => {
    window.__KA_CONFIG__ = {
      VITE_KA_TENANT: 'digdir',
      VITE_KA_DATASET_CONFIG_KEY: 'kudos',
      VITE_KA_DATASETS: 'kudos=Kudos-pilot',
    };

    expect(kaEnv()).toMatchObject({
      VITE_KA_TENANT: 'digdir',
      VITE_KA_DATASET_CONFIG_KEY: 'kudos',
      VITE_KA_DATASETS: 'kudos=Kudos-pilot',
    });
  });
});
