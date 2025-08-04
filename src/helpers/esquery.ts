export async function esavQuery<T = unknown>(
  esQuery: object,
  options?: {
    endpoint?: string;
    signal?: AbortSignal;
  }
): Promise<T> {
  const endpoint = options?.endpoint ?? "https://esav.whey.party/xrpc/com.example.prototypeESQuery";
  const q = encodeURIComponent(JSON.stringify(esQuery));
  const url = `${endpoint}?q=${q}`;

  const res = await fetch(url, {
    method: "GET",
    signal: options?.signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ESAV query failed: ${res.status} ${res.statusText} - ${errText}`);
  }

  return res.json();
}