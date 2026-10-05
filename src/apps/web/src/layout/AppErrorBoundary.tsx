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
 * The last line before a white page.
 *
 * An error React cannot recover from unmounts the whole root, and what the
 * reader sees is an empty window with nothing to click. Lars got exactly that
 * in the test environment on 30.09, starting a new thread: `NotFoundError:
 * Failed to execute 'removeChild' on 'Node'`. That one is thrown in React's
 * commit phase when something outside React has moved or replaced a node
 * React still thinks it owns — a page translator or an extension rewriting
 * text while an answer streams in is enough, and it is reproduced that way in
 * design/_briefs/bygg/maalt-hvit-skjerm-ny-traad.md. This boundary does not
 * prevent that; it turns it into a page that says what happened and offers
 * the one thing that helps, which is loading again.
 *
 * A class, because only a class can be an error boundary in React 19. It sits
 * outside the router in main.tsx, so the page it draws depends on nothing
 * that may have been what failed.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failure: undefined };

  /*
   * The name is read off whatever was thrown, not only off an `Error`. The
   * DOM throws a `DOMException`, and whether that is an `instanceof Error`
   * depends on the environment — it is in the browsers, and not in jsdom.
   */
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

/**
 * What stands where the app was.
 *
 * Its own `main` and level 1 heading, because it IS the page now: a screen
 * reader user landing here has nothing else to navigate by. The heading takes
 * the focus, since whatever held it has just been unmounted and focus is on
 * `<body>`; from there the next Tab is the button.
 *
 * The error text itself is behind a Details and not on the page, because it
 * is English and technical and not written for a reader, but it is what a
 * reader can copy into a message to us.
 */
function CrashedPage({ failure, onReload }: { failure: Failure; onReload: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  /*
    The one cause this error is known to have from outside the app, named
    only for it. `NotFoundError` is the DOM saying a node React meant to move
    or remove was not where React left it.
  */
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
