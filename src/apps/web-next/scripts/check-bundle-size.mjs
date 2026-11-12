// What a reader downloads before the page starts, against apps/web's budget: 300 kB gzip for the
// scripts and sheets index.html names. `node scripts/check-bundle-size.mjs dist`
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET = 300 * 1024;
const dist = process.argv[2] ?? 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const files = [...html.matchAll(/(?:src|href)="\/(next-assets\/[^"]+\.(?:js|css))"/g)].map(
  (m) => m[1],
);
let total = 0;
for (const file of files) {
  const size = gzipSync(readFileSync(join(dist, file))).length;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(7)} kB  ${file}`);
}
console.log(`${(total / 1024).toFixed(1).padStart(7)} kB  in all, budget ${BUDGET / 1024} kB`);
if (files.length === 0 || total > BUDGET) process.exit(1);
