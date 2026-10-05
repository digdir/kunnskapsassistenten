import { beforeEach, describe, expect, it } from 'vitest';
import { threadFromQuestion } from '../../model';
import { MockChatClient, mockSpeeds } from './index';
import { resetMockThreads } from './sessionThreads';

/**
 * Mocken navngir sine egne samtaler, som backenden gjør.
 *
 * Den gjorde det ikke: den lagret under id-en SKALLET fant på, så mock og
 * live var uenige om nøyaktig det som var ødelagt — hvem som eier
 * identiteten — og ingen test kunne se det. Adressen i live navnga en samtale
 * ingen kunne åpne, i en uke (brukerblikk 8).
 */
beforeEach(() => {
  sessionStorage.clear();
  resetMockThreads();
});

const client = () => new MockChatClient(mockSpeeds.fast);

describe('MockChatClient.createThread', () => {
  it('gir en annen id enn den skallet fant på', async () => {
    const standIn = threadFromQuestion('Hva rapporterer Nkom?');

    const real = await client().createThread(standIn);

    expect(real.id).not.toBe(standIn.id);
    expect(real.id).toMatch(/^mock-conv-/);
    expect(real.conversationId).toBe(real.id);
  });

  it('beholder alt annet stedfortrederen bar', async () => {
    // Tittelen er spørsmålet leseren stilte, og korpuset er det som ble spurt.
    const standIn = { ...threadFromQuestion('Hva rapporterer Nkom?'), corpusKey: 'mock' };

    const real = await client().createThread(standIn);

    expect(real.title).toBe('Hva rapporterer Nkom?');
    expect(real.titleFromQuestion).toBe(true);
    expect(real.corpusKey).toBe('mock');
    expect(real.createdAt).toBe(standIn.createdAt);
  });

  it('gir to tråder hver sin id', async () => {
    const mock = client();

    const first = await mock.createThread(threadFromQuestion('Første'));
    const second = await mock.createThread(threadFromQuestion('Andre'));

    expect(first.id).not.toBe(second.id);
  });

  it('lagrer turen under sin egen id, ikke stedfortrederens', async () => {
    // Det er dette gjenåpning står og faller på: lageret og adressen må være
    // enige om hva tråden heter.
    const mock = client();
    const standIn = threadFromQuestion('Hva rapporterer Nkom?');
    const real = await mock.createThread(standIn);

    mock.openThread(real);

    expect(await mock.getThread(real.id)).not.toBeNull();
    expect(await mock.getThread(standIn.id)).toBeNull();
  });
});
