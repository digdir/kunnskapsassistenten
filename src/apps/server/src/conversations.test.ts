import assert from 'node:assert/strict';
import { before, test } from 'node:test';

process.env.DIGDIR_API_KEY ??= 'test-key';

let convos: typeof import('./conversations.ts');
before(async () => {
  convos = await import('./conversations.ts');
});

test('fetch failing to reach the backend is backend_unreachable', () => {
  const unreachable = Object.assign(new TypeError('fetch failed'), {
    cause: { code: 'ECONNREFUSED' },
  });
  assert.deepEqual(convos.failure('Kunne ikke hente samtaler.', unreachable), {
    error: 'Kunne ikke hente samtaler.',
    code: 'backend_unreachable',
  });
});

test('a TypeError from our own code is not taken for the backend being down', () => {
  // Such as reading the reply of a backend that answered in another shape.
  const ours = new TypeError("Cannot read properties of undefined (reading 'id')");
  assert.deepEqual(convos.failure('Kunne ikke opprette samtale.', ours), {
    error: 'Kunne ikke opprette samtale.',
  });
});

test('a status from the backend is backend_http_<status>', () => {
  assert.deepEqual(
    convos.failure('Kunne ikke endre navn.', new convos.BackendHttpError('rename', 503)),
    {
      error: 'Kunne ikke endre navn.',
      code: 'backend_http_503',
    },
  );
});
