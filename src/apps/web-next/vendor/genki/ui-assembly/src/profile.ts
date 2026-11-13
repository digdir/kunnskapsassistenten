// What a host knows about its service that genki does not say: the assistant's name, its
// suggested questions, and per collection the labels of its filter fields and where a document
// lives. kunnskapsassistenten's own choices are one such profile; without one, the assembly uses
// genki's names as they come.
import type { ShellProfileProps } from '@genai/ui-blocks';

/** One filter field as the reader sees it. */
export interface FieldSpec {
  id: string;
  label: string;
  /** The field's name over its row in the next look's filter, singular: «Dokumenttype». */
  heading?: string | undefined;
  kind?: 'year' | undefined;
  /** The values are integers on the wire. */
  integer?: boolean | undefined;
}

export interface CorpusProfile {
  /** The collection's name in the page, «Kudos». */
  label?: string | undefined;
  description?: string | undefined;
  /** The fields offered and their order; the rest of the collection's fields are not. */
  fields?: readonly FieldSpec[] | undefined;
  /** The plural of each document type, for «Leser fra 45 778 årsrapporter». */
  typePlurals?: Readonly<Record<string, string>> | undefined;
  /** The field the document type is in, for the line above. */
  typeField?: string | undefined;
  /** The field the publishing organisation is in, for the documents in «Dokumentene som blir med». */
  organisationField?: string | undefined;
  /** Where a document lives, from its number, when the source carries no link. */
  documentUrl?: ((documentId: string) => string | undefined) | undefined;
  /**
   * The facets that describe one document, read by its number for the line under its title in
   * «Dokumenter»: the field holding the number, and the fields to show.
   */
  about?: { idField: string; fields: readonly string[] } | undefined;
}

export interface AssistantProfile {
  /** Who answers, in the page and for a screen reader. */
  assistantName?: string | undefined;
  /** The three questions offered under the greeting. */
  suggestions?: readonly string[] | undefined;
  /** The follow-ups offered over the field after an answer. */
  followUps?: readonly string[] | undefined;
  /** Per collection, by its key. */
  corpora?: Readonly<Record<string, CorpusProfile>> | undefined;
  /**
   * Who the reader is: «Innlogget som» under the threads, or in the template's next look the name
   * on the profile button at the primary panel's foot, which opens the profile menu.
   */
  signedInAs?: string | undefined;
  /** The reader's organisation, under their name at the top of the profile menu (next look). */
  organisation?: string | undefined;
  /**
   * The host's pages in the profile menu (next look), each a link or an action, after
   * «Innstillinger». One not given is not drawn, and «Endringslogg» has its dot only when `news`
   * says something is new. `extra` holds the host's own entries, in its words, before «Logg ut».
   */
  menu?:
    Pick<ShellProfileProps, 'feedback' | 'changelog' | 'about' | 'contact' | 'extra'> | undefined;
  /**
   * «Logg ut»: the host's sign-out, a full navigation to `href`. The assembly first forgets the
   * reader's choices kept in this browser, then calls `onSignOut`. Without it, no «Logg ut» is drawn.
   */
  signOut?: { href: string; onSignOut?: (() => void) | undefined } | undefined;
  /**
   * The services the reader may switch between as variants, and whose threads are listed, when
   * more than the service's own, as kunnskapsassistenten's picker offers its family of services.
   */
  family?: ((service: string) => boolean) | undefined;
  /**
   * The trials the reader may turn on in «Innstillinger», «Eksperimenter». The assembly knows what
   * kunnskapsassistenten's do: `year-ranges` and `compact-filter-chips` in the filter,
   * `filters-right-panel`, which puts the filter over the sources in the secondary panel, and
   * `compact-filter`, the next look's filter panel 230 px wide with the threads taking the rest.
   */
  experiments?: readonly AssistantExperiment[] | undefined;
  /** The note at the foot of «Innstillinger». */
  settingsNote?: string | undefined;
}

export interface AssistantExperiment {
  id: string;
  title: string;
  description?: string | undefined;
  /** Where it is discussed, such as its issue, with the link's words. */
  href?: string | undefined;
  hrefLabel?: string | undefined;
}
