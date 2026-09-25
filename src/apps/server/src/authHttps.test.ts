import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { Hono } from 'hono';

process.env.DIGDIR_API_KEY ??= 'test-key';
process.env.AUTH_MODE = 'entra';
process.env.AZURE_TENANT_ID = '00000000-0000-0000-0000-000000000000';
process.env.AZURE_CLIENT_ID = '00000000-0000-0000-0000-000000000001';
process.env.AZURE_CLIENT_SECRET = 'not-a-real-secret';
process.env.SESSION_SECRET = 'x'.repeat(32);
process.env.APP_ORIGIN = 'https://ka.example.com';
process.env.AZURE_REDIRECT_URI = 'https://ka.example.com/auth/callback';

let app: Hono;

before(async () => {
  const { mountAuth } = await import('./auth.ts');
  app = new Hono();
  mountAuth(app);
});

describe('auth routes on https, where cookies carry the __Host- prefix', () => {
  test('a callback that fails the state check answers with the page, not a crash', async () => {
    const res = await app.request('/auth/callback?code=x&state=y');
    assert.equal(res.status, 400);
    assert.match(res.headers.get('set-cookie') ?? '', /__Host-ka_return_to=;.*Secure/);
  });

  test('logout clears the session cookie and hands over to Entra ID', async () => {
    const res = await app.request('/auth/logout');
    assert.equal(res.status, 302);
    assert.match(res.headers.get('set-cookie') ?? '', /__Host-ka_session=;.*Secure/);
  });

  test('starting sign-in sets a __Host- state cookie', async () => {
    const res = await app.request('/auth/start?next=%2F');
    assert.equal(res.status, 302);
    assert.match(res.headers.get('set-cookie') ?? '', /^__Host-ka_return_to=.*Secure/);
  });
});
