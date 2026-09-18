import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

process.env.DIGDIR_API_KEY ??= 'test-key';
process.env.ALLOWED_EMAIL_DOMAINS ??= 'digdir.no';

let mod: typeof import('./supabaseAuth.ts');

before(async () => {
  mod = await import('./supabaseAuth.ts');
});

describe('throttled', () => {
  test('an address that has not asked is not throttled', () => {
    assert.equal(mod.throttled('fersk@digdir.no'), false);
  });
});

describe('loginPage', () => {
  test('the return path is escaped rather than interpolated raw', () => {
    const html = mod.loginPage('/"><script>alert(1)</script>');
    assert.ok(!html.includes('<script>alert(1)'));
    assert.ok(html.includes('&quot;'));
  });

  test('it asks for an address and never for a password', () => {
    const html = mod.loginPage('/');
    assert.match(html, /name="email" type="email"/);
    assert.ok(!html.includes('type="password"'));
  });

  test('an error is shown escaped', () => {
    assert.ok(mod.loginPage('/', 'Feil <b>her</b>').includes('&lt;b&gt;'));
  });
});

describe('verifyType', () => {
  test('a signup token keeps its own type, not the email default', () => {
    assert.equal(mod.verifyType('signup'), 'signup');
    assert.equal(mod.verifyType('magiclink'), 'magiclink');
  });

  test('anything unrecognised falls back rather than reaching Supabase', () => {
    assert.equal(mod.verifyType('../../etc'), 'email');
    assert.equal(mod.verifyType(undefined), 'email');
  });
});
