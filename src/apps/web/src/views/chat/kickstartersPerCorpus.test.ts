import { describe, expect, it } from 'vitest';
import { MOCK_CORPUS } from '../../api/corpus';
import { GENERAL_KICKSTARTERS, KICKSTARTERS, kickstartersFor } from './text';

/**
 * The suggestions on the empty state follow the corpus (user view 5, finding 2).
 *
 * The three Kudos questions stood over every corpus, also over 351 Wikipedia
 * articles that can answer none of them. That is not a claim that reads oddly,
 * it is an invitation to ask three questions the corpus cannot answer.
 */
describe('kickstartersFor', () => {
  it('gives the Kudos questions to the mock corpus', () => {
    // Mock answers from the 938 Kudos documents the questions name.
    expect(kickstartersFor('mock')).toEqual(KICKSTARTERS);
  });

  it('gives the general questions to kudos-pilot, despite the name', () => {
    /*
     * Measured live by KA CC on #111, and the reason this test exists: the
     * pilot is called Kudos and mock IS Kudos, so they looked like one case.
     * But the pilot is five annual reports from 2025, from other agencies than
     * the ones the questions name. «DSS sine årsrapporter» came back as «cannot
     * find DSS» without sources, while the general three got real answers.
     */
    expect(kickstartersFor('kudos-pilot')).toEqual(GENERAL_KICKSTARTERS);
  });

  it("keeps to the mock corpus's actual key", () => {
    /*
     * The key is written out here and owned by src/api/corpus.ts. This
     * assertion is the whole link: if the corpus is renamed there, this turns
     * red instead of mock silently falling back to the general suggestions.
     */
    expect(kickstartersFor(MOCK_CORPUS.key)).toEqual(KICKSTARTERS);
  });

  it('gives the general questions to norquad-docs', () => {
    expect(kickstartersFor('norquad-docs')).toEqual(GENERAL_KICKSTARTERS);
  });

  it('gives the general questions to a key nobody has written a list for', () => {
    // The safe direction to be wrong in: a general question over Kudos still
    // works, a Kudos question over Wikipedia does not.
    expect(kickstartersFor('et-korpus-som-kommer-senere')).toEqual(GENERAL_KICKSTARTERS);
  });

  it('gives the general questions when no key is set', () => {
    expect(kickstartersFor(undefined)).toEqual(GENERAL_KICKSTARTERS);
  });

  it('asks about the documents and not about anything in them', () => {
    /*
     * That is what makes the general three general. If one of them names a
     * subject, it is the same mistake one corpus further on, so the test keeps
     * them from gathering content over time.
     */
    expect(GENERAL_KICKSTARTERS).toHaveLength(3);
    for (const question of GENERAL_KICKSTARTERS) {
      expect(question, question).not.toMatch(/Kudos|Digdir|Udir|DSS|årsrapport|tildelingsbrev/iu);
      // Whole questions, not half ones: the button is read before it is picked.
      expect(question, question).not.toMatch(/…|\.\.\./u);
    }
  });

  it('names the collection in each general question when its name is known', () => {
    expect(kickstartersFor('kudos', 'Kudos')).toEqual([
      'Hva handler dokumentene i Kudos om?',
      'Gi meg en oversikt over de viktigste temaene i Kudos.',
      'Oppsummer det viktigste i Kudos i noen få punkter.',
    ]);
  });

  it('never asks about «denne samlingen» once the collection has a name', () => {
    // genki does not tell the model which collection it searches, so it asked back (12.11).
    for (const question of kickstartersFor('kudos', 'Kudos'))
      expect(question, question).not.toMatch(/denne samlingen/iu);
  });

  it('keeps the questions of a corpus with its own list, even with a name', () => {
    expect(kickstartersFor('mock', 'Kudos')).toEqual(KICKSTARTERS);
  });
});
