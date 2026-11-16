import { describe, expect, it } from 'vitest';
import { backFrom, canonicalPath, hasKaPages, pageAt, pageFrom } from './paths';

describe('what an address shows', () => {
  it('is the assistant at its own addresses, and KA’s pages at theirs', () => {
    expect(pageAt('/', true)).toBe('assistant');
    expect(pageAt('/innstillinger', true)).toBe('assistant');
    expect(pageAt('/endringslogg', true)).toBe('changelog');
    expect(pageAt('/om-prosjektet', true)).toBe('about');
  });

  it('is «Siden finnes ikke» anywhere else, the previous client’s «Onboarding» included', () => {
    for (const path of ['/onboarding', '/threads', '/endringslogg/x', '/Endringslogg', '/x'])
      expect(pageAt(path, true), path).toBe('not-found');
  });

  it('has none of KA’s pages for another service', () => {
    expect(pageAt('/endringslogg', false)).toBe('not-found');
    expect(pageAt('/om-prosjektet', false)).toBe('not-found');
    expect(pageAt('/', false)).toBe('assistant');
    expect(hasKaPages({ service: 'kunnskapsassistenten' })).toBe(true);
    expect(hasKaPages({ service: 'rapportassistenten' })).toBe(false);
  });

  it('takes a trailing slash as the same address', () => {
    expect(canonicalPath('/innstillinger/')).toBe('/innstillinger');
    expect(canonicalPath('/endringslogg//')).toBe('/endringslogg');
    expect(canonicalPath('/')).toBe('/');
    expect(pageAt('/endringslogg/', true)).toBe('changelog');
  });
});

describe('the way back from KA’s pages', () => {
  it('goes to the thread the person left, through `fra`', () => {
    expect(pageFrom('/endringslogg', '/?t=abc')).toBe('/endringslogg?fra=%2F%3Ft%3Dabc');
    expect(backFrom('?fra=%2F%3Ft%3Dabc')).toBe('/?t=abc');
    expect(backFrom('?fra=%2F')).toBe('/');
  });

  it('goes to the front page for anything else in `fra`, or nothing', () => {
    for (const search of [
      '',
      '?fra=',
      '?fra=%2Finnstillinger',
      '?fra=%2Fendringslogg',
      '?fra=https%3A%2F%2Fevil.example%2F',
      '?fra=%2F%2Fevil.example%2F%3Ft%3Dabc',
      '?fra=%2F%5Cevil.example',
      '?fra=javascript%3Aalert(1)',
      '?fra=%2F%3Ft%3D..%2F..%2Fauth',
      '?fra=%2F%3Ft%3D.hidden',
    ])
      expect(backFrom(search), search).toBe('/');
  });
});
