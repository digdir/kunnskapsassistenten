import { describe, expect, it } from 'vitest';
import { fileSize, uploadErrorText } from './uploadText';

describe('fileSize', () => {
  it('skriver størrelsen slik en filutforsker gjør', () => {
    // Desimale enheter, ikke binære: tallet her skal være det samme tallet
    // leseren ser om filen sin i sitt eget operativsystem.
    expect(fileSize(2_400_000)).toBe('2,4 MB');
    expect(fileSize(812_000)).toBe('812 kB');
    expect(fileSize(940)).toBe('940 B');
  });

  it('bruker den største enheten som gir et tall under tusen', () => {
    // Ellers leser en liten fil «0,002 MB», som ingen kjenner igjen.
    expect(fileSize(20 * 1024 * 1024)).toBe('21 MB');
    expect(fileSize(1_500_000_000)).toBe('1,5 GB');
  });

  it('sier ingenting om en størrelse som ikke er et tall', () => {
    expect(fileSize(Number.NaN)).toBe('');
    expect(fileSize(-1)).toBe('');
  });
});

describe('uploadErrorText', () => {
  it('sier hva som er galt, ikke bare at noe er det', () => {
    expect(uploadErrorText('too-large')).toContain('20 MB');
    expect(uploadErrorText('wrong-type')).toContain('PDF');
  });

  it('skiller det leseren kan gjøre noe med fra det de ikke kan', () => {
    // `unavailable` er ikke en feil de har gjort eller kan prøve seg på igjen:
    // det finnes ikke noe endepunkt (A3). «Noe gikk galt» ville sendt dem ut
    // på leting etter en feil som ikke er deres.
    expect(uploadErrorText('failed')).toContain('Prøv igjen');
    expect(uploadErrorText('unavailable')).not.toContain('Prøv igjen');
    expect(uploadErrorText('unavailable')).toContain('ikke tilgjengelig');
  });
});
