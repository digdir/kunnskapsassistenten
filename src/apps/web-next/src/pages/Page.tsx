// KA's own pages beside the assistant: «Endringslogg», «Om prosjektet», and «Siden finnes ikke» for
// an address that is none. A column of text on the page's own background, in the assistant's
// colours and type, with the way back to the assistant first and last.
import { Heading, Link, Paragraph } from '@digdir/designsystemet-react';
import { ArrowLeftIcon } from '@navikt/aksel-icons';
import { useEffect, type ReactNode } from 'react';
import { Markdown } from './markdown';

interface FrameProps {
  /** The page's name: its `h1`, and first in the tab's title. */
  title: string;
  assistantName: string;
  children: ReactNode;
}

const Frame = ({ title, assistantName, children }: FrameProps) => {
  // As the assistant names its pages (genki's `assembly.tabTitle`), for WCAG 2.4.2.
  useEffect(() => {
    document.title = `${title} – ${assistantName}`;
  }, [title, assistantName]);
  return (
    <div className="ka-page">
      <main className="ka-page-main">{children}</main>
    </div>
  );
};

const Back = ({ href, assistantName }: { href: string; assistantName: string }) => (
  <Link href={href} className="ka-page-back">
    <ArrowLeftIcon aria-hidden />
    Tilbake til {assistantName}
  </Link>
);

export interface InfoPageProps {
  title: string;
  /** The page's text, as markdown.tsx reads it. */
  text: string;
  assistantName: string;
  /** Where the way back leads: the address the person came from, or the front page. */
  back: string;
}

export const InfoPage = ({ title, text, assistantName, back }: InfoPageProps) => (
  <Frame title={title} assistantName={assistantName}>
    <Back href={back} assistantName={assistantName} />
    <article className="ka-page-text">
      <Heading level={1} data-size="lg">
        {title}
      </Heading>
      <Markdown text={text} />
    </article>
    <Back href={back} assistantName={assistantName} />
  </Frame>
);

export const NOT_FOUND_TITLE = 'Siden finnes ikke';

export const NotFoundPage = ({ assistantName }: { assistantName: string }) => (
  <Frame title={NOT_FOUND_TITLE} assistantName={assistantName}>
    <div className="ka-page-text">
      <Heading level={1} data-size="lg">
        {NOT_FOUND_TITLE}
      </Heading>
      <Paragraph>
        Adressen fører ingen steder i {assistantName}. Den kan være skrevet feil, eller peke på
        noe som er borte.
      </Paragraph>
      <Paragraph>
        <Link href="/">Gå til forsiden</Link>
      </Paragraph>
    </div>
  </Frame>
);
