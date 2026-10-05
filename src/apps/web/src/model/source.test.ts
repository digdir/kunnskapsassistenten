import { describe, expect, it } from 'vitest';
import { nkomSources } from '../api/mock/fixtures';
import { citationAccessibleName, citationTargets, excerptDomId } from './source';

describe('citation convention', () => {
  it('builds the same DOM id from both sides', () => {
    expect(excerptDomId(3)).toBe('excerpt-3');
  });

  it('names a marker with document and page', () => {
    expect(citationAccessibleName(3, 'Årsrapport Nkom 2022', 41)).toBe(
      'Kilde 3: Årsrapport Nkom 2022, side 41',
    );
  });

  it('leaves out the page when the document has none', () => {
    expect(citationAccessibleName(5, 'Årsrapport Nkom 2021')).toBe('Kilde 5: Årsrapport Nkom 2021');
  });

  it('collects the cited excerpts in order, across documents', () => {
    const targets = citationTargets(nkomSources);

    expect(targets.map((target) => target.number)).toEqual([1, 2, 3, 4, 5]);
    expect(targets[0].targetId).toBe('excerpt-1');
    expect(targets[0].label).toContain('Årsrapport Nasjonal kommunikasjonsmyndighet');
  });

  it('skips an excerpt the answer never cited', () => {
    const withUncited = [
      {
        ...nkomSources[2],
        excerpts: [{ ...nkomSources[2].excerpts[0], citationNumber: undefined }],
      },
    ];

    expect(citationTargets(withUncited)).toHaveLength(0);
  });
});
