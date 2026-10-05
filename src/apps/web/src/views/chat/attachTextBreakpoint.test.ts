/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Grensen der setningen på binderset tas av skjermen.
 *
 * «Snart kan du laste opp dokumenter her» setter 334 px ved `md` og 16 px rot,
 * og raden trenger 472 px boks for å holde den ved siden av sendeknappen.
 * Under det brøt den over tre–fire linjer og boksen vokste fra 162 px til 226
 * på 440 og 245 på 390, så CSS-en skjuler den under en grense (#195).
 *
 * Grensen sto i piksler, og det holdt bare så lenge teksten gjorde det. En
 * leser som skrur teksten opp til 20 px rot får en setning 25 % bredere, mens
 * en pikselgrense blir stående — og da brøt raden igjen på 768, på en boks
 * pikselregelen kalte bred nok (KA CC på #195, kan 1).
 *
 * Denne testen leser CSS-en, fordi det ikke finnes noe annet sted å lese den:
 * jsdom regner ikke ut container-spørringer, så en test som rendrer
 * komponenten ville sagt ja til begge enhetene. Målt i Chromium med setningen
 * på skjermen, tre rotstørrelser og fem flater, etter endringen: én linje
 * overalt der den vises, og skjult ellers. Ved 20 px rot og 768 er boksen 28,6
 * rem, altså under grensen, og det var nettopp der pikselversjonen brøt.
 *
 * Fila leses med `node:fs` og ikke med `?raw`: vitest stubber CSS-importer, så
 * `?raw` gir en tom streng her. Node-typene er hentet inn for denne ene fila
 * med en `reference`-linje, ikke i `tsconfig.app.json`, så resten av `src/`
 * fortsatt ikke kan bruke node-API-er.
 */
/** Fra rota av repoet, som er der vitest kjører fra. */
const css = readFileSync('src/views/chat/chat.css', 'utf8');

/** `@container ka-composer (max-width: 30rem)` og alt som står i den. */
const query =
  /@container\s+ka-composer\s*\(\s*max-width:\s*([\d.]+)(px|rem|em)\s*\)\s*\{([\s\S]*?)\n\}/.exec(
    css,
  );

describe('grensen for setningen på binderset', () => {
  it('finnes, og er den som skjuler setningen', () => {
    expect(query, 'fant ingen container-spørring på .ka-composer').not.toBeNull();
    expect(query?.[3]).toContain('.ka-composer__attach-text');
  });

  it('er skrevet i rem, så den følger tekststørrelsen', () => {
    // `rem` i en container-spørring løses mot ROTA, ikke mot containeren, så
    // enheten er ikke sirkulær selv om boksen selv er en container.
    expect(query?.[2]).toBe('rem');
  });

  it('er 30rem, som er de målte 472 px med margin ved 16 px rot', () => {
    expect(Number(query?.[1])).toBe(30);
  });
});
