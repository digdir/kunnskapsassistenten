import { expect, it } from 'vitest';

it('loads the playground entry point', async () => {
  await expect(import('./main.ts')).resolves.toBeDefined();
});
