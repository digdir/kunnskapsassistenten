import { describe, expect, it } from 'vitest';
import { threadFromQuestion } from './thread';

describe('threadFromQuestion', () => {
  const now = new Date('2026-09-15T10:00:00.000Z');

  it('uses the question as the title, whole', () => {
    // Not a first sentence and not a summary. The thread list needs something
    // to name the row, and the user's own words are the only thing that is
    // true until the backend generates a title.
    const thread = threadFromQuestion('Hvordan jobber Nkom med måloppnåelse?', now);

    expect(thread.title).toBe('Hvordan jobber Nkom med måloppnåelse?');
    expect(thread.titleFromQuestion).toBe(true);
  });

  it('keeps a question with several sentences whole', () => {
    // Cutting at the first full stop was tried and rejected: it says what the
    // user already said, and the list can clamp what it draws.
    const question = 'Hva rapporterer DSS? Jeg tenker på regnskapet for 2023.';
    expect(threadFromQuestion(question, now).title).toBe(question);
  });

  it('trims and collapses whitespace, since it comes from a textarea', () => {
    expect(threadFromQuestion('  Hva   er\n  Kudos?  ', now).title).toBe('Hva er Kudos?');
  });

  it('timestamps the thread at the moment it was created', () => {
    const thread = threadFromQuestion('Hei', now);
    expect(thread.createdAt).toBe('2026-09-15T10:00:00.000Z');
    expect(thread.updatedAt).toBe(thread.createdAt);
  });

  it('gives every thread its own id, safe in a URL', () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => threadFromQuestion('Samme spørsmål', now).id),
    );

    expect(ids.size).toBe(50);
    for (const id of ids) expect(encodeURIComponent(id)).toBe(id);
  });
});
