import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { pageTitle } from './components';

/**
 * Sidetittelen på hver rute i App.tsx (WCAG 2.4.2).
 *
 * Alle adressene het «Kunnskapsassistenten», tittelen i index.html, så en
 * tråd, endringsloggen og en død lenke var samme side i fanelinja og for en
 * skjermleser. Her måles det som står i `document.title` når ruta er tegnet.
 *
 * Samme to stubber som i App.test.tsx, av samme grunn: hele appen monteres.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
document.getAnimations ??= () => [];

function openAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

// Noe annet enn alle titlene under, så en rute som ikke setter tittelen ikke
// består på tittelen testen før satte.
beforeEach(() => {
  document.title = 'før';
});

describe('sidetittelen', () => {
  it('setter sida først og appen etter', () => {
    expect(pageTitle('Onboarding')).toBe('Onboarding – Kunnskapsassistenten');
    expect(pageTitle()).toBe('Kunnskapsassistenten');
  });

  it('heter «Ny tråd» på forsida', async () => {
    openAt('/');
    await waitFor(() => expect(document.title).toBe('Ny tråd – Kunnskapsassistenten'));
  });

  it('heter som tråden når en tråd er åpen', async () => {
    openAt('/threads/nkom-maaloppnaaelse');
    await waitFor(() => expect(document.title).toBe('NKOM måloppnåelse – Kunnskapsassistenten'));
  });

  it('sier at tråden ikke finnes når den ikke gjør det', async () => {
    openAt('/threads/finnes-ikke');
    await waitFor(() => expect(document.title).toBe('Fant ikke tråden – Kunnskapsassistenten'));
  });

  it.each([
    ['/onboarding', 'Onboarding'],
    ['/endringslogg', 'Endringslogg'],
    ['/om-prosjektet', 'Om prosjektet'],
  ])('heter som informasjonssida på %s', async (path, name) => {
    openAt(path);
    await waitFor(() => expect(document.title).toBe(`${name} – Kunnskapsassistenten`));
  });

  it('sier «Siden finnes ikke» på en adresse som ikke fører noen steder', async () => {
    openAt('/tull');
    await waitFor(() => expect(document.title).toBe('Siden finnes ikke – Kunnskapsassistenten'));
  });
});
