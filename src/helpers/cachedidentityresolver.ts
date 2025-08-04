export type ResolvedIdentity =
  | {
      handle: string
      did: string
      pdsUrl: string
      bskyPds: boolean
    }
  | undefined
const HANDLE_DID_CACHE_TIMEOUT = 60 * 60 * 1000; // 1 hour
export async function cachedResolveIdentity({
  didOrHandle,
  cacheTimeout = HANDLE_DID_CACHE_TIMEOUT,
  get,
  set,
}: {
  didOrHandle: string;
  cacheTimeout?: number;
  get: (key: string) => any;
  set: (key: string, value: string) => void;
}): Promise<ResolvedIdentity|undefined> {
  const isDidInput = didOrHandle.startsWith("did:");
  const cacheKey = `handleDid:${didOrHandle}`;
  const now = Date.now();
  const cached = get(cacheKey);
  if (
    cached &&
    cached.value &&
    cached.time &&
    now - cached.time < cacheTimeout
  ) {
    try {
      return JSON.parse(cached.value);
    } catch {}
  }
  const url = `https://free-fly-24.deno.dev/?${
    isDidInput
      ? `did=${encodeURIComponent(didOrHandle)}`
      : `handle=${encodeURIComponent(didOrHandle)}`
  }`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to resolve handle/did");
  const data = await res.json();
  set(cacheKey, JSON.stringify(data));
  // also cache by did if input was handle
  if (!isDidInput && data.did) {
    set(`handleDid:${data.did}`, JSON.stringify(data));
  }
  return data;
}