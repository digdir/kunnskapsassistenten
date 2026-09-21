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

describe('verifyBlocked', () => {
  test('an address that has not guessed is not blocked', () => {
    assert.equal(mod.verifyBlocked('rolig@digdir.no'), false);
  });

  test('five wrong codes block the sixth attempt', () => {
    const now = Date.now();
    for (let i = 0; i < 4; i++) mod.recordFailure('gjetter@digdir.no', now);
    assert.equal(mod.verifyBlocked('gjetter@digdir.no', now), false);
    mod.recordFailure('gjetter@digdir.no', now);
    assert.equal(mod.verifyBlocked('gjetter@digdir.no', now), true);
  });

  test('the block lifts once the window has passed', () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) mod.recordFailure('venter@digdir.no', now);
    assert.equal(mod.verifyBlocked('venter@digdir.no', now + 10 * 60_000), false);
  });

  test('a correct code clears the count', () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) mod.recordFailure('klarert@digdir.no', now);
    mod.clearFailures('klarert@digdir.no');
    assert.equal(mod.verifyBlocked('klarert@digdir.no', now), false);
  });
});

describe('inline scripts', () => {
  test('the pages carry no inline script for a CSP to allow', () => {
    for (const html of [mod.loginPage('/'), mod.codePage('a@digdir.no', '/')]) {
      assert.ok(!/<script(?![^>]*\bsrc=)/.test(html));
    }
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
