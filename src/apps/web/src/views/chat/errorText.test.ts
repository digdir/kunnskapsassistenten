import { describe, expect, it } from 'vitest';
import type { ChatErrorCode } from '../../model';
import { GENERIC_CHAT_ERROR, chatErrorText, withoutRetryPrompt } from './errorText';

describe('withoutRetryPrompt', () => {
  it('drops the closing «Prøv igjen» and keeps the sentence before it', () => {
    expect(withoutRetryPrompt('Noe gikk galt. Prøv igjen.')).toBe('Noe gikk galt.');
  });

  it('drops «Prøv igjen om litt» too', () => {
    expect(withoutRetryPrompt('Assistenten svarte ikke. Prøv igjen om litt.')).toBe(
      'Assistenten svarte ikke.',
    );
  });

  it('leaves a message that only mentions the words in passing', () => {
    // The button says «Prøv igjen»; «Prøv igjen senere» says something else,
    // and a sentence has to end with the prompt to count as a duplicate.
    const message = 'Tjenesten er nede. Prøv igjen senere i dag.';
    expect(withoutRetryPrompt(message)).toBe(message);
  });

  it('falls back to a message of its own rather than emptying the alert', () => {
    expect(withoutRetryPrompt('Prøv igjen.')).toBe(GENERIC_CHAT_ERROR);
  });

  it('leaves an ordinary message alone', () => {
    expect(withoutRetryPrompt('Du har ikke tilgang til dette korpuset.')).toBe(
      'Du har ikke tilgang til dette korpuset.',
    );
  });
});

/** The cases that reach the alert. `aborted` and `no-hits` never do. */
const SHOWN: ChatErrorCode[] = [
  'model-unavailable',
  'retrieval-unavailable',
  'timeout',
  'unauthorized',
  'rate-limited',
  'question-too-long',
  'thread-not-found',
  'filter-refused',
  'unknown',
];

describe('chatErrorText', () => {
  it('says something different about each case', () => {
    // The whole point of the codes: «Noe gikk galt» covered all eight, so the
    // reader could not tell a model that is down from a rejected key
    // (brukerreiser punkt 12). Headings and texts have to differ, or nothing
    // downstream can.
    const titles = SHOWN.map((code) => chatErrorText({ code }).title);
    const messages = SHOWN.map((code) => chatErrorText({ code }).message);

    expect(new Set(titles).size).toBe(SHOWN.length);
    expect(new Set(messages).size).toBe(SHOWN.length);
  });

  it('says both what happened and what the reader can do', () => {
    for (const code of SHOWN) {
      const { message } = chatErrorText({ code });
      // Two sentences, both of them whole ones: the brief asks for one about
      // what happened and one about what to do next.
      const sentences = message.split(/(?<=[.!?])\s+/u).filter(Boolean);
      expect(sentences.length, code).toBeGreaterThanOrEqual(2);
    }
  });

  it('does not repeat what the button says', () => {
    // `ErrorState` draws the message one line above a button labelled «Prøv
    // igjen» (brukerblikk 2026-09-15, finding 9).
    for (const code of SHOWN) {
      expect(chatErrorText({ code }).message, code).not.toMatch(/Prøv igjen/iu);
    }
  });

  it('offers a retry on the transient cases and not on a rejected key', () => {
    for (const code of ['timeout', 'model-unavailable', 'retrieval-unavailable'] as const) {
      expect(chatErrorText({ code }).retryable, code).toBe(true);
    }
    // The same question with the same key fails the same way.
    expect(chatErrorText({ code: 'unauthorized' }).retryable).toBe(false);
  });

  it('offers no retry on a refused filter, which would send the same filter again', () => {
    const text = chatErrorText({
      code: 'filter-refused',
      message: 'Filteret har mer enn 100 verdier valgt i ett felt.',
    });
    expect(text.retryable).toBe(false);
    expect(text.title).toBe('Filteret kan ikke brukes');
    expect(text.message).toBe(
      'Filteret har mer enn 100 verdier valgt i ett felt. Endre filteret i filterpanelet, og spør på nytt.',
    );
  });

  it('lets the layer that caught it write the first sentence, not the advice', () => {
    const generic = chatErrorText({ code: 'unknown' });
    // What is left of the generic text once its first sentence is taken off.
    const advice = generic.message.slice(GENERIC_CHAT_ERROR.length).trim();

    const withDetail = chatErrorText({
      code: 'unknown',
      message: 'Fikk ikke kontakt med tjenesten.',
    });

    // The first sentence is the one the layer knew; the advice belongs to the
    // case and survives the override, as does the heading.
    expect(withDetail.message).toBe(`Fikk ikke kontakt med tjenesten. ${advice}`);
    expect(withDetail.title).toBe(generic.title);
  });

  it('trims a «Prøv igjen» the layer wrote itself', () => {
    const { message } = chatErrorText({
      code: 'unknown',
      message: 'Kunnskapsassistenten svarte ikke. Prøv igjen.',
    });
    expect(message).toContain('Kunnskapsassistenten svarte ikke.');
    expect(message).not.toMatch(/Prøv igjen/iu);
  });

  it('falls back to the generic text for codes that never come here', () => {
    // Neither reaches the alert today. If one ever does, it has to read as
    // something rather than throw on a missing table entry.
    for (const code of ['aborted', 'no-hits'] as const) {
      expect(chatErrorText({ code }).title, code).toBe(chatErrorText({ code: 'unknown' }).title);
    }
  });
});
