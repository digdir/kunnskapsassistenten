import { Button, Details, Heading, Paragraph } from '@digdir/designsystemet-react';
import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from 'react';
import { useT } from './i18n.js';

export interface CrashBoundaryProps {
  children: ReactNode;
  /** What «Last inn på nytt» does. A reload of the page unless the app says otherwise. */
  onReload?: (() => void) | undefined;
  /** What was thrown, and where, for the app's own log. */
  onError?: ((error: unknown, info: ErrorInfo) => void) | undefined;
}

/** What was thrown, reduced to the two things the page shows. */
interface Failure {
  name: string;
  message: string;
}

interface CrashBoundaryState {
  failure: Failure | undefined;
}

/**
 * The last line before a white page: an error React cannot recover from gives a page with
 * «Last inn på nytt» instead. A class, since React has no hook for this. Put it around the whole
 * app, outside its router, so it depends on nothing that may have failed: the page it draws is
 * the page, with its own `main` and level 1 heading.
 */
export class CrashBoundary extends Component<CrashBoundaryProps, CrashBoundaryState> {
  override state: CrashBoundaryState = { failure: undefined };

  // The name is read off whatever was thrown: a `DOMException` is an `Error` in a browser but not
  // in jsdom.
  static getDerivedStateFromError(thrown: unknown): CrashBoundaryState {
    const named = typeof thrown === 'object' && thrown !== null ? (thrown as Partial<Failure>) : {};
    return {
      failure: {
        name: typeof named.name === 'string' ? named.name : 'Error',
        message: typeof named.message === 'string' ? named.message : String(thrown),
      },
    };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  override render() {
    const { failure } = this.state;
    if (failure === undefined) return this.props.children;
    return <CrashedPage failure={failure} onReload={this.props.onReload ?? reloadPage} />;
  }
}

const reloadPage = () => window.location.reload();

/**
 * What stands where the app was. The heading takes the focus that was left on `<body>`. The error
 * text is behind a Details: technical, but there to copy into a message.
 */
const CrashedPage = ({ failure, onReload }: { failure: Failure; onReload: () => void }) => {
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  // `NotFoundError`: a node React meant to move or remove was gone. Its one known cause is outside
  // the app, a translator or an extension rewriting the page, so only it is explained.
  const changedFromOutside = failure.name === 'NotFoundError';

  return (
    <main className="uib-states-crash">
      <div className="uib-states-crash-body">
        <Heading level={1} data-size="md" ref={heading} tabIndex={-1}>
          {t('states.crashTitle')}
        </Heading>
        <Paragraph>{t('states.crashText')}</Paragraph>
        {changedFromOutside ? <Paragraph>{t('states.crashOutside')}</Paragraph> : null}
        <Button onClick={onReload}>{t('states.reload')}</Button>
        <Details>
          <Details.Summary>{t('states.crashDetails')}</Details.Summary>
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
};
