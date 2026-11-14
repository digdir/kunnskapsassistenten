// The blocks the app builder offers, at the grain of the design's board «3 · byggeklosser og
// forhåndsvisning»: the canvas's blocks, each made of the package's smaller blocks (its members),
// with the options a service owner may set. The zones, the order and the needs come from the
// canvas and from genki #210's `rules.ts`, which holds the same table; this file is that table,
// driven from one place so the builder, its checks and the renderer read the same rules.
//
// Fotnoter is not a block here but an option on Chat that needs Kilder or Dokumentvisning: V2-0010
// pairs every footnote with an excerpt, so a footnote never stands where neither shows it.
import type { BuilderKey } from './i18n.js';

/** The shell's three places: the panel before the main column, the main column, the panel after. */
export const zones = ['primary', 'main', 'secondary'] as const;
export type Zone = (typeof zones)[number];

/**
 * What a block or an option asks of the service, the client or another block, in the words of the
 * kits file (`v2/kits-and-components.json`):
 * - `service:*` is read from the service's published row (`/v1/models`) or its draft;
 * - `channel:*` is a channel the client is given;
 * - `component:<id>` is another block, which must be placed too; `component:<a>|<b>` is either;
 * - `genki:*` is something genki does not have yet.
 */
export const needWords = [
  'service:chat',
  'service:datasets|documents',
  'service:documents',
  'service:filter-fields',
  'service:steps',
  'service:variants',
  'channel:conversations',
  'channel:facets',
  'channel:feedback',
  'component:sources|document-view',
  'genki:projects',
] as const;
export type Need = (typeof needWords)[number];

export const blockIds = [
  'projects',
  'threads',
  'settings',
  'chat',
  'filter',
  'approach',
  'sources',
  'document-view',
  'notes',
] as const;
export type BlockId = (typeof blockIds)[number];

/**
 * How a layout's blocks are drawn. `next` is the «_Ready for dev» boards' look (the cards frame,
 * the panels' titles, the profile menu), and every new look sits behind it until it is the only
 * one; `current` is what layouts drew before it.
 */
export const looks = ['current', 'next'] as const;
export type Look = (typeof looks)[number];

export const isLook = (value: unknown): value is Look =>
  typeof value === 'string' && (looks as readonly string[]).includes(value);

/** A switch or a choice on a block, drawn in the builder and kept in the layout's settings. */
export type BlockOption =
  | {
      id: string;
      kind: 'switch';
      default: boolean;
      needs?: readonly Need[];
      /** Shown off and disabled until it is built. */
      status?: 'planned';
      /** The looks that draw it; without, every look. In another look it is not in force. */
      looks?: readonly Look[];
    }
  | {
      id: string;
      kind: 'choice';
      choices: readonly string[];
      default: string;
      needs?: readonly Need[];
      status?: 'planned';
      looks?: readonly Look[];
    };

export interface BlockSpec {
  /** V2-0007: English, kebab-case. */
  id: BlockId;
  /** The zones it may stand in, the default first. */
  zones: readonly Zone[];
  /** It may also stand in both its zones at once, drawn in each its own way. */
  both?: true;
  /** Its place among the blocks in each zone, from the top: lower comes first. */
  order: Partial<Record<Zone, number>>;
  /** Drawn in the panel's foot, not among its content: Innstillinger «nederst». */
  slot?: 'foot';
  /** The package's components it renders, by their export names. */
  members: readonly string[];
  needs: readonly Need[];
  options: readonly BlockOption[];
  /** `planned` is shown off and disabled, marked «kommer». */
  status: 'built' | 'planned';
}

