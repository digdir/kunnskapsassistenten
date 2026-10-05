import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ThinkingStep } from '../../model';
import { ThinkingPanel } from './ThinkingPanel';

/*
 * Designsystemet sin Spinner går gjennom useSynchronizedAnimation, som spør
 * document.getAnimations; jsdom har ingen Web Animations. Lokalt i denne fila:
 * bare «Tenker …»-sammendraget tegner en Spinner.
 */
if (typeof document.getAnimations !== 'function') {
  document.getAnimations = () => [];
}

/**
 * Søkestrengene i tenkesteget (KA CC, 16.09).
 *
 * `queries` har ligget i modellen, i mocken og i live-klienten hele tiden, og
 * ingen visning tegnet feltet. Så «Jeg søker i korpuset» sto uten å si etter
 * hva.
 */
const searchStep: ThinkingStep = {
  id: 's1',
  kind: 'search',
  label: 'Jeg søker i årsrapportene.',
  queries: ['DSS årsrapport 2022', 'årsregnskap bevilgning'],
  durationMs: 2410,
};

const plainStep: ThinkingStep = {
  id: 's2',
  kind: 'reasoning',
  label: 'Jeg deler spørsmålet i to.',
};

const queryList = () => screen.getByRole('list', { name: 'Søkte etter:' });

describe('søkestrengene i tenkesteget', () => {
  it('viser hva det ble søkt etter, i den rekkefølgen søkene gikk', () => {
    render(<ThinkingPanel status="thinking" steps={[searchStep]} />);

    // Lead-in-teksten er synlig og ikke bare et navn på lista: chips uten
    // etikett er ord uten en grunn.
    expect(screen.getByText('Søkte etter:')).toBeTruthy();

    const queries = within(queryList()).getAllByRole('listitem');
    expect(queries.map((item) => item.textContent)).toEqual([
      'DSS årsrapport 2022',
      'årsregnskap bevilgning',
    ]);
  });

  it('tegner ingenting under et steg som ikke søkte', () => {
    render(<ThinkingPanel status="thinking" steps={[plainStep]} />);

    expect(screen.queryByText('Søkte etter:')).toBeNull();
    // Stegene selv står i en liste; den er den eneste her.
    expect(screen.getAllByRole('list')).toHaveLength(1);
  });

  it('gir hvert steg sin egen etikett å peke på', () => {
    /*
     * To søkesteg i samme panel. `aria-labelledby` peker på en id, så to
     * lister med samme id ville fått navn fra den første — og den andre
     * lista ville sagt noe om et søk den ikke hørte til.
     */
    render(
      <ThinkingPanel
        status="thinking"
        steps={[searchStep, { ...searchStep, id: 's3', queries: ['måloppnåelse Nkom'] }]}
      />,
    );

    const lists = screen.getAllByRole('list', { name: 'Søkte etter:' });
    expect(lists).toHaveLength(2);

    const labelIds = lists.map((list) => list.getAttribute('aria-labelledby'));
    expect(new Set(labelIds).size).toBe(2);
    for (const id of labelIds) {
      expect(document.getElementById(id ?? '')?.textContent).toBe('Søkte etter:');
    }
  });
});
