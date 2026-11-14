export * from './catalogue.js';
export * from './layout.js';
export * from './templates.js';
export * from './facts.js';
export * from './profile.js';

import type { Need } from './catalogue.js';
import type { BuilderKey } from './i18n.js';

export { enBuilder, nbBuilder, type BuilderKey } from './i18n.js';

const needKeys: Record<Need, BuilderKey> = {
  'service:chat': 'builder.needServiceChat',
  'service:datasets|documents': 'builder.needServiceSources',
  'service:documents': 'builder.needServiceDocuments',
  'service:filter-fields': 'builder.needServiceFilterFields',
  'service:steps': 'builder.needServiceSteps',
  'service:variants': 'builder.needServiceVariants',
  'channel:conversations': 'builder.needChannelConversations',
  'channel:facets': 'builder.needChannelFacets',
  'channel:feedback': 'builder.needChannelFeedback',
  'component:sources|document-view': 'builder.needComponentSourcesOrDocumentView',
  'genki:projects': 'builder.needGenkiProjects',
};

/** The catalogue key of the reason a need is not met. */
export const needKey = (need: Need): BuilderKey => needKeys[need];
