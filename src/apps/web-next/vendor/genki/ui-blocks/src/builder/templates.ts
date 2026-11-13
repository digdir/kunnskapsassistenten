// The design's eight templates, from board «3 · byggeklosser og forhåndsvisning» («Maler»), in
// its order. genki #210 holds nine of its own; these are the canvas's, as V2-0007 settles.
//
// A template lists the blocks the design puts in each zone, also those not built yet: the
// builder shows them marked «kommer», and `fromTemplate` leaves them out. Fotnoter is Chat's
// option, on by default, so it is not listed.
import { blockSpec, type BlockId, type Zone } from './catalogue.js';
import { normalised, type AssistantLayout, type BuilderState } from './layout.js';
import type { BuilderKey } from './i18n.js';

export const templateIds = [
  'knowledge-assistant',
  'knowledge-assistant-next',
  'sources-only',
  'approach-only',
  'without-filter',
  'with-projects',
  'without-secondary',
  'without-primary',
  'chat-only',
] as const;
export type TemplateId = (typeof templateIds)[number];

export const templates: Readonly<Record<TemplateId, Readonly<Record<Zone, readonly BlockId[]>>>> = {
  // Innstillinger too, which the canvas leaves out, and no Dokumentvisning, which the canvas has:
  // the template is kunnskapsassistenten, and its «Prøv assistenten» must be the same app as the
  // UI blocks preview, which has Innstillinger in the foot and no document view.
  'knowledge-assistant': {
    primary: ['threads', 'filter', 'settings'],
    main: ['approach', 'chat'],
    secondary: ['sources', 'notes'],
  },
  // The same blocks in the dev boards' look (`templateLook`), built here step by step, so
  // «Kunnskapsassistenten» keeps drawing what it draws today.
  'knowledge-assistant-next': {
    primary: ['threads', 'filter', 'settings'],
    main: ['approach', 'chat'],
    // Fremgangsmåte also as the tool (dev-verktoy-1), beside its bar over each answer.
    secondary: ['approach', 'sources', 'notes'],
  },
  'sources-only': { primary: ['threads', 'filter'], main: ['chat'], secondary: ['sources'] },
  'approach-only': { primary: ['threads'], main: ['chat'], secondary: ['approach'] },
  'without-filter': {
    primary: ['threads'],
    main: ['approach', 'chat'],
    secondary: ['sources', 'document-view'],
  },
  'with-projects': {
    primary: ['projects', 'threads'],
    main: ['approach', 'chat'],
    secondary: ['sources', 'document-view'],
  },
  'without-secondary': {
    primary: ['threads', 'filter'],
    main: ['approach', 'chat'],
    secondary: [],
  },
  'without-primary': {
    primary: [],
    main: ['approach', 'chat'],
    secondary: ['sources', 'document-view'],
  },
  'chat-only': { primary: [], main: ['approach', 'chat'], secondary: [] },
};

/**
 * The look a layout's template draws. `next` is the «_Ready for dev» boards' (the cards frame, the
 * panels' titles, the profile menu), and every new look sits behind it until it is the only one;
 * `current` is what the other templates draw today.
 */
export type TemplateLook = 'current' | 'next';

export const templateLook = (template: string | undefined): TemplateLook =>
  template === 'knowledge-assistant-next' ? 'next' : 'current';

/** The catalogue key of a template's name. */
export const templateKey = (id: TemplateId) =>
  `builder.template${id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')}` as BuilderKey;

/**
 * The template as a builder state: the blocks that are built, in its zones. `offered` leaves out
 * the blocks the service cannot back, as the builder does. Choosing a template replaces the
 * layout, «Å bytte mal erstatter oppsettet du har nå».
 */
export const fromTemplate = (
  id: TemplateId,
  offered: (block: BlockId) => boolean = () => true,
): BuilderState => {
  const template = templates[id];
  const take = (zone: Zone) =>
    template[zone]
      .filter((block) => blockSpec(block).status === 'built' && offered(block))
      .map((block) => ({ block }));
  const layout: AssistantLayout = normalised({
    version: 1,
    template: id,
    zones: { primary: take('primary'), main: take('main'), secondary: take('secondary') },
  });
  return { layout, chosen: {} };
};
