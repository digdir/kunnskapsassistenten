import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { Excerpt } from '../../model';
import { EXCERPT_UNAVAILABLE, SourceExcerpt } from './SourceExcerpt';

/**
 * Et utdrag uten tekst er ikke et tomt utdrag: biten ble hentet, det var
 * teksten som ikke lot seg slå opp. Målt 29.09 mot poden med Typesense nede,
 * der hver kilde kom med tittel og Kudos-lenke og uten `excerpt`.
 *
 * Lukket viser utdraget bare raden med «Utdrag N» og «Åpne», uansett om
 * teksten finnes (issue 86, 30.09). Før sto overskriftsstien og de
 * første linjene der, og da måtte setningen stå der også (KA CC på #182).
 * Nå står den der teksten ellers ville stått: i innholdet, når utdraget er
 * åpnet.
 *
 * `getByText` finner tekst inne i et lukket `<details>` også, fordi jsdom
 * ikke skjuler noe. Påstanden om det lukkede utdraget ser derfor på
 * strukturen: alt utenfor raden skal ligge i innholdet til `details`, som
 * nettleseren skjuler til «Åpne» er trykket.
 *
 * Unntak fra dirigenten for `src/views/sources/`.
 */
function excerptWith(over: Partial<Excerpt> = {}): Excerpt {
  return {
    id: 'utdrag-1',
    citationNumber: 1,
    relevance: 'high',
    text: '',
    textUnavailable: true,
    kudosUrl: 'https://kudos.example/documents/1',
    ...over,
  };
}

function Kort({ excerpt, open: start }: { excerpt: Excerpt; open: boolean }) {
  const [open, setOpen] = useState(start);
  return (
    <SourceExcerpt
      excerpt={excerpt}
      documentTitle="Tildelingsbrev Landbruksdirektoratet 2025"
      corpusName="Kudos"
      position={1}
      total={1}
      open={open}
      onOpenChange={setOpen}
      hits={[]}
      active={false}
    />
  );
}

/** What the browser shows of a closed excerpt: everything but the content. */
function shownClosed(container: HTMLElement): string {
  const box = container.querySelector('.source-excerpt')!;
  const content = box.querySelector('details > :not(summary):not(u-summary)');
  const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  const shown: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!content?.contains(node)) shown.push(node.textContent ?? '');
  }
  return shown.join(' ');
}

describe('et utdrag som ikke lot seg hente', () => {
  it('viser bare raden når det er lukket, som alle utdrag', () => {
    const { container } = render(<Kort excerpt={excerptWith()} open={false} />);

    expect(container.querySelector('.source-excerpt__preview')).toBeNull();
    expect(shownClosed(container)).not.toContain(EXCERPT_UNAVAILABLE);
    expect(shownClosed(container)).toContain('Utdrag 1');
    expect(shownClosed(container)).toContain('Åpne');
  });

  it('sier fra i det åpne kortet, der teksten ellers ville stått', () => {
    render(<Kort excerpt={excerptWith()} open />);

    expect(screen.getByText(EXCERPT_UNAVAILABLE)).toBeTruthy();
  });

  it('merkes som noe annet enn et sitat, så den ikke leses som tekst fra dokumentet', () => {
    const { container } = render(<Kort excerpt={excerptWith()} open={false} />);

    const sagt = container.querySelector('.source-excerpt__quote--unavailable');
    expect(sagt?.textContent).toBe(EXCERPT_UNAVAILABLE);
  });

  it('rører ikke et utdrag som faktisk har tekst', () => {
    const { container } = render(
      <Kort
        excerpt={excerptWith({
          text: 'Departementet stiller midler til disposisjon.',
          textUnavailable: undefined,
        })}
        open
      />,
    );

    expect(container.querySelector('.source-excerpt__quote')?.textContent).toContain(
      'Departementet stiller midler',
    );
    expect(container.textContent).not.toContain(EXCERPT_UNAVAILABLE);
    expect(container.querySelector('.source-excerpt__quote--unavailable')).toBeNull();
  });
});
