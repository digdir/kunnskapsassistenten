// @vitest-environment node
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveInside } from './static.ts';

/**
 * `resolveInside` called with the path as it arrives on the socket. A test
 * through `fetch` cannot ask this: `fetch` resolves `..` in its own address
 * before it sends (see `raw` in app.test.ts).
 */
const dist = resolve('/srv/ka/dist');

describe('resolveInside', () => {
  it('gir fila inne i dist-mappa', () => {
    expect(resolveInside(dist, '/assets/index-abc.js')).toBe(join(dist, 'assets', 'index-abc.js'));
    expect(resolveInside(dist, '/index.html')).toBe(join(dist, 'index.html'));
  });

  it('gir selve mappa for rota, så serveren faller tilbake til index.html', () => {
    expect(resolveInside(dist, '/')).toBe(dist);
    expect(resolveInside(dist, '')).toBe(dist);
  });

  it('holder `..` inne i mappa, også escapet', () => {
    for (const path of [
      '/../../etc/passwd',
      '/assets/../../../etc/passwd',
      '/..%2f..%2fetc%2fpasswd',
      '/%2e%2e/%2e%2e/etc/passwd',
      '/assets/..%5c..%5cetc',
    ]) {
      const found = resolveInside(dist, path);
      expect(found === dist || found?.startsWith(`${dist}/`), path).toBe(true);
    }
  });

  it('svarer ingenting for en sti uten skråstrek foran som går ut av mappa', () => {
    // Only a path that does not start with `/` keeps its `..` through
    // `normalize`, so this is where the check itself is what stops it.
    for (const path of ['..', '../../etc/passwd', '..%2f..%2fetc%2fpasswd', 'assets/../../x']) {
      expect(resolveInside(dist, path), path).toBeUndefined();
    }
    // A sibling whose name starts with the same letters is outside too.
    expect(resolveInside(dist, '../dist-old/secret')).toBeUndefined();
  });

  it('tar et navn som begynner med to punktum, men ikke er `..`', () => {
    expect(resolveInside(dist, '/..config')).toBe(join(dist, '..config'));
  });

  it('svarer ingenting for en ødelagt escape eller en NUL', () => {
    expect(resolveInside(dist, '/%E0%A4%A')).toBeUndefined();
    expect(resolveInside(dist, '/index.html%00.png')).toBeUndefined();
  });
});
