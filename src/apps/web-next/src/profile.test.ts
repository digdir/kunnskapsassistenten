import { describe, expect, it } from 'vitest';
import { profileFor } from './profile';

const ME = {
  name: 'Testperson',
  signOut: '/auth/logout',
  model: 'kunnskapsassistenten__default',
  service: 'kunnskapsassistenten',
  tenant: 'digdir',
  writes: true,
};

describe('the suggestions', () => {
  const profile = profileFor(ME);
  const collection = profile.corpora?.kudos?.label ?? '';

  it('name the collection, because the model is not told which one it searches', () => {
    expect(collection).toBe('Kudos');
    expect(profile.suggestions).toHaveLength(3);
    for (const question of profile.suggestions ?? []) expect(question).toContain(collection);
  });

  it('never ask about «denne samlingen», which the model asks back about', () => {
    for (const question of profile.suggestions ?? [])
      expect(question).not.toMatch(/denne samlingen/i);
  });
});
