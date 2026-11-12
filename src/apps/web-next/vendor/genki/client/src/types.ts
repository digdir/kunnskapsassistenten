export type FilterType = 'multiselect' | 'contains' | 'not-in-set';

export interface FilterField {
  field: string;
  type?: FilterType;
  'value-type'?: 'string' | 'integer';
  'selected-options': (string | number)[];
}

export interface FilterSet {
  fields: FilterField[];
}

export interface FieldError {
  path: string;
  message: string;
}

export interface InputFieldInfo {
  [key: string]: unknown;
}

export interface Service {
  id: string;
  title?: string;
  description?: string;
  agentId?: string;
  mode?: string;
  default: boolean;
  chat: boolean;
  status?: 'paused';
  statusReason?: string;
  inputFields?: InputFieldInfo[];
}

export interface Excerpt {
  chunkId: string;
  text: string;
  position?: number;
}

export interface Source {
  index?: number;
  title: string;
  url?: string;
  documentId?: string;
  excerpts: Excerpt[];
  excerpt?: string;
  version?: string;
  publishedAt?: string;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface Answer {
  id: string;
  text: string;
  conversationId?: string;
  taskId?: string;
  serviceVersion?: number;
  sources: Source[];
  citations: string[];
  noAnswer: boolean;
  notice?: string;
  usage?: Usage;
  table?: unknown;
  csv?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AskRequest {
  service: string;
  question?: string;
  messages?: Message[];
  conversationId?: string;
  newConversation?: boolean;
  filters?: FilterSet;
  dataset?: { tenant: string; key: string };
  input?: Record<string, unknown>;
  overrides?: Record<string, unknown>;
}

export type Step = { event?: string; stage?: string; tool?: string; iteration?: number } & Record<
  string,
  unknown
>;

export type StreamEvent =
  | { type: 'conversation'; conversationId: string }
  | { type: 'text'; text: string }
  | { type: 'retract' }
  | { type: 'step'; step: Step }
  | { type: 'reasoning'; text: string }
  | { type: 'sources'; sources: Source[]; citations: string[] }
  | { type: 'done'; answer: Answer };

export interface StreamOptions {
  live?: boolean;
  steps?: boolean;
  signal?: AbortSignal;
}

export interface AskHandlers {
  onText?(text: string): void;
  onRetract?(): void;
  onStep?(step: Step): void;
  onSources?(sources: Source[]): void;
  signal?: AbortSignal;
}

export interface Conversation {
  id: string;
  topic: string | null;
  agentId: string;
  userId: string;
  tags: string[];
  created: number;
}

export interface ConversationChunk {
  chunkId: string;
  docTitle: string;
  docNum: string | null;
  contentMarkdown: string;
}

export interface ConversationMessage {
  id: string;
  text: string;
  role: string | null;
  created: number;
  tags: string[];
  filterValue: unknown;
  chunks: ConversationChunk[];
}

export interface ConversationPage {
  conversations: Conversation[];
  total: number;
  pageSize: number;
  pageIndex: number;
}

export interface FacetOption {
  value: string;
  count: number;
  selected: boolean;
}

export interface FacetField {
  field: string;
  options: FacetOption[];
}

export interface DatasetFilter {
  field: string;
  kinds: string[];
}

export interface Dataset {
  id: string;
  name: string;
  description: string | null;
  status: string;
  filters?: DatasetFilter[];
}

export interface FacetRequest {
  tenant: string;
  datasetConfigKey: string;
  fields: string[];
  filter?: FilterSet;
}

export interface FeedbackRequest {
  taskId: string;
  rating: 'up' | 'down';
  comment?: string;
  reasons?: string[];
}
