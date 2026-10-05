/**
 * The shared domain types. Every view codes against these; ask before
 * changing one, because all four panels read them.
 *
 * Fields the design needs and the backend does not have yet are marked
 * `backend: mangler, se API-bestilling A1/A2/A3` where they are declared.
 * A1 is source attribution, A2 facet counts, A3 upload. See
 * design/skal-dette-implementeres.md.
 */
export type { Citation } from './citation';
export type { FacetValue, FilterDimension, FilterFacet, FilterSelection } from './filter';
export { emptyFilterSelection, filterDimensions, isEmptySelection } from './filter';
export type { Message, MessageRole, MessageStatus } from './message';
export type { RetrievalDetails, ThinkingStep, ThinkingStepKind } from './retrieval';
export type {
  AnswerSources,
  CitationTarget,
  Excerpt,
  RelevanceLevel,
  SourceDocument,
} from './source';
export { citationAccessibleName, citationTargets, excerptDomId, relevanceLabels } from './source';
export { chatErrorCode } from './stream';
export type { ChatError, ChatErrorCode, StreamEvent } from './stream';
export { threadFromQuestion } from './thread';
export { MAX_UPLOAD_BYTES, UPLOAD_ACCEPT, uploadErrorCode, userDocumentType } from './userDocument';
export type {
  UploadErrorCode,
  UserDocument,
  UserDocumentStatus,
  UserDocumentType,
} from './userDocument';
export type { Thread, ThreadDetail } from './thread';
