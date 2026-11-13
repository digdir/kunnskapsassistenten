import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type AddressInfo } from 'node:net';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, test, type TestContext } from 'node:test';

const server = fileURLToPath(new URL('./server.ts', import.meta.url));
const network = Object.values(networkInterfaces())
  .flat()
  .find((a) => a?.family === 'IPv4' && !a.internal)?.address;

const freePort = () =>
  new Promise<number>((resolve) => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });

/** `answered` when anything answers at `url`, else why not, such as `ECONNREFUSED`. */
const reach = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(10_000) }).then(
    () => 'answered',
    (error: Error & { cause?: { code?: string } }) => error.cause?.code ?? error.name,
  );

/** Starts the real server with `env` and resolves to its port once it answers on 127.0.0.1. */
async function start(t: TestContext, env: Record<string, string>) {
  const port = await freePort();
  const child = spawn(process.execPath, [server], {
    env: {
      PATH: process.env.PATH ?? '',
      PORT: String(port),
      DIGDIR_API_KEY: 'unused',
      DIGDIR_API_BASE: 'http://127.0.0.1:9',
      ...env,
    },
    stdio: 'ignore',
  });
  t.after(() => child.kill());
  for (let tries = 0; tries < 100; tries += 1) {
    if ((await reach(`http://127.0.0.1:${port}/api/health`)) === 'answered') return port;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('the server did not start');
}

describe('where the server listens', { skip: network ? false : 'no network address' }, () => {
  test('listens only on 127.0.0.1 when sign-in is off', async (t) => {
    const port = await start(t, { AUTH_MODE: 'off' });

    assert.equal(await reach(`http://${network}:${port}/api/health`), 'ECONNREFUSED');
  });

  test('listens where LISTEN_HOST says, also when sign-in is off', async (t) => {
    const port = await start(t, { AUTH_MODE: 'off', LISTEN_HOST: '0.0.0.0' });

    assert.equal(await reach(`http://${network}:${port}/api/health`), 'answered');
  });

  test('listens on every interface when sign-in is on', async (t) => {
    const port = await start(t, {
      AUTH_MODE: 'entra',
      AZURE_TENANT_ID: 'tenant',
      AZURE_CLIENT_ID: 'client',
      AZURE_CLIENT_SECRET: 'secret',
      SESSION_SECRET: 'x'.repeat(32),
    });

    assert.equal(await reach(`http://${network}:${port}/api/health`), 'answered');
  });
});
