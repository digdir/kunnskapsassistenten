// What KA knows about its service that genki does not say: the assistant's name, its suggestions,
// Kudos's fields in KA's words, the document links and KA's experiments. Copied from apps/web's
// choices (views/chat/text.ts, flags/flags.ts, .env.example), not imported: this client imports
// nothing from apps/web. UI text is Norwegian bokmål. No follow-ups: the template's next look
// draws none. With a layout from genki's builder only the host's part is used (`hostProfileFor`).
import type { AssistantProfile, FieldSpec } from '@genai/ui-assembly';
import type { Me } from './session';

// apps/web's own plurals (views/filters/corpusText.ts).
const TYPE_PLURALS: Record<string, string> = {
  Evaluering: 'evalueringer',
  'Proposisjon til Stortinget': 'proposisjoner til Stortinget',
  Statusrapport: 'statusrapporter',
  Tildelingsbrev: 'tildelingsbrev',
  Årsrapport: 'årsrapporter',
};

// The year list starts here, as the classic client's server shapes it (apps/server/src/facets.ts
// `shapeFacet`): Kudos's `concerned_years` holds about a thousand values, and earlier ones are
// page numbers and parse noise. genki's assembly ends the list at the year it is in Norway.
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
 * services whose threads are listed, and KA's trials, which the assembly carries out. A layout
 * from genki's builder (decisions/0017) is drawn with this and its own words.
 */
export const hostProfileFor = (me: Me): AssistantProfile => ({
  ...(me.name ? { signedInAs: me.name } : {}),
  ...(me.organisation ? { organisation: me.organisation } : {}),
  ...(me.signOut ? { signOut: { href: me.signOut } } : {}),
  // Only this service's threads: the person's token reaches no other.
  family: (service) => service === me.service,
  experiments: EXPERIMENTS,
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
      typePlurals: TYPE_PLURALS,
      documentLinks: KUDOS_LINKS,
      about: { idField: 'doc_num', fields: ['type', 'orgs_long', 'concerned_years'] },
    },
  },
  ...hostProfileFor(me),
  settingsNote: 'Valgene huskes i denne nettleseren. Eksperimentene slås av når du logger ut.',
});
