import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../../model';
import { AnswerMessage } from './AnswerMessage';
import { AnswerTime } from './AnswerTime';
import { MessageList } from './MessageList';

/** A Tuesday at 14:00, so «i går» and the weekday cases are not the same day. */
const NOW = new Date(2026, 8, 15, 14, 0, 0);
/** Søket eies av `MessageList`; disse testene handler om noe annet. */
const utenSok = {
  searchOpen: false,
  searchQuery: '',
  onSearchQueryChange: () => {},
  onToggleSearch: () => {},
  onCloseSearch: () => {},
  searchLabel: 'Søk i svaret',
};

const at = (...args: [number, number, number, number?, number?]) => new Date(...args).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function stamp(createdAt: string) {
  const { container } = render(<AnswerTime createdAt={createdAt} />);
  return container.querySelector('time');
}

describe('AnswerTime', () => {
  it('skriver tiden i et <time> med maskindato og hele datoen', () => {
    const iso = at(2026, 8, 15, 14, 32);
    const time = stamp(iso);

    expect(time).not.toBeNull();
    expect(time?.getAttribute('datetime')).toBe(iso);
    expect(time?.getAttribute('title')).toBe('15. september 2026 kl. 14:32');
  });

  it('bruker samme korte format som trådlista', () => {
    // Klokka i dag, «i går», ukedagen, dag og kort måned, dag og måned: det
    // trådlista skriver på raden, skrevet på svaret.
    expect(stamp(at(2026, 8, 15, 14, 32))?.textContent).toContain('14:32');
    expect(stamp(at(2026, 8, 14, 9, 5))?.textContent).toContain('i går');
    expect(stamp(at(2026, 8, 11, 9, 5))?.textContent).toContain('fredag');
    expect(stamp(at(2026, 7, 28, 9, 5))?.textContent).toContain('28. aug.');
    expect(stamp(at(2025, 4, 12, 9, 5))?.textContent).toContain('12. mai');
  });

  it('leses opp med hele datoen, som det korte formatet ikke sier', () => {
    // «12. mai» sier ikke hvilket år. I trådlista står året i
    // gruppeoverskriften over raden; her står det ingenting over svaret, og
    // `title` er et musepeker-tips ingen skjermleser leser.
    const time = stamp(at(2025, 4, 12, 9, 5));

    expect(time?.querySelector('[aria-hidden="true"]')?.textContent).toBe('12. mai');
    expect(time?.querySelector('.ds-sr-only')?.textContent).toBe(
      'Svaret kom 12. mai 2025 kl. 09:05',
    );
  });

  it('tier heller enn å skrive «Invalid Date»', () => {
    expect(stamp('ikke en dato')).toBeNull();
  });

  it('viser tiden svaret ble gitt, ikke tiden det ble lastet', () => {
    // Et gjenopprettet svar bærer sin egen `createdAt`. Skrev det seg om til
    // lastetiden, ville det vært «Tenkte i 2 sekunder»-feilen om igjen i et
    // annet felt.
    const answered = at(2026, 8, 11, 9, 5);
    const answer: Message = {
      id: 'a1',
      role: 'assistant',
      content: 'Nkom måler måloppnåelse mot målene i tildelingsbrevet.',
      createdAt: answered,
      citations: [],
      status: 'complete',
    };

    render(
      <ol>
        <AnswerMessage
          {...utenSok}
          message={answer}
          onRegenerate={() => {}}
          onSelectSource={() => {}}
        />
      </ol>,
    );

    // Lastet i dag klokka 14:00, men svaret kom fredag.
    const time = screen.getByText('fredag').closest('time');
    expect(time?.getAttribute('datetime')).toBe(answered);
    expect(time?.getAttribute('title')).toBe('11. september 2026 kl. 09:05');
  });

  it('står utenfor knappene i handlingsraden, ikke inni en av dem', () => {
    // Inni ville tiden blitt en del av knappens tilgjengelige navn, og
    // «Kopier svaret 14:32» er et navn som endrer seg med klokka. Samme grunn
    // som at trådlista holder tiden utenfor lenka.
    const answer: Message = {
      id: 'a1',
      role: 'assistant',
      content: 'Et ferdig svar.',
      createdAt: at(2026, 8, 15, 14, 32),
      citations: [],
      status: 'complete',
    };

    const { container } = render(
      <ol>
        <AnswerMessage
          {...utenSok}
          message={answer}
          onRegenerate={() => {}}
          onSelectSource={() => {}}
        />
      </ol>,
    );

    const times = container.querySelectorAll('time');
    expect(times).toHaveLength(1);
    expect(times[0].closest('button')).toBeNull();
    expect(times[0].closest('a')).toBeNull();

    for (const button of screen.getAllByRole('button')) {
      expect(button.textContent).not.toContain('14:32');
    }
  });

  it('står også under et svar som ble stoppet', () => {
    // Et stoppet svar er fortsatt et svar leseren kan vise tilbake til.
    const answer: Message = {
      id: 'a1',
      role: 'assistant',
      content: 'Måloppnåelse er ',
      createdAt: at(2026, 8, 15, 14, 32),
      citations: [],
      status: 'aborted',
    };

    const { container } = render(
      <ol>
        <AnswerMessage
          {...utenSok}
          message={answer}
          onRegenerate={() => {}}
          onSelectSource={() => {}}
        />
      </ol>,
    );

    expect(container.querySelectorAll('time')).toHaveLength(1);
    expect(screen.getByText('14:32')).toBeDefined();
  });

  it('gir spørsmålet over svaret ingen egen tid', () => {
    // Ett stempel per svar. Spørsmålet står rett over og er det svaret
    // svarer på; to tider på samme utveksling er én for mye.
    const question: Message = {
      id: 'q1',
      role: 'user',
      content: 'Hva er måloppnåelse?',
      createdAt: at(2026, 8, 15, 14, 31),
      citations: [],
      status: 'complete',
    };
    const answer: Message = {
      id: 'a1',
      role: 'assistant',
      content: 'Et ferdig svar.',
      createdAt: at(2026, 8, 15, 14, 32),
      citations: [],
      status: 'complete',
    };

    const { container } = render(
      <ol>
        {[question, answer].map((message) =>
          message.role === 'user' ? (
            <li key={message.id}>{message.content}</li>
          ) : (
            <AnswerMessage
              {...utenSok}
              key={message.id}
              message={message}
              onRegenerate={() => {}}
              onSelectSource={() => {}}
            />
          ),
        )}
      </ol>,
    );

    expect(container.querySelectorAll('time')).toHaveLength(1);
  });
  it('stempler ikke en tur som spurte tilbake', () => {
    /*
     * En avklaring fikk stempel fra 2026-09-16, fordi en gjenopprettet samtale
     * som endte i en avklaring ellers hadde et hull. Simen snudde det i issue
     * 112: klokkeslettet sto i en knapperad som ikke lenger er der, og det er
     * ikke det leseren er her for. Det ene trekket fra kortet er å svare.
     *
     * Hullet er ikke et hull i praksis: leserens eget spørsmål over kortet har
     * heller ikke noe klokkeslett, og raden i trådlista sier når samtalen sist
     * beveget seg.
     */
    const spurte: Message = {
      id: 'a1',
      role: 'assistant',
      content: 'Mener du målene i tildelingsbrevet, eller måloppnåelsen i årsrapporten?',
      createdAt: at(2026, 8, 11, 9, 5),
      citations: [],
      status: 'needs-clarification',
    };

    const { container } = render(
      <MessageList messages={[spurte]} onRegenerate={() => {}} onSelectSource={() => {}} />,
    );

    expect(container.querySelectorAll('time')).toHaveLength(0);
  });

  it('gir en gjenopprettet samtale ett stempel per svar, og ingen på avklaringen', () => {
    // Spørsmål, svar, oppfølging, avklaring: to turer fra assistenten, men
    // bare den som svarte får stempel. Leserens egne spørsmål teller ikke med.
    const messages: Message[] = [
      {
        id: 'q1',
        role: 'user',
        content: 'Hva er måloppnåelse?',
        createdAt: at(2026, 8, 11, 9, 0),
        citations: [],
        status: 'complete',
      },
      {
        id: 'a1',
        role: 'assistant',
        content: 'Et svar.',
        createdAt: at(2026, 8, 11, 9, 5),
        citations: [],
        status: 'complete',
      },
      {
        id: 'q2',
        role: 'user',
        content: 'Og i Digdir?',
        createdAt: at(2026, 8, 11, 9, 10),
        citations: [],
        status: 'complete',
      },
      {
        id: 'a2',
        role: 'assistant',
        content: 'Mener du 2025 eller 2026?',
        createdAt: at(2026, 8, 11, 9, 12),
        citations: [],
        status: 'needs-clarification',
      },
    ];

    const { container } = render(
      <MessageList messages={messages} onRegenerate={() => {}} onSelectSource={() => {}} />,
    );

    expect([...container.querySelectorAll('time')].map((t) => t.getAttribute('datetime'))).toEqual([
      at(2026, 8, 11, 9, 5),
    ]);
  });
  it('stempler ikke et svar som fortsatt strømmer', () => {
    /*
     * Tida på svaret er «da svaret var ferdig», og et svar som strømmer er
     * ikke ferdig. Å vise et tidspunkt mens teksten fortsatt kommer ville
     * dessuten vært et stempel som flyttet seg når turen landet.
     */
    const underveis: Message = {
      id: 'a1',
      role: 'assistant',
      content: 'Nkom måler ',
      createdAt: at(2026, 8, 15, 14, 32),
      citations: [],
      status: 'streaming',
    };

    const { container } = render(
      <ol>
        <AnswerMessage
          {...utenSok}
          message={underveis}
          onRegenerate={() => {}}
          onSelectSource={() => {}}
        />
      </ol>,
    );

    expect(container.querySelectorAll('time')).toHaveLength(0);
  });

  it('stempler ikke et svar som ennå ikke har skrevet et ord', () => {
    // Samme sak, en fase tidligere: skjelettet står der, og ingen tid.
    const tomt: Message = {
      id: 'a1',
      role: 'assistant',
      content: '',
      createdAt: at(2026, 8, 15, 14, 32),
      citations: [],
      status: 'streaming',
    };

    const { container } = render(
      <ol>
        <AnswerMessage
          {...utenSok}
          message={tomt}
          onRegenerate={() => {}}
          onSelectSource={() => {}}
        />
      </ol>,
    );

    expect(container.querySelectorAll('time')).toHaveLength(0);
  });
});
