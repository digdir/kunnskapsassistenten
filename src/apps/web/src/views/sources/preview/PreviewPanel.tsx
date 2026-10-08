import { Button, Heading, Link, Paragraph } from '@digdir/designsystemet-react';
import { useId, useState } from 'react';
import { fixtures } from '../../../api/mock';
import { SecondarySidebarIcon } from '../../../components/icons';
import { excerptDomId, type AnswerSources, type SourceDocument } from '../../../model';
import { SourcesView } from '../SourcesView';
import { kudosMarkdownSources } from './kudosExcerpts';
import './preview.css';

// Dev only: loading, empty and collapsed, which the app cannot be steered into
// by hand, in the shell's structure.
type PreviewState =
  | 'ready'
  | 'eget-dokument'
  | 'loading'
  | 'empty'
  | 'uncited'
  | 'flere-svar'
  | 'avbrutt'
  | 'feil'
  | 'avklaring'
  | 'kudos-markdown';

const STATE_LABELS: Record<PreviewState, string> = {
  ready: 'Med kilder',
  'eget-dokument': 'Eget dokument',
  loading: 'Laster',
  empty: 'Tom',
  uncited: 'Utdrag uten nummer',
  'flere-svar': 'To svar',
  avbrutt: 'Avbrutt svar',
  feil: 'Feilet svar',
  avklaring: 'Avklaring',
  'kudos-markdown': 'Utdrag fra Kudos',
};

// The last excerpt without its `citationNumber`: the model allows it, and the
// mock never produces it.
const uncitedSources = fixtures.nkomSources.map((source, index) =>
  index < fixtures.nkomSources.length - 1
    ? source
    : {
        ...source,
        excerpts: source.excerpts.map(({ citationNumber: _number, ...excerpt }) => excerpt),
      },
);

// Numbers from 1 per answer, as answers do, so two answers both have a `[1]`.
function renumbered(sources: SourceDocument[]): SourceDocument[] {
  let next = 1;
  return sources.map((source) => ({
    ...source,
    excerpts: source.excerpts.map((excerpt) => ({ ...excerpt, citationNumber: next++ })),
  }));
}

const answerOne: AnswerSources = {
  messageId: 'svar-1',
  status: 'complete',
  documents: renumbered(fixtures.nkomSources.slice(0, 2)),
};

const answerTwo: AnswerSources = {
  messageId: 'svar-2',
  status: 'complete',
  documents: renumbered([...fixtures.nkomSources.slice(2), fixtures.nkomSources[0]]),
};

function oneAnswer(documents: SourceDocument[]): readonly AnswerSources[] {
  return [{ messageId: 'svar-1', status: 'complete', documents }];
}

function answersFor(state: PreviewState): readonly AnswerSources[] | undefined {
  switch (state) {
    // A question asked with an attachment: the reader's own file first, the
    // corpus behind it, which is the order the mock renumbers them into. The
    // corpus document keeps its own title so the two kinds stand side by side.
    case 'eget-dokument':
      return oneAnswer([ownDocument, ...renumberedCorpus]);
    case 'loading':
      return [{ messageId: 'svar-1', status: 'streaming', documents: [] }];
    case 'empty':
      return [];
    case 'uncited':
      return oneAnswer(uncitedSources);
    case 'flere-svar':
      return [answerOne, answerTwo];
    // The three answers that ended without sources. Each says something else,
    // and none of them may say «når du har stilt et spørsmål».
    case 'avbrutt':
      return [answerOne, { messageId: 'svar-2', status: 'aborted', documents: [] }];
    case 'feil':
      return [answerOne, { messageId: 'svar-2', status: 'error', documents: [] }];
    case 'avklaring':
      return [{ messageId: 'svar-1', status: 'needs-clarification', documents: [] }];
    // Chunks as the corpus has them: page anchors, Marker's page markers,
    // tables and emphasis. See `kudosExcerpts.ts`.
    case 'kudos-markdown':
      return oneAnswer(kudosMarkdownSources);
    default:
      return oneAnswer(fixtures.nkomSources);
  }
}

// An uploaded file's source, built by `fixtures.userDocumentSource` as the mock does.
const ownDocument: SourceDocument = fixtures.userDocumentSource(
  {
    id: 'doc-egen',
    name: 'Notat om måloppnåelse 2026.pdf',
    type: 'pdf',
    size: 348_000,
    status: 'ready',
    progress: 100,
    uploadedAt: '2026-09-21T09:00:00.000Z',
  },
  1,
);

/** The corpus documents after the attachment took citation number 1. */
const renumberedCorpus: SourceDocument[] = (() => {
  let next = 2;
  return fixtures.nkomSources.map((source) => ({
    ...source,
    excerpts: source.excerpts.map((excerpt) =>
      excerpt.citationNumber === undefined ? excerpt : { ...excerpt, citationNumber: next++ },
    ),
  }));
})();

