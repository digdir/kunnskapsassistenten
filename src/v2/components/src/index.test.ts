import { expect, it } from 'vitest';

it('loads the library entry point', async () => {
  await expect(import('./index.ts')).resolves.toBeDefined();
});
