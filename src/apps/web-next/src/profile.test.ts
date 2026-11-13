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

describe('the experiments', () => {
  it('offer the narrower filter beside the threads, under the id genki’s assembly reads', () => {
    const narrower = profileFor(ME).experiments?.find(({ id }) => id === 'compact-filter');
    expect(narrower?.title).toBe('Smalere filter');
    expect(narrower?.description).toBe('Filteret tar mindre plass, og tråder får resten.');
  });

  it('describe the gathered chips by the case they still try, many values, since all is one chip without them', () => {
    const gathered = profileFor(ME).experiments?.find(
      ({ id }) => id === 'compact-filter-chips',
    );
    expect(gathered?.description).toBe(
      'Når mange verdier er valgt, står én merkelapp, som «12 virksomheter».',
    );
  });
});
