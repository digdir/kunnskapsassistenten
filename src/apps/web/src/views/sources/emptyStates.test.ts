import { describe, expect, it } from 'vitest';
import type { MessageStatus } from '../../model';
import { emptyStateFor, noAnswerYet } from './emptyStates';

const WITH_AN_ANSWER: Exclude<MessageStatus, 'streaming'>[] = [
  'complete',
  'aborted',
  'error',
  'needs-clarification',
];

describe('emptyStateFor', () => {
  it('never tells a reader who has asked a question that they have not', () => {
    // The bug this file exists to prevent: every one of these states follows a
    // question the user actually asked.
    for (const status of WITH_AN_ANSWER) {
      expect(emptyStateFor(status).description).not.toContain('når du har stilt et spørsmål');
    }
  });

  it('says that a stopped answer was stopped', () => {
    expect(emptyStateFor('aborted').title).toBe('Svaret ble avbrutt før kildene kom');
  });

  it('skiller et svar uten siteringer fra ett som mistet utdragene sine', () => {
    /*
     * Live-modus, målt 2026-09-16: backenden lagrer samtalen, men ikke
     * chunkene bak den. En tråd åpnet fra lista har da et svar med [1]–[4] i
     * seg og ingenting bak dem, og «Svaret viser ikke til noen utdrag fra
     * dokumentene» er en setning leseren kan motbevise ved å se på svaret ved
     * siden av.
     */
    expect(emptyStateFor('complete', 4).title).toBe('Kildene er ikke lagret for denne samtalen');
    expect(emptyStateFor('complete', 0).title).toBe('Ingen kilder til dette svaret');
  });

  it('sier det samme som før når ingen har talt siteringene', () => {
    // Chatviewet sender ikke tallet ennå. Til det gjør det, skal ordene være
    // uendret — et hull i det som er kjent er ikke et funn om svaret.
    expect(emptyStateFor('complete').title).toBe(emptyStateFor('complete', 0).title);
  });

  it('lar bare et ferdig svar miste utdrag', () => {
    // Et avbrutt eller feilet svar har sin egen forklaring, og den er riktigere:
    // kildene kom aldri, de ble ikke borte.
    expect(emptyStateFor('aborted', 4).title).toBe('Svaret ble avbrutt før kildene kom');
    expect(emptyStateFor('error', 4).title).toBe('Svaret kom ikke fram');
  });

  it('gives every state its own words', () => {
    const titles = WITH_AN_ANSWER.map((status) => emptyStateFor(status).title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles).not.toContain(noAnswerYet('Kudos').title);
  });

  it('lover ikke det samme som den avbrutte, siden det ikke er det samme', () => {
    /*
     * Andre setning var ordrett den avbrutte sin — «for å se hvilke
     * dokumenter det bygger på» — og det er feil løfte her. Den avbrutte fikk
     * aldri kilder; denne fikk dem og mistet dem, og et nytt spørsmål gir
     * ikke bare innsyn i de gamle, det gir utdrag som faktisk kan åpnes.
     * Funnet av #4 i anmeldelsen av #84.
     */
    const notStored = emptyStateFor('complete', 4);

    expect(notStored.description).not.toBe(emptyStateFor('aborted').description);
    expect(notStored.description).toContain('kilder du kan åpne');
  });
});

describe('noAnswerYet', () => {
  it('navngir korpuset leseren står i, ikke alltid Kudos', () => {
    // «et dokument på Kudos» over en NorQuAD-installasjon er et falskt løfte
    // om hva leseren er i ferd med å søke i (KA CC på #139).
    expect(noAnswerYet('Wikipedia (NorQuAD)').description).toContain(
      'et dokument på Wikipedia (NorQuAD)',
    );
    expect(noAnswerYet('Kudos-pilot').description).toContain('et dokument på Kudos-pilot');
  });

  it('bruker det valgte korpuset, for det finnes ikke noe svar å lese fra', () => {
    // Det er nettopp det denne tilstanden er: ingen har spurt ennå. Dette er
    // det ene stedet i panelet der velgeren er riktig kilde.
    expect(noAnswerYet('Kudos').description).toContain('når du har stilt et spørsmål');
  });

  it('holder tittelen fast uansett korpus', () => {
    expect(noAnswerYet('Wikipedia (NorQuAD)').title).toBe(noAnswerYet('Kudos').title);
  });
});
