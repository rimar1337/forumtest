// A document as stored in our global cache
export interface EsavDocument {
  cid: string;
  doc: QueryDoc;
}

export interface QueryDoc {
  "$metadata.uri": string;
  "$metadata.cid": string;
  "$metadata.did": string;
  "$metadata.collection": string;
  "$metadata.rkey": string;
  "$metadata.indexedAt": string;
  $raw?: Record<string, unknown>;
  [key: string]: unknown;
}

// The state for a single query subscription
export interface QueryState {
  ecid: string;
  result: string[]; // An ordered array of document URIs
}

// The server->client message we expect
export interface QueryDeltaMessage {
  type: 'query-delta';
  documents?: Record<string, EsavDocument>;
  queries?: Record<string, QueryState>;
}

// The client->server message for subscribing
export interface SubscribeMessage {
  type: 'subscribe';
  queryId: string;
  esquery: Record<string, any>;
  ecid?: string; // Optional last known ECID
}

// The client->server message for unsubscribing
export interface UnsubscribeMessage {
  type: 'unsubscribe';
  queryId: string;
}

export type LogEntryType = 'incoming' | 'outgoing' | 'status' | 'error';

export interface LogEntry {
  id: number;
  timestamp: Date;
  type: LogEntryType;
  payload: any; 
}