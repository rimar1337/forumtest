import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  activeSubscriptionsAtom,
  documentsAtom,
  queryStateFamily,
  websocketAtom,
  websocketStatusAtom,
  addLogEntryAtom,
  queryCacheAtom
} from './atoms';
import type { EsavDocument, QueryDoc, SubscribeMessage, UnsubscribeMessage } from './types';
import { atomWithStorage } from 'jotai/utils';

interface UseEsavQueryOptions {
  enabled?: boolean;
}

/**
 * The primary hook for subscribing to a live query and getting its results.
 * Manages sending subscribe/unsubscribe messages automatically.
 *
 * @param queryId A unique ID for this query.
 * @param esQuery The full Elasticsearch query object.
 * @param options Hook options, like `enabled`.
 * @returns The hydrated query results and loading status.
 */
export function useEsavQuery(
  queryId: string,
  esQuery: Record<string, any>,
  options: UseEsavQueryOptions = { enabled: true }
) {
  // @ts-expect-error intended
  const [activeSubscriptions, setActiveSubscriptions] = useAtom(activeSubscriptionsAtom);
  const ws = useAtomValue(websocketAtom);
  const addLog = useSetAtom(addLogEntryAtom);
  const wsStatus = useAtomValue(websocketStatusAtom);
  //const queryState = useAtomValue(queryStateFamily(queryId));
  const liveQueryState = useAtomValue(queryStateFamily(queryId));
  const [cache, setCache] = useAtom(queryCacheAtom);
  const cachedQueryState = cache[queryId];
  const queryState = liveQueryState ?? cachedQueryState;
  useEffect(() => {
    // If we receive valid new data from the live query, update our cache.
    if (liveQueryState?.result) {
      setCache((prevCache) => {
        // Avoid unnecessary updates if the data is identical
        if (prevCache[queryId] === liveQueryState) {
          return prevCache;
        }
        return {
          ...prevCache,
          [queryId]: liveQueryState,
        };
      });
    }
  }, [liveQueryState, queryId, setCache]);

  const allDocuments = useAtomValue(documentsAtom);

  const { enabled = true } = options;
  const stringifiedEsQuery = useMemo(() => JSON.stringify(esQuery), [esQuery]);

  const esQueryRef = useRef(esQuery);
  const queryStateRef = useRef(queryState); 
  useEffect(() => {
    esQueryRef.current = esQuery;
    queryStateRef.current = queryState;
  });

  useEffect(() => {
    if (!enabled || wsStatus !== 'open' || !ws) {
      return;
    }

    const currentQuery = esQueryRef.current;
    
    setActiveSubscriptions((prev) => {
      const count = prev[queryId]?.count ?? 0;
      if (count === 0) {
        console.log(`[ESAV] Subscribing to ${queryId}`);
        const message: SubscribeMessage = {
          type: 'subscribe',
          queryId,
          esquery: currentQuery,
          ecid: queryStateRef.current?.ecid,
        };
        addLog({ type: 'outgoing', payload: message });
        ws.send(JSON.stringify(message));
      }
      return { ...prev, [queryId]: { count: count + 1, esQuery: currentQuery } };
    });

    return () => {
      setActiveSubscriptions((prev) => {
        const count = prev[queryId]?.count ?? 1;
        if (count <= 1) {
          console.log(`[ESAV] Unsubscribing from ${queryId}`);
          if (ws.readyState === WebSocket.OPEN) {
            const message: UnsubscribeMessage = { type: 'unsubscribe', queryId };
            addLog({ type: 'outgoing', payload: message });
            ws.send(JSON.stringify(message));
          }
          const { [queryId]: _, ...rest } = prev;
          return rest;
        } else {
          return { ...prev, [queryId]: { ...prev[queryId], count: count - 1 } };
        }
      });
    };
  }, [queryId, stringifiedEsQuery, enabled, ws, wsStatus, setActiveSubscriptions, addLog]);


  const hydratedData = useMemo(() => {
    if (!queryState?.result) return [];
    return queryState.result
      .map((uri) => allDocuments[uri])
      .filter(Boolean);
  }, [queryState?.result, allDocuments]);
  
  //const isLoading = wsStatus !== 'open' || queryState === null;
  const isLoading = !queryState;

  return {
    data: hydratedData,
    uris: queryState?.result ?? [],
    ecid: queryState?.ecid,
    isLoading,
    status: wsStatus,
  };
}

type DocumentMap = Record<string, EsavDocument | undefined>;

/**
 * A simple hook to get a single document from the global cache.
 * @param uri The at:// URI of the document.
 */
