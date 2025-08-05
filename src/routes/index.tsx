import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, QueryClient } from "@tanstack/react-query";
import "../App.css";
import { esavQuery } from "@/helpers/esquery";
import { resolveIdentity } from "@/helpers/cachedidentityresolver";

type ForumDoc = {
  "$metadata.uri": string;
  "$metadata.cid": string;
  "$metadata.did": string;
  "$metadata.collection": string;
  "$metadata.rkey": string;
  "$metadata.indexedAt": string;
  displayName?: string;
  description?: string;
  $raw?: {
    avatar?: {
      ref?: { $link: string };
    };
    banner?: {
      ref?: { $link: string };
    };
  };
  [key: string]: any;
};

type ResolvedForum = ForumDoc & {
  resolvedIdentity?: {
    handle: string;
    pdsUrl: string;
  };
};

const forumsQueryOptions = (queryClient: QueryClient) => ({
  queryKey: ["forums", "list"],
  queryFn: async (): Promise<ResolvedForum[]> => {
    const res = await esavQuery<{
      hits: { hits: { _source: ForumDoc }[] };
    }>({
      query: {
        bool: {
          must: [
            {
              term: {
                "$metadata.collection": "com.example.ft.forum.definition",
              },
            },
            { term: { "$metadata.rkey": "self" } },
          ],
        },
      },
      size: 50,
    });
    const rawForums = res.hits.hits.map((hit) => hit._source);

    const resolvedForums = (
      await Promise.all(
        rawForums.map(async (forum) => {
          const did = forum?.["$metadata.did"];
          if (!did) return null;

          try {
            const identity = await queryClient.fetchQuery({
              queryKey: ["identity", did],
              queryFn: () => resolveIdentity({ didOrHandle: did }),
              staleTime: 1000 * 60 * 60 * 24,
            });
            return identity
              ? {
                  ...forum,
                  resolvedIdentity: {
                    handle: identity.handle,
                    pdsUrl: identity.pdsUrl,
                  },
                }
              : null;
          } catch (e) {
            console.warn(`Failed to resolve identity for ${did}`, e);
            return null;
          }
        })
      )
    ).filter(Boolean) as ResolvedForum[];

    return resolvedForums;
  },
});

export const Route = createFileRoute("/")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(forumsQueryOptions(queryClient)),
  component: Home,
  pendingComponent: ForumGridSkeleton,
  errorComponent: ({ error }) => (
    <div className="text-red-500 p-4">Error: {(error as Error).message}</div>
  ),
});

function ForumGridSkeleton() {
  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-7xl flex items-center flex-col">
        <div className="w-full max-w-5xl mt-4 px-4 sm:px-0">
          <div>
            <span className="text-gray-50 font-bold text-2xl">Forums</span>
          </div>
          <div className="mt-4 w-full forum-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <ForumCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ForumCardSkeleton() {
  return (
    <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-sm aspect-video animate-pulse">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 flex flex-col justify-between h-full p-5">
        <div className="flex justify-between items-start gap-4">
          <div className="flex flex-col">
            <div className="h-5 w-40 bg-gray-700 rounded-md mb-2" />
            <div className="h-7 w-56 bg-gray-700 rounded-md" />
          </div>
          <div className="w-12 h-12 rounded-full bg-gray-700 flex-shrink-0" />
        </div>
        <div className="flex flex-col gap-2 mt-4">
          <div className="h-4 w-full bg-gray-600 rounded-md" />
          <div className="h-4 w-3/4 bg-gray-600 rounded-md" />
          <div className="h-3 w-1/2 bg-gray-700 rounded-md mt-2" />
        </div>
      </div>
    </div>
  );
}

function Home() {
  const initialData = Route.useLoaderData();
  const queryClient = useQueryClient();

  const { data: forums }: { data: ResolvedForum[] } = useQuery({
    ...forumsQueryOptions(queryClient),
    initialData,
  });

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-7xl flex items-center flex-col">
        <div className="w-full max-w-5xl mt-4 px-4 sm:px-0">
          <div>
            <span className="text-gray-50 font-bold text-2xl">Forums</span>
          </div>

          <div className="mt-4 w-full forum-grid">
            {forums.map((forum) => {
              const did = forum?.["$metadata.did"];
              const { resolvedIdentity } = forum;
              if (!resolvedIdentity) return null;

              const cidBanner = forum?.$raw?.banner?.ref?.$link;
              const cidAvatar = forum?.$raw?.avatar?.ref?.$link;

              const bannerUrl =
                cidBanner && resolvedIdentity
                  ? `${resolvedIdentity.pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cidBanner}`
                  : null;

              const avatarUrl =
                cidAvatar && resolvedIdentity
                  ? `${resolvedIdentity.pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cidAvatar}`
                  : null;

              return (
                <Link
                  // @ts-ignore
                  to={`/f/@${resolvedIdentity.handle}`}
                  className="block"
                  key={forum?.$metadata?.uri}
                >
                  <div
                    key={forum?.$metadata?.uri}
                    className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-sm aspect-video hover:border-blue-500/50 transition-all duration-200"
                  >
                    {bannerUrl && (
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${bannerUrl})` }}
                      />
                    )}
                    <div className="absolute inset-0 bg-black/60" />
                    <div className="relative z-10 flex flex-col justify-between h-full p-5">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex flex-col">
                          {resolvedIdentity?.handle && (
                            <div className="text-blue-300 text-base font-mono mb-1">
                              /f/@{resolvedIdentity.handle}
                            </div>
                          )}
                          <div className="text-white text-2xl font-bold leading-tight">
                            {forum.displayName || "Unnamed Forum"}
                          </div>
                        </div>
                        {avatarUrl && (
                          <img
                            src={avatarUrl}
                            alt="Avatar"
                            className="w-12 h-12 rounded-full object-cover border border-zinc-700 flex-shrink-0"
                          />
                        )}
                      </div>
                      <div className="flex flex-col gap-2 mt-4">
                        <div className="text-sm text-gray-200 line-clamp-2">
                          {forum.description || "No description available."}
                        </div>
                        <div className="text-xs text-gray-400 font-medium">
                          0 members · ~0 topics · Active a while ago
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
