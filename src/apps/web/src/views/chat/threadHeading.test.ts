import { describe, expect, it } from 'vitest';
import type { Message } from '../../model';
import { threadHeading, threadPageTitle } from './threadHeading';

function question(content: string): Message[] {
  return [
    {
      id: 'u1',
      role: 'user',
      content,
      createdAt: '2026-09-15T09:00:00Z',
      citations: [],
      status: 'complete',
    },
    {
      id: 'a1',
      role: 'assistant',
      content: 'Svar.',
      createdAt: '2026-09-15T09:00:01Z',
      citations: [],
      status: 'complete',
    },
  ];
}

describe('threadHeading', () => {
  it('shows a title that says more than the question', () => {
    expect(threadHeading({ title: 'NKOM måloppnåelse' }, question('Hva sier rapporten?'))).toEqual({
      title: 'NKOM måloppnåelse',
      repeatsQuestion: false,
    });
  });

  it('has nothing to head before the first question', () => {
    expect(threadHeading(undefined, [])).toBeUndefined();
  });

  it('stands in with the first sentence, as a label, and marks it a repeat', () => {
    // No question mark: it replaces titles like «NKOM måloppnåelse». And the
    // question is right under it, so the heading is structure only.
    expect(threadHeading(undefined, question('Hva sier rapporten? Og hva med 2023?'))).toEqual({
      title: 'Hva sier rapporten',
      repeatsQuestion: true,
    });
  });

  it('takes the thread at its word when it named itself after the question', () => {
    // `threadFromQuestion` stores the question whole, so the stored title and
    // our first-sentence stand-in are different strings for a question of
    // several sentences. The flag is what decides, not a comparison.
    const named = { title: 'Hva sier rapporten? Og hva med 2023?', titleFromQuestion: true };

    expect(threadHeading(named, question('Hva sier rapporten? Og hva med 2023?'))).toEqual({
      title: 'Hva sier rapporten? Og hva med 2023?',
      repeatsQuestion: true,
    });
  });

  it('draws a title that happens to start like the question', () => {
    expect(
      threadHeading({ title: 'Årsrapport' }, question('Årsrapport for Digdir 2023?'))
        ?.repeatsQuestion,
    ).toBe(false);
  });

  it('stands in for a thread whose title is still empty', () => {
    expect(threadHeading({ title: '  ' }, question('Hva sier rapporten?'))).toEqual({
      title: 'Hva sier rapporten',
      repeatsQuestion: true,
    });
  });

  it('does not break a sentence on a decimal point or a section number', () => {
    expect(threadHeading(undefined, question('Hva står i avsnitt 2.1?'))?.title).toBe(
      'Hva står i avsnitt 2.1',
    );
  });

  it('shortens a long question on a word boundary', () => {
    const long =
      'Hva rapporteres om regnskap, kostnader og bevilgning i DSS sine årsrapporter for 2022 og 2023?';
    const title = threadHeading(undefined, question(long))?.title;

    expect(title?.endsWith(' …')).toBe(true);
    expect(title?.length).toBeLessThanOrEqual(82);
    // Cut between words, never inside one. The « …» stays: it says the title
    // is shortened, which is not what a question mark would have said.
    expect(long.startsWith(title!.slice(0, -2))).toBe(true);
  });

  it('collapses the line breaks a pasted question brings with it', () => {
    expect(threadHeading(undefined, question('Hva sier\n  rapporten'))?.title).toBe(
      'Hva sier rapporten',
    );
  });
});

/*
 * The name in the browser's title (WCAG 2.4.2). The same conversation is one
 * name, whether it is being asked on the front page or opened again from its
 * address, where the stored title is the whole question.
 */
describe('threadPageTitle', () => {
  const asked = 'Hva sier årsrapporten om tilsyn? Og om frekvenser.';

  it('is the first sentence while the question is being asked', () => {
    expect(threadPageTitle(undefined, question(asked))).toBe('Hva sier årsrapporten om tilsyn');
  });

  it('is the same first sentence for a thread named after the question', () => {
    expect(threadPageTitle({ title: asked, titleFromQuestion: true }, question(asked))).toBe(
      'Hva sier årsrapporten om tilsyn',
    );
  });

  it('is a title of the thread’s own as it is', () => {
    expect(threadPageTitle({ title: 'NKOM måloppnåelse' }, question(asked))).toBe(
      'NKOM måloppnåelse',
    );
  });

  it('is nothing before the first question', () => {
    expect(threadPageTitle(undefined, [])).toBeUndefined();
  });
});