export function useEsavDocument(uri: string): EsavDocument | undefined;
export function useEsavDocument(uri: string[]): DocumentMap;
export function useEsavDocument(uri: undefined): undefined;
export function useEsavDocument(uri: string | string[] | undefined): EsavDocument | undefined | DocumentMap {
  const allDocuments = useAtomValue(documentsAtom);

  if (typeof uri === 'string') {
    return allDocuments[uri];
  }

  if (Array.isArray(uri)) {
    return uri.reduce<DocumentMap>((acc, key) => {
      acc[key] = allDocuments[key];
      return acc;
    }, {});
  }

  return undefined;
}


export interface Profile {
  did: string;
  handle: string;
  pdsUrl: string;
  profile: {
    "$type": "app.bsky.actor.profile",
    "avatar"?: {
      "$type": "blob",
      "ref": {
        "$link": string
      },
      "mimeType": string,
      "size": number
    },
    "banner"?: {
      "$type": "blob",
      "ref": {
        "$link": string
      },
      "mimeType": string,
      "size": number
    },
    "createdAt": string,
    "description": string,
    "displayName": string
  };
}

/**
 * A persistent atom to store the mapping from a user's handle to their DID.
 * This avoids re-resolving handles we've already seen.
 *
 * Stored in localStorage under the key 'handleToDidCache'.
 */
const handleToDidAtom = atomWithStorage<Record<string, string>>(
  'handleToDidCache',
  {}
);

/**
 * A persistent atom to store the full profile document, keyed by the user's DID.
 * This is the primary cache for profile data.
 *
 * Stored in localStorage under the key 'didToProfileCache'.
 */
const didToProfileAtom = atomWithStorage<Record<string, Profile>>(
  'didToProfileCache',
  {}
);

/**
 * Get a cached Profile document using Jotai persistent atoms.
 * It will first check the cache, and if the profile is not found,
 * it will fetch it from the network and update the cache.
 *
 * @param input The user's did or handle (with or without the @)
 * @returns A tuple containing the Profile (or null) and a boolean indicating if it's loading.
 */
export const useCachedProfileJotai = (input?: string | null): [Profile | null, boolean] => {
  const [handleToDidCache, setHandleToDidCache] = useAtom(handleToDidAtom);
  const [didToProfileCache, setDidToProfileCache] = useAtom(didToProfileAtom);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const resolveAndFetchProfile = async () => {
      if (!input) {
        setProfile(null);
        return;
      }
      
      setIsLoading(true);
      
      const normalizedInput = normalizeHandle(input);
      const type = classifyIdentifier(normalizedInput);

      if (type === "unknown") {
        console.error("Invalid identifier provided:", input);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      let didFromCache: string | undefined;
      if (type === 'handle') {
        didFromCache = handleToDidCache[normalizedInput];
      } else {
        didFromCache = normalizedInput;
      }

      if (didFromCache && didToProfileCache[didFromCache]) {
        setProfile(didToProfileCache[didFromCache]);
        setIsLoading(false);
        return;
      }

      try {
        const queryParam = type === "handle" ? "handle" : "did";
        const res = await fetch(
          `https://esav.whey.party/xrpc/party.whey.esav.resolveIdentity?${queryParam}=${normalizedInput}&includeBskyProfile=true`
        );

        if (!res.ok) {
          throw new Error(`Failed to fetch profile for ${input}`);
        }
        
        const newProfile: Profile = await res.json();
        
        setDidToProfileCache(prev => ({ ...prev, [newProfile.did]: newProfile }));
        setHandleToDidCache(prev => ({ ...prev, [newProfile.handle]: newProfile.did }));
        
        setProfile(newProfile);

      } catch (error) {
        console.error(error);
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    resolveAndFetchProfile();
    
  }, [input, handleToDidCache, didToProfileCache, setHandleToDidCache, setDidToProfileCache]);

  return [profile, isLoading];
};

export type IdentifierType = "did" | "handle" | "unknown";

function classifyIdentifier(input: string | null | undefined): IdentifierType {
  if (!input) return "unknown";
  if (/^did:[a-z0-9]+:[\w.-]+$/i.test(input)) return "did";
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(input)) return "handle";
  return "unknown";
}

function normalizeHandle(input: string): string {
  if (!input) return '';
  return input.startsWith('@') ? input.slice(1) : input;
}



type AtUriParts = {
  did: string;
  collection: string;
  rkey: string;
};

export function parseAtUri(uri: string): AtUriParts | null {
  if (!uri.startsWith('at://')) return null;

  const parts = uri.slice(5).split('/');
  if (parts.length < 3) return null;

  const [did, collection, ...rest] = parts;
  const rkey = rest.join('/'); // in case rkey includes slashes (rare, but allowed)

  return { did, collection, rkey };
}
/**
 * use useEsavDocument instead its nicer
 * @deprecated
 * @param uris 
 * @returns 
 */
export function useResolvedDocuments(uris: string[]) {
  const allDocuments = useAtomValue(documentsAtom);

  return uris.reduce<Record<string, QueryDoc | undefined>>((acc, uri) => {
    acc[uri] = allDocuments[uri].doc;
    return acc;
  }, {});
}