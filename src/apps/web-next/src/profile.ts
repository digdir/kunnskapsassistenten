// What KA knows about its service that genki does not say: the assistant's name, its suggestions
// and follow-ups, Kudos's fields in KA's words, the document links and KA's experiments. Copied
// from apps/web's choices (views/chat/text.ts, flags/flags.ts, .env.example), not imported: this
// client imports nothing from apps/web. UI text is Norwegian bokmål.
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

// Kudos's fields as KA chose and named them.
const KUDOS_FIELDS: readonly FieldSpec[] = [
  { id: 'type', label: 'Dokumenttyper', heading: 'Dokumenttype' },
  { id: 'orgs_long', label: 'Virksomheter', heading: 'Virksomhet' },
  { id: 'concerned_years', label: 'År', heading: 'År', kind: 'year', integer: true },
];

const KUDOS = 'Kudos';

// The collection by name: the model is not told which one it searches, so «denne samlingen» is asked back.
const SUGGESTIONS = [
  `Hva handler dokumentene i ${KUDOS} om?`,
  `Gi meg en oversikt over de viktigste temaene i ${KUDOS}.`,
  `Oppsummer det viktigste i ${KUDOS} i noen få punkter.`,
];
const FOLLOW_UPS = ['Kan du utdype?', 'Identifiser utfordringer', 'Lag relaterte spørsmål'];

// KA's link templates for Kudos.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const kudosUrl = (docNum: string) => {
  if (/^\d+$/.test(docNum)) return `https://kudos.dfo.no/documents/${docNum}`;
  if (UUID.test(docNum)) return `https://kudos.dfo.no/dokument/${docNum}`;
  return undefined;
};

const issue = (n: number) => ({
  href: `https://github.com/digdir/kunnskapsassistenten/issues/${n}`,
  hrefLabel: `Sak ${n}`,
});

const EXPERIMENTS = [
  {
    id: 'year-ranges',
    title: 'Årsfilter med perioder',
    description:
      'Skriv et år eller en periode, som 2021 eller 2023–2028. År på rad står som én merkelapp.',
    ...issue(115),
  },
  {
    id: 'compact-filter-chips',
    title: 'Samlede merkelapper i filteret',
    description: 'Når mange verdier er valgt, står én merkelapp, som «12 virksomheter».',
    ...issue(116),
  },
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

/** The profile for the person `me` names. */
export const profileFor = (me: Me): AssistantProfile => ({
  assistantName: 'Kunnskapsassistenten',
  suggestions: SUGGESTIONS,
  followUps: FOLLOW_UPS,
  corpora: {
    kudos: {
      label: KUDOS,
      description: 'dokumenter fra kudos.dfo.no',
      fields: KUDOS_FIELDS,
      typeField: 'type',
      typePlurals: TYPE_PLURALS,
      documentUrl: kudosUrl,
      about: { idField: 'doc_num', fields: ['type', 'orgs_long', 'concerned_years'] },
    },
  },
  ...(me.name ? { signedInAs: me.name } : {}),
  ...(me.organisation ? { organisation: me.organisation } : {}),
  ...(me.signOut ? { signOut: { href: me.signOut } } : {}),
  // Only this service's threads: the person's token reaches no other.
  family: (service) => service === me.service,
  experiments: EXPERIMENTS,
  settingsNote: 'Valgene huskes i denne nettleseren. Eksperimentene slås av når du logger ut.',
});
