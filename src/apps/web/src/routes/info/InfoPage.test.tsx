import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InfoPage } from './InfoPage';
import { endringsloggParts } from './endringsloggParts';
import { infoPages } from './infoPages';
import { omProsjektetParts } from './omProsjektetParts';
import { onboardingParts } from './onboardingParts';

/**
 * Simens issue 85d: innholdet fra den gamle Kunnskapsassistenten, vist hos
 * oss med typografien fra Designsystemet. Det som måles her, er at teksten kom
 * med, at overskriftene henger sammen, og at det som var brettet sammen i den
 * gamle fortsatt er det.
 */
describe('InfoPage', () => {
  it('gir siden navnet sitt som nivå 1, og innholdet starter på nivå 2', () => {
    render(<InfoPage title="Endringslogg" parts={endringsloggParts} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Endringslogg');
    // Datoene er bolkene i loggen. Ingen av dem får stå som nivå 1 ved siden
    // av sidens eget navn.
    expect(screen.getAllByRole('heading', { level: 2 })[0].textContent).toBe('09.06.2025');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('hopper ikke over et overskriftsnivå på noen av sidene', () => {
    for (const page of infoPages) {
      const { unmount } = render(<InfoPage title={page.title} parts={page.parts} />);

      const levels = screen
        .getAllByRole('heading')
        .map((heading) => Number(heading.tagName.slice(1)));
      for (const [i, level] of levels.entries()) {
        if (i > 0) expect(level).toBeLessThanOrEqual(levels[i - 1] + 1);
      }

      unmount();
    }
  });

  it('beholder lenkene til filmene, som lenker', () => {
    render(<InfoPage title="Onboarding" parts={onboardingParts} />);

    const films = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.includes('vimeo.com'));

    expect(films.map((link) => link.textContent)).toEqual([
      'Oppfølgingsspørsmål i Kunnskapsassistenten 2025',
      'Filtrering i Kunnskapsassistenten',
      'Kilder i Kunnskapsassistenten 2025',
    ]);
  });

  it('lar de lange eksempelsvarene stå sammenbrettet, med hvert sitt navn', () => {
    render(<InfoPage title="Onboarding" parts={onboardingParts} />);

    // A `details` is a group, and so is the scroll box around a table
    // (Markdown.tsx), so only the details are the foldouts.
    const foldouts = screen.getAllByRole('group').filter((group) => group.tagName === 'DETAILS');
    expect(foldouts.map((foldout) => foldout.querySelector('summary')?.textContent)).toEqual([
      'Les svaret på det første spørsmålet',
      'Les svaret på det omformulerte spørsmålet',
    ]);
    // Designsystemet lar Details stå lukket til noen åpner den, og det er
    // hele poenget: svaret er to skjermer langt.
    expect(foldouts.every((foldout) => !foldout.hasAttribute('open'))).toBe(true);
  });

  it('tar med tabellen som en tabell, ikke som løpende tekst', () => {
    render(<InfoPage title="Onboarding" parts={onboardingParts} />);

    const table = screen.getByRole('table');
    // «Formål» er vårt ord. Den gamle lot ruta stå tom, og en tom
    // kolonneoverskrift har ingenting å si til den som ikke ser tabellen.
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Formål', 'Gi en ordre', 'Ha en samtale']);
    expect(within(table).getAllByRole('row')).toHaveLength(5);
  });

  it('har ingen tom kolonneoverskrift i noen tabell', () => {
    for (const page of infoPages) {
      const { unmount } = render(<InfoPage title={page.title} parts={page.parts} />);

      for (const cell of screen.queryAllByRole('columnheader')) {
        expect(cell.textContent?.trim()).not.toBe('');
      }

      unmount();
    }
  });

  it('skiller bolkene i loggen med en linje, som den gamle', () => {
    const { container } = render(<InfoPage title="Endringslogg" parts={endringsloggParts} />);

    // Én mindre enn antall datoer: linja står mellom bolkene.
    const dates = screen.getAllByRole('heading', { level: 2 }).length;
    expect(container.querySelectorAll('hr')).toHaveLength(dates - 1);
  });

  it('tar med hele teksten på den korteste siden', () => {
    render(<InfoPage title="Om prosjektet" parts={omProsjektetParts} />);

    expect(screen.getAllByRole('paragraph')).toHaveLength(6);
    expect(screen.getByText(/KI R&D LAB/)).toBeDefined();
  });

  it('henter ikke inn noe fra den gamle siden utenom teksten', () => {
    const { container } = render(<InfoPage title="Onboarding" parts={onboardingParts} />);

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('[style]')).toBeNull();
  });
});