// `?kilde=3`: a citation set on mount, where the view must not move focus.
type PreviewCitation = { number: number; nonce: number; messageId?: string };

function citationFromUrl(): PreviewCitation | undefined {
  const value = Number(new URLSearchParams(window.location.search).get('kilde'));
  return Number.isInteger(value) && value > 0 ? { number: value, nonce: 0 } : undefined;
}

// The slot's two widths in `viewModel.ts`: two layouts, not one stretched.
const WIDTH_LABELS = { wide: '432 px', narrow: '336 px' } as const;

type PreviewWidth = keyof typeof WIDTH_LABELS;

export function PreviewPanel() {
  const [state, setState] = useState<PreviewState>('ready');
  const [width, setWidth] = useState<PreviewWidth>('wide');
  const [collapsed, setCollapsed] = useState(false);
  const [citation, setCitation] = useState<PreviewCitation | undefined>(citationFromUrl);
  const contentId = useId();

  const answers = answersFor(state);

  function showCitation(number: number, messageId: string) {
    setCitation((previous) => ({ number, messageId, nonce: (previous?.nonce ?? 0) + 1 }));
  }

  return (
    <div className="preview">
      <main className="preview__main">
        <Heading level={1} data-size="lg">
          Kilder, forhåndsvisning
        </Heading>

        <div className="preview__controls">
          {(Object.keys(STATE_LABELS) as PreviewState[]).map((value) => (
            <Button
              key={value}
              variant={state === value ? 'primary' : 'secondary'}
              data-size="sm"
              onClick={() => {
                // The citation belongs to the thread it was clicked in, not to
                // the next fixture set.
                setState(value);
                setCitation(undefined);
              }}
            >
              {STATE_LABELS[value]}
            </Button>
          ))}
        </div>

        <div className="preview__controls">
          {(Object.keys(WIDTH_LABELS) as PreviewWidth[]).map((value) => (
            <Button
              key={value}
              variant={width === value ? 'primary' : 'secondary'}
              data-size="sm"
              onClick={() => setWidth(value)}
            >
              Panelet på {WIDTH_LABELS[value]}
            </Button>
          ))}
        </div>

        <Paragraph data-size="sm">
          Markørene under er de samme lenkene svaret tegner, med samme href. Kollaps panelet først
          for å se at en markør åpner det igjen. I «To svar» har begge svarene en [1], og de peker
          på hvert sitt utdrag — det er saken. «Tilbake til svaret» og Escape i et åpnet utdrag
          flytter fokus hit igjen.
        </Paragraph>

        {(answers ?? []).map((answer, index) => (
          <div className="preview__controls" key={answer.messageId}>
            <Paragraph data-size="xs">Svar {index + 1}:</Paragraph>
            {answer.documents.length === 0 ? (
              <Paragraph data-size="xs">ingen markører ({answer.status})</Paragraph>
            ) : (
              answer.documents
                .flatMap((source) => source.excerpts)
                .map((excerpt) => (
                  <Link
                    key={excerpt.id}
                    href={`#${excerptDomId(excerpt.citationNumber as number)}`}
                    onClick={(event) => {
                      // The same two lines the real marker has: the href is
                      // what makes it a link, and following it is what must
                      // not happen.
                      event.preventDefault();
                      showCitation(excerpt.citationNumber as number, answer.messageId);
                    }}
                  >
                    [{excerpt.citationNumber}]
                  </Link>
                ))
            )}
          </div>
        ))}
      </main>

      {/* The same shape as Shell.tsx: the slot owns the button, the content
          stays mounted and is hidden with `hidden`. */}
      <aside aria-label="Kilder" className="preview__aside" data-width={width}>
        <Button
          variant="tertiary"
          data-color="neutral"
          data-size="sm"
          aria-expanded={!collapsed}
          aria-controls={contentId}
          onClick={() => setCollapsed((it) => !it)}
        >
          <SecondarySidebarIcon aria-hidden />
          {collapsed ? 'Vis kilder' : 'Skjul kilder'}
        </Button>

        <div id={contentId} hidden={collapsed} className="preview__aside-content">
          <SourcesView
            // Remounts per fixture set: the view remembers which answer the
            // reader stepped to, which misleads when the harness swaps threads.
            key={state}
            answers={answers}
            collapsed={collapsed}
            onCollapsedChange={setCollapsed}
            activeCitationNumber={citation?.number}
            activeCitationNonce={citation?.nonce}
            activeCitationMessageId={citation?.messageId}
          />
        </div>
      </aside>
    </div>
  );
}
