import assert from 'node:assert/strict';
import { before, test } from 'node:test';

process.env.DIGDIR_API_KEY = 'service-key';
delete process.env.KA_TESTERS;
delete process.env.KA_EXCERPT_ENVIRONMENT;

let backend: typeof import('./backend.ts');
before(async () => {
  backend = await import('./backend.ts');
});

test('without a token the service key and X-User-Id go, as before', () => {
  assert.deepEqual(backend.backendHeaders({ userId: 'u1' }), {
    'X-API-Key': 'service-key',
    'X-User-Id': 'u1',
  });
  assert.deepEqual(backend.appHeaders({ userId: 'u1' }), { 'X-API-Key': 'service-key' });
});

test('with KA_TESTERS unset no call carries GenAI-Environment, as before', () => {
  for (const caller of [{ userId: 'u1' }, { userId: 'u1', token: 'tok' }, { userId: '' }]) {
    assert.equal('GenAI-Environment' in backend.backendHeaders(caller), false);
    assert.equal('GenAI-Environment' in backend.appHeaders(caller), false);
  }
});

test('ignores the trial when KA_EXCERPT_ENVIRONMENT is not set, so a trial header changes nothing', () => {
  for (const caller of [{ userId: 'u1' }, { userId: 'u1', token: 'tok' }]) {
    const asked = backend.withExcerptTrial(caller, '1');
    assert.deepEqual(asked, caller);
    assert.deepEqual(backend.backendHeaders(asked), backend.backendHeaders(caller));
    assert.equal(
      'GenAI-Environment' in backend.backendHeaders({ ...caller, excerptTrial: true }),
      false,
    );
  }
});

test("with a token only the person's token goes, and the organisation when one was chosen", () => {
  assert.deepEqual(backend.backendHeaders({ userId: 'u1', token: 'tok' }), {
    Authorization: 'Bearer tok',
  });
  assert.deepEqual(backend.appHeaders({ userId: 'u1', token: 'tok', actingFor: '991825827' }), {
    Authorization: 'Bearer tok',
    'GenAI-Acting-For': '991825827',
  });
});

test("genki's refusals are known by problem type, and anything else is not", async () => {
  const refusal = (status: number, type: string) =>
    new Response(JSON.stringify({ type }), { status });
  assert.equal(
    (await backend.knownProblem(refusal(403, 'urn:genai:problem:locked-environment')))?.code,
    'locked_environment',
  );
  assert.equal(
    (await backend.knownProblem(refusal(403, 'urn:genai:problem:entra-not-trusted')))?.code,
    'entra_not_trusted',
  );
  assert.equal(await backend.knownProblem(refusal(403, 'about:blank')), undefined);
  assert.equal(
    await backend.knownProblem(refusal(500, 'urn:genai:problem:locked-environment')),
    undefined,
  );
});