// The orders are the canvas's: in the primary panel Prosjekter, Tråder, Filter, Innstillinger; in
// the main column Fremgangsmåte, Filter, Chat, Dokumentvisning; in the secondary panel
// Fremgangsmåte, Chat, Kilder, Dokumentvisning, Notater. Fotnoter's places (under Chat) are gone
// with it being an option of Chat.
export const blockCatalogue: readonly BlockSpec[] = [
  {
    id: 'projects',
    zones: ['primary'],
    order: { primary: 0 },
    members: [],
    needs: ['genki:projects'],
    options: [],
    status: 'planned',
  },
  {
    id: 'threads',
    zones: ['primary'],
    order: { primary: 1 },
    members: ['Threads', 'SignedIn'],
    needs: ['channel:conversations'],
    options: [],
    status: 'built',
  },
  {
    id: 'settings',
    zones: ['primary'],
    order: { primary: 3 },
    slot: 'foot',
    members: ['SettingsLinks', 'Settings'],
    needs: [],
    options: [],
    status: 'built',
  },
  {
    id: 'chat',
    zones: ['main', 'secondary'],
    order: { main: 2, secondary: 1 },
    members: [
      'Conversation',
      'Answer',
      'Composer',
      'ComposerDisclaimer',
      'Welcome',
      'Suggestions',
      'AnswerActions',
      'VariantPicker',
      'EmptyState',
      'ErrorState',
      'NotFoundState',
    ],
    needs: ['service:chat'],
    options: [
      {
        id: 'footnotes',
        kind: 'switch',
        default: true,
        needs: ['component:sources|document-view'],
      },
      { id: 'suggestions', kind: 'switch', default: true },
      // The next look draws no follow-ups: no board has them.
      { id: 'followUps', kind: 'switch', default: true, looks: ['current'] },
      { id: 'disclaimer', kind: 'switch', default: true },
      { id: 'copy', kind: 'switch', default: true },
      // Off by default, as in kunnskapsassistenten since 6 October (AnswerActions' `feedback`).
      { id: 'feedback', kind: 'switch', default: false, needs: ['channel:feedback'] },
      { id: 'variantPicker', kind: 'switch', default: true, needs: ['service:variants'] },
      {
        id: 'attachments',
        kind: 'switch',
        default: false,
        needs: ['service:documents'],
        status: 'planned',
      },
    ],
    status: 'built',
  },
  {
    id: 'filter',
    zones: ['primary', 'main'],
    order: { primary: 2, main: 1 },
    members: ['Filter', 'CorpusChoice', 'CorpusLine', 'Documents'],
    needs: ['service:filter-fields', 'channel:facets'],
    options: [
      { id: 'corpus', kind: 'switch', default: true },
      { id: 'documents', kind: 'switch', default: true },
    ],
    status: 'built',
  },
  {
    id: 'approach',
    zones: ['main', 'secondary'],
    order: { main: 0, secondary: 0 },
    members: ['Approach'],
    // The card over each answer in the main column, the tool in the secondary panel, or both.
    both: true,
    needs: ['service:steps'],
    options: [
      { id: 'level', kind: 'choice', choices: ['standard', 'detailed'], default: 'standard' },
    ],
    status: 'built',
  },
  {
    id: 'sources',
    zones: ['secondary'],
    order: { secondary: 2 },
    members: ['Sources'],
    needs: ['service:datasets|documents'],
    options: [
      { id: 'disclaimer', kind: 'switch', default: true },
      { id: 'search', kind: 'switch', default: true },
    ],
    status: 'built',
  },
  // The answer's sources, as Kilder reads them, and not Kilder itself: without Kilder a footnote
  // opens the document here. The whole text needs a genki route that does not exist yet; until
  // then the view shows the excerpts the answer retrieved, in the document's own order.
  {
    id: 'document-view',
    zones: ['secondary', 'main'],
    order: { main: 4, secondary: 3 },
    members: ['DocumentView'],
    needs: ['service:datasets|documents'],
    options: [],
    status: 'built',
  },
  {
    id: 'notes',
    zones: ['secondary'],
    order: { secondary: 4 },
    members: [],
    needs: [],
    options: [],
    status: 'planned',
  },
];

const byId = new Map(blockCatalogue.map((spec) => [spec.id, spec]));

export const isBlockId = (value: unknown): value is BlockId =>
  typeof value === 'string' && byId.has(value as BlockId);

/** The catalogue's entry. Every `BlockId` has one. */
export const blockSpec = (id: BlockId): BlockSpec => byId.get(id) as BlockSpec;

/** Where the block stands when it is turned on and nobody chose: its first zone. */
export const defaultZone = (id: BlockId): Zone => blockSpec(id).zones[0] as Zone;

/** Where the builder may put a block: one zone, or `both` of its zones where it allows. */
export type Place = Zone | 'both';

/** The places the builder offers a block: each of its zones, then both where it allows. */
export const placesOf = (id: BlockId): Place[] => {
  const spec = blockSpec(id);
  return spec.both ? [...spec.zones, 'both'] : [...spec.zones];
};

/** The blocks that can stand in more than one zone, which the builder asks where to put. */
export const movableBlocks = blockCatalogue.filter((spec) => spec.zones.length > 1);

/** The blocks with one place, switched on and off where they stand. */
export const fixedBlocks = (zone: Zone) =>
  blockCatalogue.filter((spec) => spec.zones.length === 1 && spec.zones[0] === zone);

/** The blocks a zone may hold, in the zone's order. */
export const blocksAllowedIn = (zone: Zone): BlockId[] =>
  blockCatalogue
    .filter((spec) => spec.zones.includes(zone))
    .sort((a, b) => (a.order[zone] ?? 0) - (b.order[zone] ?? 0))
    .map((spec) => spec.id);

/** The catalogue key of a block's name, and of its description with `Help`. */
export const nameKey = (id: BlockId) =>
  `builder.${id.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())}` as BuilderKey;

/**
 * The block's options as a JSON Schema (2020-12), with ADR 0030's `x-label` and `x-widget`, so
 * `@genai/schema-forms` can draw them and a stored layout can be checked against them.
 */
export const settingsSchema = (id: BlockId) => {
  const spec = blockSpec(id);
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    properties: Object.fromEntries(
      spec.options.map((option) => [
        option.id,
        option.kind === 'switch'
          ? {
              type: 'boolean',
              default: option.default,
              'x-label': `${nameKey(id)}${capital(option.id)}`,
              'x-widget': 'switch',
            }
          : {
              type: 'string',
              enum: [...option.choices],
              default: option.default,
              'x-label': `${nameKey(id)}${capital(option.id)}`,
              'x-widget': 'radio',
            },
      ]),
    ),
  } as const;
};

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The catalogue key of a place's name: a zone's, or «Begge steder». */
export const placeKey = (place: Place) => `builder.zone${capital(place)}` as BuilderKey;

/** The catalogue key of what each place draws, for a block that may stand in both. */
export const placesHelpKey = (id: BlockId) => `${nameKey(id)}PlacesHelp` as BuilderKey;

/** The catalogue key of an option's label. */
export const optionKey = (id: BlockId, option: string) =>
  `${nameKey(id)}${capital(option)}` as BuilderKey;
