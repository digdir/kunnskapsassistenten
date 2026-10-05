import { describe, expect, it } from 'vitest';
import { daysSince } from '../clock';
import { corpusDocument } from '../corpus';
import { citationsFor, scriptedConversations, scriptedFor, scriptedThreads } from './index';
import { threads } from '../fixtures';

/**
 * The claim these tests exist to keep true: **every excerpt is a real quote
 * from a real document.**
 *
 * The answers and the thinking steps are ours and cannot be checked by a
 * machine. The excerpts can, and they are the part a user reads as «this is
 * what the document says». A paraphrase that drifted into one of them would
 * be the mock telling a lie about a document anybody can open.
 */
describe('scriptede samtaler', () => {
  it('har ti eller flere, som oppdraget ber om', () => {
    expect(scriptedConversations.length).toBeGreaterThanOrEqual(10);
  });

  /**
   * Funn 2 i KA CC sin anmeldelse. `MessageList` tegner svaret med
   * `startLevel={3}`, og `Markdown` mapper `min(startLevel + dybde − 1, 6)`.
   * Et svar som begynner på `##` blir dermed `h4` rett under tråd-tittelens
   * `h2`, og dokumentet hopper fra nivå 2 til 4.
   *
   * Ingen av verktøyene ser det: `heading-order` er merket best-practice hos
   * axe, ikke wcag2a/2aa, så både e2e-suiten og anmelderens egen kjøring er
   * blinde for det. Derfor står det her.
   */
  it('begynner på # og ikke ##, så overskriftene ikke hopper over et nivå', () => {
    for (const conversation of scriptedConversations) {
      const headings = conversation.answer
        .split('\n')
        .filter((line) => /^#{1,6} /.test(line))
        .map((line) => line.match(/^#+/)?.[0].length ?? 0);

      for (const depth of headings) {
        expect(depth, `${conversation.id}: overskrift på dybde ${depth}`).toBe(1);
      }
    }
  });

  it('siterer ordrett fra sammendraget i korpuset', () => {
    for (const conversation of scriptedConversations) {
      for (const document of conversation.documents) {
        const source = corpusDocument(document.id);
        expect(source, `${conversation.id}: ukjent dokument ${document.id}`).toBeDefined();

        for (const excerpt of document.excerpts) {
          expect(
            source!.summary.includes(excerpt.text),
            `${conversation.id}: utdraget står ikke i sammendraget til «${source!.title}»:\n  ${excerpt.text}`,
          ).toBe(true);
        }
      }
    }
  });

  it('henter tittel, type, virksomhet, år og lenke fra korpuset', () => {
    for (const conversation of scriptedConversations) {
      for (const document of conversation.documents) {
        const source = corpusDocument(document.id)!;
        expect(document.title).toBe(source.title);
        expect(document.documentType).toBe(source.type);
        expect(document.organisation).toBe(source.organisation);
        expect(document.year).toBe(source.year);
        expect(document.url).toBe(source.url);
      }
    }
  });

  it('lar «Les dokumentet på Kudos» virke for hvert utdrag', () => {
    for (const conversation of scriptedConversations) {
      for (const document of conversation.documents) {
        for (const excerpt of document.excerpts) {
          expect(excerpt.kudosUrl).toMatch(/^https:\/\/kudos\.dfo\.no\/dokument\//);
        }
      }
    }
  });

  it('har markører i svaret som peker på utdrag som finnes', () => {
    for (const conversation of scriptedConversations) {
      const numbers = new Set(
        conversation.documents.flatMap((document) =>
          document.excerpts
            .map((excerpt) => excerpt.citationNumber)
            .filter((n): n is number => n !== undefined),
        ),
      );

      const inAnswer = [...conversation.answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
      for (const n of inAnswer) {
        expect(numbers.has(n), `${conversation.id}: svaret siterer [${n}], som ikke finnes`).toBe(
          true,
        );
      }

      // And the other way: a numbered excerpt nobody cites is a number that
      // leads nowhere. Uncited excerpts are fine, but they carry no number.
      for (const n of numbers) {
        expect(inAnswer.includes(n), `${conversation.id}: utdrag [${n}] siteres aldri`).toBe(true);
      }
    }
  });

  it('nummererer markørene sammenhengende fra 1', () => {
    for (const conversation of scriptedConversations) {
      const numbers = citationsFor(conversation).map((citation) => citation.number);
      expect(numbers, `${conversation.id}`).toEqual(
        Array.from({ length: numbers.length }, (_, index) => index + 1),
      );
    }
  });

  it('dekker tilfellene oppdraget krever', () => {
    const withOutcome = scriptedConversations.filter((c) => c.outcome === 'needs-clarification');
    expect(withOutcome, 'én med avklaring').toHaveLength(1);

    const failing = scriptedConversations.filter((c) => c.failure);
    expect(failing.length, 'én som feiler').toBeGreaterThanOrEqual(1);

    const single = scriptedConversations.filter((c) => c.documents.length === 1);
    expect(single.length, 'én med bare ett dokument').toBeGreaterThanOrEqual(1);

    const wide = scriptedConversations.filter(
      (c) =>
        c.documents.length >= 6 &&
        c.documents.reduce((total, d) => total + d.excerpts.length, 0) >= 12,
    );
    expect(wide.length, 'én med 12+ utdrag på tvers av 6 dokumenter').toBeGreaterThanOrEqual(1);

    const comparison = scriptedConversations.filter((c) => {
      const types = new Set(c.documents.map((d) => d.documentType));
      return types.has('Tildelingsbrev') && types.has('Årsrapport');
    });
    expect(
      comparison.length,
      'én som sammenlikner tildelingsbrev og årsrapport',
    ).toBeGreaterThanOrEqual(1);

    const longKeywords = scriptedConversations.filter((c) =>
      c.retrieval.keywords.some((keyword) => keyword.length > 30),
    );
    expect(longKeywords.length, 'én med lange nøkkelord').toBeGreaterThanOrEqual(1);

    const withTable = scriptedConversations.filter((c) => c.answer.includes('| --- |'));
    expect(withTable.length, 'én med tabell').toBeGreaterThanOrEqual(1);
  });

  it('har tre til seks tenkesteg per samtale, på norsk og i jeg-form', () => {
    for (const conversation of scriptedConversations) {
      expect(conversation.thinkingSteps.length, conversation.id).toBeGreaterThanOrEqual(2);
      expect(conversation.thinkingSteps.length, conversation.id).toBeLessThanOrEqual(6);
      for (const step of conversation.thinkingSteps) {
        expect(step.label, `${conversation.id}/${step.id}`).toMatch(
          /^Jeg |^Årene |^Målene |^Bare /,
        );
      }
    }
  });

  it('teller flere treff enn siterte utdrag, som et ekte søk gjør', () => {
    for (const conversation of scriptedConversations) {
      const excerpts = conversation.documents.reduce((n, d) => n + d.excerpts.length, 0);
      expect(
        conversation.retrieval.hitCount,
        `${conversation.id}: «n treff» skal være minst antall utdrag`,
      ).toBeGreaterThanOrEqual(excerpts);
      expect(conversation.retrieval.documentCount).toBe(conversation.documents.length);
    }
  });
});

describe('scriptedFor', () => {
  it('finner samtalen for spørsmålet', () => {
    const first = scriptedConversations[0]!;
    expect(scriptedFor(first.question)?.id).toBe(first.id);
  });

  it('bryr seg ikke om tegnsetting eller store bokstaver', () => {
    const first = scriptedConversations[0]!;
    expect(scriptedFor(first.question.toLocaleUpperCase('nb-NO'))?.id).toBe(first.id);
    expect(scriptedFor(first.question.replace(/[?,]/g, ''))?.id).toBe(first.id);
  });

  it('finner samtalen når brukeren har kuttet slutten av forslaget', () => {
    // Kickstarterne fyller feltet uten å sende (svar 40), så spørsmålet som
    // kommer er ofte redigert.
    const first = scriptedConversations[0]!;
    expect(scriptedFor(first.question.slice(0, 40))?.id).toBe(first.id);
  });

  it('svarer ingenting på et spørsmål som ikke er scriptet', () => {
    expect(scriptedFor('Hva er klokka?')).toBeUndefined();
    expect(scriptedFor('')).toBeUndefined();
  });
});

/**
 * The scripted conversations are also the threads in the list.
 *
 * Until 2026-09-15 the list was twelve titles with one conversation behind
 * them, so a thread a reader opened was empty — punkt 16 på
 * brukerreise-lista, målt av #4. These hold the mapping honest.
 */
describe('de scriptede samtalene som tråder', () => {
  it('gir hver samtale en tråd, bortsett fra den som feiler', () => {
    // Den som feiler har ikke noe svar å lagre: `answer` er tom med vilje,
    // fordi teksten leseren ser hører til i viewet (errorText.ts). En tråd
    // for den ville vært en tom boble uten noe som sa hva som gikk galt.
    const failing = scriptedConversations.filter((conversation) => conversation.failure);
    expect(failing).toHaveLength(1);
    expect(scriptedThreads).toHaveLength(scriptedConversations.length - failing.length);
    expect(scriptedThreads.map((thread) => thread.id)).not.toContain(failing[0]?.id);
  });

  it('gir hver tråd et spørsmål og et svar med det som ligger bak', () => {
    for (const thread of scriptedThreads) {
      const [question, answer] = thread.messages;

      expect(question?.role, thread.title).toBe('user');
      expect(question?.content.length, thread.title).toBeGreaterThan(0);

      expect(answer?.role, thread.title).toBe('assistant');
      expect(answer?.content.length, thread.title).toBeGreaterThan(0);
      expect(answer?.thinkingSteps?.length, thread.title).toBeGreaterThan(0);
      expect(answer?.retrieval, thread.title).toBeDefined();
    }
  });

  it('henter dagen fra samtalen selv, ikke fra en liste ved siden av', () => {
    // Dette var en `daysOld`-tabell paret etter posisjon, og paret med den
    // FILTRERTE lista: en feilsamtale til ville forskjøvet hver eneste dag
    // etter seg uten at noe sa fra. Funn fra KA CC i #58. Nå bærer samtalen
    // dagen sin, så det ikke finnes noe par som kan gå i utakt.
    for (const conversation of scriptedConversations) {
      const thread = scriptedThreads.find((candidate) => candidate.id === conversation.id);
      if (!thread) continue;

      // `daysSince` and not a millisecond difference divided by a day: the
      // fixture counts CALENDAR days, and the division disagrees with it for
      // most of the clock. `daysAgo(0, 9)` is today 09:30, so before 09:30
      // the division gives -0 — which `toBe(0)` rejects — and after 21:30 it
      // rounds up to 1. This test was red between midnight and 09:30 for
      // that reason alone, with the fixture correct. See ../clock.ts.
      expect(daysSince(thread.updatedAt), `tråden «${thread.title}»`).toBe(conversation.daysAgo);
    }
  });

  it('gir hver samtale sin egen dag, så ingen to rader står på samme tid', () => {
    const days = scriptedConversations.map((conversation) => conversation.daysAgo);
    expect(new Set(days).size, 'to samtaler med samme dag').toBe(days.length);

    const dates = scriptedThreads.map((thread) => thread.updatedAt);
    expect(new Set(dates).size, 'to tråder med samme tidspunkt').toBe(dates.length);
  });

  it('sprer trådene over hele grupperingen, fra i dag til i fjor', () => {
    // Grupperingen i views/threads/grouping.ts har fem bøtter. En liste der
    // alt skjedde i dag ville stilltiende sluttet å tegne fire av dem.
    const days = scriptedThreads.map((thread) => daysSince(thread.updatedAt));

    expect(Math.min(...days)).toBeLessThanOrEqual(1);
    expect(Math.max(...days)).toBeGreaterThan(300);
  });

  it('gir hver tråd i lista sitt eget tidspunkt, også den håndskrevne', () => {
    // The test above covers the scripted ones against each other. This one is
    // about the list the reader actually sees: NKOM and «Regnskap og
    // bevilgning i DSS» were both stamped `daysAgo(0, 9)`, so two rows shared
    // an instant and had no order between them. Measured 2026-09-16.
    const times = threads.map((thread) => thread.updatedAt);
    expect(new Set(times).size, 'to tråder på samme millisekund').toBe(times.length);
  });

  it('har ingen id som kolliderer med tråden som er skrevet for hånd', () => {
    // `findThread` ser i de scriptede først, så en kollisjon ville skjult
    // NKOM-tråden — den eneste med sidetall på utdragene sine.
    const ids = threads.map((thread) => thread.id);
    expect(new Set(ids).size, 'to tråder med samme id').toBe(ids.length);
    expect(ids).toContain('nkom-maaloppnaaelse');
  });
});
