import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Clarification } from './Clarification';
import { CLARIFICATION_TAG } from './text';

const question = [
  'Jeg trenger litt mer for å svare godt på dette.',
  '',
  'Mener du måloppnåelsen i årsrapportene, eller målene i tildelingsbrevene [1]?',
].join('\n');

describe('Clarification', () => {
  it('frames the question as a question, in Norwegian', () => {
    render(<Clarification question={question} />);

    expect(screen.getByText(CLARIFICATION_TAG)).toBeTruthy();
    expect(screen.getByText(/Jeg trenger litt mer/u)).toBeTruthy();
  });

  it('leaves a bracketed number as text, because nothing was retrieved', () => {
    render(<Clarification question={question} />);

    // No search ran, so there is no excerpt behind «[1]» to link to.
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/tildelingsbrevene \[1\]/u)).toBeTruthy();
  });

  it('merker spørsmålet med info og ikke med nøytral', () => {
    /*
     * En grå merkelapp ser ut som en etikett på et svar, og dette er ikke et
     * svar — samtalen står stille til leseren sier noe (Simens issue 112).
     * `info` er Designsystemets «her er noe du må vite»; `warning` ville sagt
     * at noe hadde gått galt, og det har det ikke.
     */
    const { container } = render(<Clarification question={question} />);

    const tag = container.querySelector('.ds-tag');
    expect(tag?.getAttribute('data-color')).toBe('info');
    // Og fargen bærer ikke meningen alene: merkelappen sier det i ord.
    expect(tag?.textContent).toBe(CLARIFICATION_TAG);
  });

  it('har ingen knapperad, verken kopiknapp eller tidspunkt', () => {
    /*
     * Raden holdt «Kopier spørsmålet» og klokkeslettet assistenten spurte på.
     * Ingen av delene er det leseren er her for: det ene trekket fra dette
     * kortet er å svare, og feltet under venter med markøren i seg (Simens
     * issue 112).
     */
    const { container } = render(<Clarification question={question} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(container.querySelector('.ka-answer-actions')).toBeNull();
    expect(container.querySelector('time')).toBeNull();
  });
});
