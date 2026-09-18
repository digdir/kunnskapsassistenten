export interface Source {
  docNum: string;
  title: string;
  url: string;
  /** 1-based, matching the `[N]` markers in the answer text. */
  marker: number;
  excerpt?: string;
}

export type Stage = 'starting' | 'searching' | 'reading' | 'writing' | 'done';

export interface StageEvent {
  type: 'stage';
  stage: Stage;
  iteration: number;
  maxIterations: number;
  queries?: string[];
}

export interface DeltaEvent {
  type: 'delta';
  text: string;
}

export interface SourcesEvent {
  type: 'sources';
  sources: Source[];
}

export interface ConversationEvent {
  type: 'conversation';
  id: string;
  topic: string;
}

export interface DoneEvent {
  type: 'done';
  conversationId: string;
  insufficient: boolean;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  conversationId?: string;
}

export type TurnEvent =
  ConversationEvent | StageEvent | DeltaEvent | SourcesEvent | DoneEvent | ErrorEvent;

export interface AskRequest {
  query: string;
  model?: string;
  conversationId?: string;
}

export interface ConversationSummary {
  id: string;
  topic: string;
  created: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  created: number;
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  messages: Message[];
}

export interface ModelOption {
  id: string;
  label: string;
  isDefault: boolean;
  description?: string;
}

export interface Capabilities {
  filters: boolean;
  othersThreads: boolean;
  threadTitles: boolean;
}
