import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

process.env.DIGDIR_API_KEY ??= 'test-key';

let safeReturnTo: typeof import('./auth.ts').safeReturnTo;

before(async () => {
  ({ safeReturnTo } = await import('./auth.ts'));
});

describe('safeReturnTo', () => {
  test('an ordinary path is kept', () => {
    assert.equal(safeReturnTo('/tråd/42'), '/tråd/42');
  });

  test('an auth route is refused, since that is how the redirect loop starts', () => {
    assert.equal(safeReturnTo('/auth/login'), '/');
    assert.equal(safeReturnTo('/auth/login?next=%2Fauth%2Flogin'), '/');
  });

  test('an auth route reached through dot segments is refused too', () => {
    assert.equal(safeReturnTo('/./auth/logout'), '/');
    assert.equal(safeReturnTo('/a/../auth/logout'), '/');
    assert.equal(safeReturnTo('/%2e/auth/logout'), '/');
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
