// The JavaScript a reader downloads before the page can start, gzipped,
// against a budget. Run after `npm run build`: `node scripts/check-bundle-size.mjs [dist]`.
//
// What counts is what `index.html` loads: the entry script and the chunks it
// preloads. A bff build leaves the mock and the live client out, because
// `createChatClient` (src/api/index.ts) folds away the branches that use them
// and vite.config.ts lets the bundler drop their modules then. Before that,
// the bundle was 520 kB gzipped with both in it. Pulling either back in goes
// over the budget, and so does growing by a sixth without anyone deciding to.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 300;

const dist = process.argv[2] ?? 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const files = [
  ...new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((match) => match[1])),
];

let total = 0;
for (const file of files) {
  const kb = gzipSync(readFileSync(join(dist, file))).length / 1000;
  total += kb;
  console.log(`${kb.toFixed(1).padStart(8)} kB  ${file}`);
}
console.log(`${total.toFixed(1).padStart(8)} kB  i alt, gzip (budsjett ${BUDGET_KB} kB)`);

if (files.length === 0) {
  console.error('Fant ingen skript i index.html.');
  process.exit(1);
}
if (total > BUDGET_KB) {
  console.error(`Over budsjettet med ${(total - BUDGET_KB).toFixed(1)} kB.`);
  process.exit(1);
}
