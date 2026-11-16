import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, test } from 'node:test';

/*
 * The deployment template and the image against the settings this server reads: the client's
 * settings passed only when given, none of the retired ones (decisions/0019), and one build.
 */
const template = readFileSync(new URL('../../../deploy/main.bicep', import.meta.url), 'utf8');
const dockerfile = readFileSync(new URL('../../../Dockerfile', import.meta.url), 'utf8');

process.env.DIGDIR_API_KEY ??= 'test-key';
let config: typeof import('./config.ts');
before(async () => {
  config = await import('./config.ts');
});

/** The default of a `param <name> string = '…'` in the template. */
function defaultOf(name: string): string | undefined {
  return new RegExp(`^param ${name} string = '([^']*)'$`, 'm').exec(template)?.[1];
}

test("the template's default backend is genki-test", () => {
  assert.equal(defaultOf('digdirApiBase'), 'https://api.genki-test.digdir.cloud');
});

test("the template passes the client's settings only when given, so each has its default", () => {
  for (const [param, env] of [
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

test('the template sets none of the settings this server no longer reads, nor their secret', () => {
  for (const name of config.RETIRED_SETTINGS)
    assert.doesNotMatch(template, new RegExp(`name: '${name}'`), name);
  assert.doesNotMatch(template, /typesense/i);
});

test('with Ansattporten the template passes its settings, the secret as a secret, and keeps sessions sticky', () => {
  for (const name of [
    'ANSATTPORTEN_ISSUER',
    'ANSATTPORTEN_CLIENT_ID',
    'ANSATTPORTEN_REDIRECT_URI',
    'ANSATTPORTEN_AUDIENCE',
    'ANSATTPORTEN_ALTINN_RESOURCE',
  ])
    assert.match(template, new RegExp(`name: '${name}', value: `));
  assert.match(
    template,
    /name: 'ANSATTPORTEN_CLIENT_SECRET', secretRef: 'ansattporten-client-secret'/,
  );
  assert.match(template, /name: 'AUTH_MODE', value: authMode/);
  assert.match(template, /affinity: ansattporten \? 'sticky' : 'none'/);
  assert.match(template, /maxReplicas: ansattporten \? 1 : 3/);
  assert.equal(defaultOf('authMode'), 'entra');
});

test("the image holds the client's build and names it, and nothing of the previous client", () => {
  assert.match(
    dockerfile,
    /COPY --from=build \/app\/apps\/web-next\/dist apps\/web-next\/dist/,
  );
  assert.match(dockerfile, /^ENV WEB_NEXT_ROOT=\.\/apps\/web-next\/dist$/m);
  assert.doesNotMatch(dockerfile, /apps\/web\//);
  assert.doesNotMatch(dockerfile, /WEB_ROOT=|^ENV KA_NEXT/m);
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
