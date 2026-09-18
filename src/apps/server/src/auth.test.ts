import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

process.env.DIGDIR_API_KEY ??= 'test-key';

let domainsOf: typeof import('./auth.ts').domainsOf;
let safeReturnTo: typeof import('./auth.ts').safeReturnTo;

before(async () => {
  ({ domainsOf, safeReturnTo } = await import('./auth.ts'));
});

describe('domainsOf', () => {
  test('a member account yields its own domain', () => {
    assert.deepEqual(domainsOf({ email: 'ansatt@ai-dev.no' }), ['ai-dev.no']);
  });

  test('a guest UPN yields the domain the person actually belongs to', () => {
    assert.deepEqual(
      domainsOf({ upn: 'fornavn.etternavn_digdir.no#EXT#@aidev.onmicrosoft.com' }),
      ['digdir.no'],
    );
  });

  test('the guest mail and the mangled UPN agree on one domain', () => {
    assert.deepEqual(
      domainsOf({
        email: 'fornavn.etternavn@digdir.no',
        upn: 'fornavn.etternavn_digdir.no#EXT#@aidev.onmicrosoft.com',
      }),
      ['digdir.no'],
    );
  });

  test('the tenant domain is not mistaken for the guest domain', () => {
    const d = domainsOf({ upn: 'x_digdir.no#EXT#@aidev.onmicrosoft.com' });
    assert.ok(!d.includes('aidev.onmicrosoft.com'));
  });

  test('nothing in, nothing out', () => {
    assert.deepEqual(domainsOf({}), []);
  });
});

describe('safeReturnTo', () => {
  test('an ordinary path is kept', () => {
    assert.equal(safeReturnTo('/tråd/42'), '/tråd/42');
  });

  test('an auth route is refused, since that is how the redirect loop starts', () => {
    assert.equal(safeReturnTo('/auth/login'), '/');
    assert.equal(safeReturnTo('/auth/login?next=%2Fauth%2Flogin'), '/');
  });

  test('another origin is refused', () => {
    assert.equal(safeReturnTo('//evil.example.com'), '/');
    assert.equal(safeReturnTo('https://evil.example.com'), '/');
  });

  test('nothing becomes the root', () => {
    assert.equal(safeReturnTo(undefined), '/');
    assert.equal(safeReturnTo(''), '/');
  });
});

describe('safeReturnTo hardening', () => {
  test('a script-breaking path cannot reach a page', () => {
    assert.equal(safeReturnTo('/</script><script>alert(1)</script>'), '/');
  });

  test('a backslash cannot be used to leave the origin', () => {
    assert.equal(safeReturnTo('/\\evil.com'), '/');
    assert.equal(safeReturnTo('/\\/evil.com'), '/');
  });

  test('a newline cannot be smuggled into a header', () => {
    assert.equal(safeReturnTo('/\r\nX-Evil: 1'), '/');
  });
});
