import { Button, Details, Heading, Paragraph } from '@digdir/designsystemet-react';
import { Component, useEffect, useRef, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
  /** What «Last inn på nytt» does. A reload of the page, unless a test says otherwise. */
  onReload?: () => void;
};

/** What was thrown, reduced to the two things the page shows. */
type Failure = { name: string; message: string };

type AppErrorBoundaryState = { failure: Failure | undefined };

/**
 * The last line before a white page. A known cause is `NotFoundError` from `removeChild`, when a
 * translator or extension rewrites the DOM while an answer streams. A class, since React 19 has
 * no hook for this; outside the router so it depends on nothing that may have failed.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failure: undefined };

  // Read the name off whatever was thrown: a `DOMException` is an `instanceof Error` in browsers
  // but not in jsdom.
  static getDerivedStateFromError(thrown: unknown): AppErrorBoundaryState {
    const named = typeof thrown === 'object' && thrown !== null ? (thrown as Partial<Failure>) : {};
    return {
      failure: {
        name: typeof named.name === 'string' ? named.name : 'Error',
        message: typeof named.message === 'string' ? named.message : String(thrown),
      },
    };
  }

  render() {
    const { failure } = this.state;
    if (failure === undefined) return this.props.children;
    return <CrashedPage failure={failure} onReload={this.props.onReload ?? reloadPage} />;
  }
}

function reloadPage() {
  window.location.reload();
}

// What stands where the app was: its own `main` and h1, since it IS the page now, and the heading
// takes the focus left on `<body>`. The error text is behind a Details: technical, but copyable.
function CrashedPage({ failure, onReload }: { failure: Failure; onReload: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  // `NotFoundError`: a node React meant to move or remove was gone. Its one known cause is
  // outside the app, so only it gets an explanation.
  const changedFromOutside = failure.name === 'NotFoundError';

  return (
    <main className="app-crash">
      <div className="app-crash__body">
        <Heading level={1} data-size="md" ref={heading} tabIndex={-1}>
          Noe gikk galt
        </Heading>
        <Paragraph>Siden kunne ikke vises. Last inn siden på nytt for å fortsette.</Paragraph>
        {changedFromOutside ? (
          <Paragraph>
            Det kan skje når en utvidelse i nettleseren, eller oversettelse av siden, endrer
            innholdet mens et svar kommer.
          </Paragraph>
        ) : null}
        <Button onClick={onReload}>Last inn på nytt</Button>
        <Details>
          <Details.Summary>Feilmeldingen</Details.Summary>
          <Details.Content>
            <Paragraph data-size="sm">
              <code>
                {failure.name}: {failure.message}
              </code>
            </Paragraph>
          </Details.Content>
        </Details>
      </div>
    </main>
  );
}
