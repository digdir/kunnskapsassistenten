import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const config = fileURLToPath(new URL('./config.ts', import.meta.url));
const auth = new URL('./auth.ts', import.meta.url).href;

const SIGN_IN = {
  AUTH_MODE: 'entra',
  AZURE_TENANT_ID: 'tenant',
  AZURE_CLIENT_ID: 'client',
  AZURE_CLIENT_SECRET: 'secret',
  SESSION_SECRET: 'x'.repeat(32),
};

/** Runs node with only `env` and the minimum the server needs, and returns how it ended. */
function run(args: string[], env: Record<string, string>) {
  const result = spawnSync(process.execPath, args, {
    env: { PATH: process.env.PATH ?? '', DIGDIR_API_KEY: 'unused', ...env },
    encoding: 'utf8',
    timeout: 30_000,
  });
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr };
}

/** Loads the configuration the way the server does at startup, with sign-in off. */
const startOff = (origin: string) => run([config], { AUTH_MODE: 'off', APP_ORIGIN: origin });

/** Whether auth.ts gives the session cookie `Secure` and `__Host-` when sign-in is on. */
const secureCookies = (origin: string) =>
  run(
    [
      '--input-type=module',
      '--eval',
      `console.log((await import(${JSON.stringify(auth)})).secure())`,
    ],
    {
      ...SIGN_IN,
      APP_ORIGIN: origin,
    },
  );

describe('AUTH_MODE=off is only for this machine', () => {
  test('refuses AUTH_MODE=off for an origin that only starts with localhost', () => {
    for (const origin of [
      'http://localhost.evil.example',
      'http://localhost.evil.example:8787',
      'http://localhost@evil.example',
      'http://localhost:8787@evil.example',
    ]) {
      const started = startOff(origin);
      assert.equal(started.status, 1, origin);
      assert.match(started.stderr, /AUTH_MODE=off/, origin);
    }
  });

  test('accepts AUTH_MODE=off for http://localhost:<port>', () => {
    assert.equal(startOff('http://localhost:8787').status, 0);
    assert.equal(startOff('http://localhost:5173/').status, 0);
  });

  test('accepts AUTH_MODE=off for http://127.0.0.1:<port>', () => {
    assert.equal(startOff('http://127.0.0.1:8787').status, 0);
  });

  test('accepts AUTH_MODE=off for http://[::1]:<port>', () => {
    assert.equal(startOff('http://[::1]:8787').status, 0);
  });

  test('accepts AUTH_MODE=off for https://localhost:<port>', () => {
    assert.equal(startOff('https://localhost:8443').status, 0);
  });

  test('refuses AUTH_MODE=off for an origin that cannot be parsed', () => {
    for (const origin of ['not an origin', 'http://localhost:port', 'http://[::1']) {
      const started = startOff(origin);
      assert.equal(started.status, 1, origin);
      assert.match(started.stderr, /AUTH_MODE=off/, origin);
    }
  });

  test('refuses AUTH_MODE=off for this machine over another protocol', () => {
    assert.equal(startOff('ftp://localhost:8787').status, 1);
    assert.equal(startOff('localhost:8787').status, 1);
  });
});

describe('the session cookie is Secure everywhere but plain-http on this machine', () => {
  test('is not Secure on http://localhost:<port> and http://127.0.0.1:<port>', () => {
    assert.equal(secureCookies('http://localhost:8787').stdout, 'false');
    assert.equal(secureCookies('http://127.0.0.1:8787').stdout, 'false');
  });

  test('is Secure on an origin that only starts with localhost', () => {
    assert.equal(secureCookies('http://localhost.evil.example').stdout, 'true');
    assert.equal(secureCookies('http://localhost@evil.example').stdout, 'true');
  });

  test('is Secure on https, also on this machine', () => {
    assert.equal(secureCookies('https://ka.example.com').stdout, 'true');
    assert.equal(secureCookies('https://localhost:8443').stdout, 'true');
  });
});
