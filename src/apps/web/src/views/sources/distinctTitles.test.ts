import { describe, expect, it } from 'vitest';
import type { SourceDocument } from '../../model';
import { distinctTitles } from './distinctTitles';

const doc = (id: string, title: string): SourceDocument => ({ id, title, excerpts: [] });

describe('distinctTitles', () => {
  it('lar en tittel stå alene når ingen andre i svaret har den', () => {
    const names = distinctTitles([
      doc('1', 'Årsrapport Nkom 2025'),
      doc('2', 'Tildelingsbrev 2026'),
    ]);

    expect([...names.values()]).toEqual(['Årsrapport Nkom 2025', 'Tildelingsbrev 2026']);
  });

  it('gir to dokumenter med samme tittel hvert sitt nummer, som i Kudos-adressen', () => {
    // Målt 05.10: indeksen har «Årsrapport Datatilsynet 2023» som 90777 og
    // 88640. Kudos kaller 90777 «… (DFD)», men det står ikke i indeksen.
    const names = distinctTitles([
      doc('90777', 'Årsrapport Datatilsynet 2023'),
      doc('12', 'Tildelingsbrev 2026'),
      doc('88640', 'Årsrapport Datatilsynet 2023'),
    ]);

    expect(names.get('90777')).toBe('Årsrapport Datatilsynet 2023, dokument 90777');
    expect(names.get('88640')).toBe('Årsrapport Datatilsynet 2023, dokument 88640');
    expect(names.get('12')).toBe('Tildelingsbrev 2026');
  });

  it('gir et dokument samme navn uansett rekkefølgen i svaret', () => {
    // Grunnen til nummeret og ikke «1 av 2»: rekkefølgen kan skifte fra svar
    // til svar, og da ville samme dokument hett forskjellig.
    const a = doc('90777', 'Årsrapport Datatilsynet 2023');
    const b = doc('88640', 'Årsrapport Datatilsynet 2023');

    expect(distinctTitles([a, b]).get('90777')).toBe(distinctTitles([b, a]).get('90777'));
  });

  it('regner titler som like når de bare skiller seg i store bokstaver og mellomrom', () => {
    const names = distinctTitles([
      doc('1', 'Årsrapport Datatilsynet 2023'),
      doc('2', ' årsrapport  Datatilsynet 2023'),
    ]);

    expect(names.get('1')).toBe('Årsrapport Datatilsynet 2023, dokument 1');
    expect(names.get('2')).toBe(' årsrapport  Datatilsynet 2023, dokument 2');
  });

  it('lar et opplastet dokument være, også med samme tittel som et i korpuset', () => {
    // Det har ikke noe nummer i Kudos, og det heter «ditt dokument» fra før.
    const own: SourceDocument = {
      ...doc('doc-egen', 'Årsrapport Datatilsynet 2023'),
      origin: 'user',
    };
    const names = distinctTitles([own, doc('90777', 'Årsrapport Datatilsynet 2023')]);

    expect(names.get('doc-egen')).toBe('Årsrapport Datatilsynet 2023');
    expect(names.get('90777')).toBe('Årsrapport Datatilsynet 2023');
  });
});
