import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import type { EsavDocument, QueryState, LogEntry } from './types';
const MAX_LOG_SIZE = 500;

/**
 * Manages the WebSocket instance itself.
 * Should only be written to by the provider.
 */
export const websocketAtom = atom<WebSocket | null>(null);

/**
 * Tracks the current status of the WebSocket connection.
 */
export const websocketStatusAtom = atom<'connecting' | 'open' | 'closed'>('closed');

/**
 * A global, normalized cache for all documents received from the server.
 * Maps a document URI (at://...) to its full data.
 * This prevents data duplication across multiple queries.
 */
export const documentsAtom = atom<Record<string, EsavDocument>>({});

/**
 * A family of atoms to hold the state for each individual query.
 * You get the state for a query by providing its unique queryId.
 */
export const queryStateFamily = atomFamily((_queryId: string) =>
  atom<QueryState | null>(null)
);

/**
 * Tracks active subscriptions and their component usage count.
 * This is an internal atom used by our hooks to know when to
 * send `subscribe` and `unsubscribe` messages.
 */
export const activeSubscriptionsAtom = atom<
  Record<string, { count: number; esQuery: Record<string, any> }>
>({});


/**
 * Holds the array of log entries for display.
 */
export const logEntriesAtom = atom<LogEntry[]>([]);

let logIdCounter = 0;

/**
 * A "write-only" atom to add a new entry to the log.
 * This encapsulates the logic for creating a new entry with an ID and timestamp.
 * Any component can call this to add a log without needing to know the implementation details.
 */
export const addLogEntryAtom = atom(
  null,
  (get, set, newEntry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const entry: LogEntry = {
      id: logIdCounter++,
      timestamp: new Date(),
      ...newEntry,
    };
    const currentLog = get(logEntriesAtom);
    const newLog = [entry, ...currentLog];
    if (newLog.length > MAX_LOG_SIZE) {
      newLog.length = MAX_LOG_SIZE;
    }
    set(logEntriesAtom, newLog);
  }
);

export const queryCacheAtom = atom<Record<string, QueryState>>({});