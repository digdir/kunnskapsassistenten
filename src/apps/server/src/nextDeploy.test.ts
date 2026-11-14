import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/*
 * The next client in the deployment template and the image (decisions/0013): off unless asked
 * for, and both clients' builds in the one image.
 */
const template = readFileSync(new URL('../../../deploy/main.bicep', import.meta.url), 'utf8');
const dockerfile = readFileSync(new URL('../../../Dockerfile', import.meta.url), 'utf8');

test('the template passes KA_NEXT and its settings only when given, so it is off by default', () => {
  for (const [param, env] of [
    ['kaNext', 'KA_NEXT'],
    ['kaNextModel', 'KA_NEXT_MODEL'],
    ['kaNextTenant', 'KA_NEXT_TENANT'],
    ['kaNextLayout', 'KA_NEXT_LAYOUT'],
  ]) {
    assert.match(template, new RegExp(`^param ${param} string = ''$`, 'm'));
    assert.match(
      template,
      new RegExp(
        `empty\\(${param}\\) \\? \\[\\] : \\[\\s*\\{ name: '${env}', value: ${param} \\}`,
      ),
    );
  }
});

test('the image holds both builds, and names where the next one is, but does not switch it on', () => {
  assert.match(dockerfile, /COPY --from=build \/app\/apps\/web\/dist apps\/web\/dist/);
  assert.match(
    dockerfile,
    /COPY --from=build \/app\/apps\/web-next\/dist apps\/web-next\/dist/,
  );
  assert.match(dockerfile, /^ENV WEB_ROOT=\.\/apps\/web\/dist$/m);
  assert.match(dockerfile, /^ENV WEB_NEXT_ROOT=\.\/apps\/web-next\/dist$/m);
  assert.doesNotMatch(dockerfile, /^ENV KA_NEXT/m);
});

test("the image holds genki's layout checks the server runs on KA_NEXT_LAYOUT, with genki's licence", () => {
  assert.match(
    dockerfile,
    /^COPY apps\/web-next\/vendor\/genki\/ui-blocks apps\/web-next\/vendor\/genki\/ui-blocks$/m,
  );
  assert.match(
    dockerfile,
    /^COPY apps\/web-next\/vendor\/genki\/LICENSE apps\/web-next\/vendor\/genki\/LICENSE$/m,
  );
});
