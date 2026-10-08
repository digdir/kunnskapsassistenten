import { describe, expect, test } from 'vitest';
import { corpusDisplayName } from '../../api';
import { sourcesDisclaimer } from './CorpusDisclaimer';

describe('sourcesDisclaimer', () => {
  test('setningen bytter med korpuset', () => {
    // Funnet: linja sa «fra Kudos» over NorQuAD sine Wikipedia-artikler
    // (brukerblikk 6, funn 2).
    expect(sourcesDisclaimer('Wikipedia (NorQuAD)', false)).toBe(
      'All tekst er sitater fra dokumentene fra Wikipedia (NorQuAD). Ikke generert av kunstig intelligens.',
    );
    expect(sourcesDisclaimer('Kudos-pilot', false)).toBe(
      'All tekst er sitater fra dokumentene fra Kudos-pilot. Ikke generert av kunstig intelligens.',
    );
  });

  test('tar med egne dokumenter når det finnes, uansett korpus', () => {
    expect(sourcesDisclaimer('Wikipedia (NorQuAD)', true)).toBe(
      'All tekst er sitater fra dokumentene, både fra Wikipedia (NorQuAD) og fra dine egne dokumenter. Ikke generert av kunstig intelligens.',
    );
  });

  test('setningen om at ingenting er generert står i alle fire', () => {
    // Det er den halvdelen linja finnes for, og den er sann om ethvert korpus.
    for (const name of ['Kudos', 'Wikipedia (NorQuAD)', 'standardkorpuset']) {
      for (const own of [false, true]) {
        expect(sourcesDisclaimer(name, own)).toContain('Ikke generert av kunstig intelligens.');
      }
    }
  });

  test('bruker navnet filterpanelet bruker, også når ingen korpus er kjent', () => {
    // Samme funksjon som overskriften over dokumentlista, så de to ikke kan
    // si hver sin ting om samme korpus.
    expect(sourcesDisclaimer(corpusDisplayName(undefined), false)).toBe(
      'All tekst er sitater fra dokumentene fra standardkorpuset. Ikke generert av kunstig intelligens.',
    );
    expect(
      sourcesDisclaimer(
        corpusDisplayName({ key: 'k', label: 'Kudos, 938 dokumenter (mock)' }),
        false,
      ),
    ).toBe('All tekst er sitater fra dokumentene fra Kudos. Ikke generert av kunstig intelligens.');
  });
});
