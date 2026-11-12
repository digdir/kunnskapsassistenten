import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// vendor/genki is genki's source at one commit, refreshed only by scripts/sync-genki.sh.
const root = join(import.meta.dirname, '..', 'vendor', 'genki');

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });

describe('vendor/genki', () => {
  it('names the genki commit it is a copy of', () => {
    const record = readFileSync(join(root, 'GENKI_COMMIT'), 'utf8');
    expect(record).toMatch(/^commit: [0-9a-f]{40}$/m);
    expect(record).toMatch(/^branch: \S+$/m);
  });

  it("holds the four packages and genki's licence", () => {
    for (const name of ['client', 'i18n', 'ui-blocks', 'ui-assembly'])
      expect(statSync(join(root, name, 'src')).isDirectory()).toBe(true);
    expect(readFileSync(join(root, 'LICENSE'), 'utf8')).toMatch(/MIT/);
  });

  it('is not edited by hand: no local marker, and no tests or fixtures', () => {
    const all = files(root);
    for (const file of all) {
      expect(file).not.toMatch(/\.test\.tsx?$|test-utils|\/fixtures\//);
      expect(readFileSync(file, 'utf8')).not.toMatch(/KA-PATCH|KA-LOCAL/);
    }
  });
});
