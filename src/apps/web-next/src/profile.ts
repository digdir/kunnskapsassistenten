// What KA knows about its service that genki does not say: the assistant's name, its suggestions,
// Kudos's fields in KA's words, the document links and KA's experiments, as the previous client
// had them (its views/chat/text.ts, flags/flags.ts and .env.example). UI text is Norwegian
// bokmål. No follow-ups: the template's next look draws none. With a layout from genki's builder
// only the host's part is used (`hostProfileFor`).
import type { AssistantProfile, FieldSpec } from '@genai/ui-assembly';
import type { DocumentFile } from '@genai/ui-blocks';
import type { Me } from './session';

// The previous client's own plurals (its views/filters/corpusText.ts).
const TYPE_PLURALS: Record<string, string> = {
  Evaluering: 'evalueringer',
  'Proposisjon til Stortinget': 'proposisjoner til Stortinget',
  Statusrapport: 'statusrapporter',
  Tildelingsbrev: 'tildelingsbrev',
  Årsrapport: 'årsrapporter',
};

// The year list starts here, as the previous client's server shaped it (`shapeFacet` in its
// apps/server/src/facets.ts): Kudos's `concerned_years` holds about a thousand values, and earlier
// ones are page numbers and parse noise. genki's assembly ends the list at the year it is in Norway.
const FIRST_YEAR = 1990;

// Kudos's fields as KA chose and named them.
const KUDOS_FIELDS: readonly FieldSpec[] = [
  { id: 'type', label: 'Dokumenttyper', heading: 'Dokumenttype' },
  { id: 'orgs_long', label: 'Virksomheter', heading: 'Virksomhet' },
  {
    id: 'concerned_years',
    label: 'År',
    heading: 'År',
    kind: 'year',
    integer: true,
    years: { first: FIRST_YEAR },
  },
];

const KUDOS = 'Kudos';

// The collection by name: the model is not told which one it searches, so «denne samlingen» is asked back.
const SUGGESTIONS = [
  `Hva handler dokumentene i ${KUDOS} om?`,
  `Gi meg en oversikt over de viktigste temaene i ${KUDOS}.`,
  `Oppsummer det viktigste i ${KUDOS} i noen få punkter.`,
];
// KA's link templates for Kudos, by the kind of document number. Any other number has no link.
const KUDOS_LINKS = {
  digits: 'https://kudos.dfo.no/documents/{id}',
  uuid: 'https://kudos.dfo.no/dokument/{id}',
} as const;

// genki's knowledge database names a Kudos document `kudos:<uuid>`, which no template fits. Only
// that exact shape is read: the prefix as genki writes it, then one uuid and nothing after it.
const PREFIXED_UUID =
  /^kudos:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

/**
 * The document in Kudos for a number genki prefixed with its collection; any other number is left
 * to the templates. The assembly asks only for a source that carries no link of its own.
 */
export const kudosDocumentUrl = (documentId: string): string | undefined => {
  const uuid = PREFIXED_UUID.exec(documentId)?.[1];
  return uuid ? `https://kudos.dfo.no/dokument/${uuid}` : undefined;
};

/** How long the page waits to hear whether a Kudos document has a PDF. */
const FILE_LOOKUP_MS = 15_000;

/**
 * The whole file of a Kudos document genki names `kudos:<uuid>`: its PDF through this site's
 * server, once a HEAD there says it has one, so a document without a PDF shows its excerpts and
 * no framed error. Any other number has none. Provisional until genki offers a route for a
 * document's file: then this function changes, and nothing else on the page.
 */
export const kudosDocumentFile = async (
  documentId: string,
  signal: AbortSignal,
): Promise<DocumentFile | undefined> => {
  const uuid = PREFIXED_UUID.exec(documentId)?.[1]?.toLowerCase();
  if (!uuid) return undefined;
  const url = `/api/next/kudos/files/${uuid}`;
  const res = await fetch(url, {
    method: 'HEAD',
    credentials: 'same-origin',
    signal: AbortSignal.any([signal, AbortSignal.timeout(FILE_LOOKUP_MS)]),
  });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`The Kudos file answered ${res.status}.`);
  return { url, mediaType: 'application/pdf' };
};

const issue = (n: number) => ({
  href: `https://github.com/digdir/kunnskapsassistenten/issues/${n}`,
  hrefLabel: `Sak ${n}`,
});

// Years as periods (#115) and many values as one chip (#116) were trials until 13.11; genki's
// assembly now always draws them.
const EXPERIMENTS = [
  {
    id: 'filters-right-panel',
    title: 'Filtreringen i høyre panel',
    description:
      'Filtreringen står over kildene i høyre panel, så begge synes samtidig. Navigasjonspanelet har bare trådene.',
    ...issue(84),
  },
  {
    id: 'compact-filter',
    title: 'Smalere filter',
    description: 'Filteret tar mindre plass, og tråder får resten.',
  },
];

/**
 * What only this host can give, whatever layout it draws: who is signed in, the sign-out, the
 * services whose threads are listed, KA's trials, which the assembly carries out, and a Kudos
 * document's PDF from this site's server. A layout from genki's builder (decisions/0017) is drawn
 * with this and its own words, and its Dokumentvisning option `file` says whether the PDF is asked.
 */
export const hostProfileFor = (me: Me): AssistantProfile => ({
  ...(me.name ? { signedInAs: me.name } : {}),
  ...(me.organisation ? { organisation: me.organisation } : {}),
  ...(me.signOut ? { signOut: { href: me.signOut } } : {}),
  // Only this service's threads: the person's token reaches no other.
  family: (service) => service === me.service,
  experiments: EXPERIMENTS,
  documentFile: kudosDocumentFile,
});

/** The profile for the person `me` names: KA's words for its service, and the host's part. */
export const profileFor = (me: Me): AssistantProfile => ({
  assistantName: 'Kunnskapsassistenten',
  suggestions: SUGGESTIONS,
  corpora: {
    kudos: {
      label: KUDOS,
      description: 'dokumenter fra kudos.dfo.no',
      fields: KUDOS_FIELDS,
      typeField: 'type',
      // Who published each document, under its title in «Dokumentene som blir med».
      organisationField: 'orgs_long',
      typePlurals: TYPE_PLURALS,
      documentUrl: kudosDocumentUrl,
      documentLinks: KUDOS_LINKS,
      about: { idField: 'doc_num', fields: ['type', 'orgs_long', 'concerned_years'] },
    },
  },
  ...hostProfileFor(me),
  settingsNote: 'Valgene huskes i denne nettleseren. Eksperimentene slås av når du logger ut.',
});
