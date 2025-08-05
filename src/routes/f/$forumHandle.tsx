import {
  resolveIdentity,
  type ResolvedIdentity,
} from "@/helpers/cachedidentityresolver";
import { esavQuery } from "@/helpers/esquery";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, QueryClient } from "@tanstack/react-query";

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
    avatar?: { ref?: { $link: string } };
    banner?: { ref?: { $link: string } };
  };
};

type ResolvedForum = ForumDoc & {
  resolvedIdentity?: {
    handle: string;
    pdsUrl: string;
  };
};
type ResolvedForumData = {
  forumDoc: ForumDoc;
  identity: ResolvedIdentity;
};

const forumQueryOptions = (queryClient: QueryClient, forumHandle: string) => ({
  queryKey: ["forum", forumHandle],
  queryFn: async (): Promise<ResolvedForumData> => {
    if (!forumHandle) {
      throw new Error("Forum handle is required.");
    }
    const normalizedHandle = decodeURIComponent(forumHandle).replace(/^@/, "");

    const identity = await queryClient.fetchQuery({
      queryKey: ["identity", normalizedHandle],
      queryFn: () => resolveIdentity({ didOrHandle: normalizedHandle }),
      staleTime: 1000 * 60 * 60 * 24, // 24 hours
    });

    if (!identity) {
      throw new Error(`Could not resolve forum handle: @${normalizedHandle}`);
    }

    const forumRes = await esavQuery<{
      hits: { hits: { _source: ForumDoc }[] };
    }>({
      query: {
        bool: {
          must: [
            { term: { "$metadata.did": identity.did } },
            {
              term: {
                "$metadata.collection": "com.example.ft.forum.definition",
              },
            },
            { term: { "$metadata.rkey": "self" } },
          ],
        },
      },
    });

    const forumDoc = forumRes.hits.hits[0]?._source;
    if (!forumDoc) {
      throw new Error("Forum definition not found.");
    }

    return { forumDoc, identity };
  },
});

export const Route = createFileRoute("/f/$forumHandle")({
  loader: async ({ context: { queryClient }, params }) => {
  const normalizedHandle = decodeURIComponent(params.forumHandle).replace(/^@/, "");

  const identity = await queryClient.fetchQuery({
    queryKey: ["identity", normalizedHandle],
    queryFn: () => resolveIdentity({ didOrHandle: normalizedHandle }),
    staleTime: 1000 * 60 * 60 * 24,
  });

  if (!identity) {
    throw new Error(`Could not resolve forum handle: @${normalizedHandle}`);
  }

  const forums = queryClient.getQueryData<ResolvedForum[]>(["forums", "list"]);
  const forumFromList = forums?.find(f => f["$metadata.did"] === identity.did)

  const initialData: ResolvedForumData | undefined = forumFromList
    ? {
        forumDoc: forumFromList,
        identity: {
          handle: forumFromList.resolvedIdentity!.handle,
          did: forumFromList["$metadata.did"],
          pdsUrl: forumFromList.resolvedIdentity!.pdsUrl,
          bskyPds: false,
        },
      }
    : undefined

  if (initialData) {
    return initialData;
  }

  // Fallback to direct fetch
  const forumRes = await esavQuery<{
    hits: { hits: { _source: ForumDoc }[] };
  }>({
    query: {
      bool: {
        must: [
          { term: { "$metadata.did": identity.did } },
          {
            term: {
              "$metadata.collection": "com.example.ft.forum.definition",
            },
          },
          { term: { "$metadata.rkey": "self" } },
        ],
      },
    },
  });

  const forumDoc = forumRes.hits.hits[0]?._source;
  if (!forumDoc) {
    throw new Error("Forum definition not found.");
  }

  return {
    forumDoc,
    identity,
  };
},
  component: ForumHeader,
  pendingComponent: ForumHeaderContentSkeleton,
  errorComponent: ({ error }) => (
    <div className="text-red-500 text-center pt-10">
      Error: {(error as Error).message}
    </div>
  ),
});

function ForumHeaderContentSkeleton() {
  return (
    <>
      <div className="w-full flex flex-col items-center pt-6">
        <div className="w-full max-w-5xl rounded-2xl bg-gray-800 border border-t-0 shadow-2xl overflow-hidden">
          <div className="relative w-full h-32 bg-gray-700/50">
            <div className="absolute inset-0 bg-black/60" />
            <div className="relative z-10 flex items-center p-6 h-full">
              <div className="flex items-center gap-4 max-w-1/2">
                <div className="w-16 h-16 rounded-full bg-gray-700 animate-pulse" />
                <div>
                  <div className="h-8 w-48 bg-gray-700 rounded-md animate-pulse" />
                  <div className="mt-2 h-4 w-32 bg-gray-700 rounded-md animate-pulse" />
                </div>
              </div>
              <div className="ml-auto text-end max-w-1/2 space-y-2">
                <div className="h-4 w-full bg-gray-700 rounded-md animate-pulse" />
                <div className="h-4 w-10/12 ml-auto bg-gray-700 rounded-md animate-pulse" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pl-3 pr-[6px] py-1.5">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-5 w-20 bg-gray-700 rounded animate-pulse"
                />
              ))}
            </div>
            <div className="relative w-48">
              <div className="h-[34px] w-full bg-gray-700 rounded-[11px] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
      <Outlet />
    </>
  );
}
function ForumHeaderSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      navigate({ to: "/search", search: { q: query.trim() } });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-48">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search…"
        className="w-full rounded-[11px] border border-gray-700 bg-gray-900 px-2.5 py-1.5 pr-9 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <svg
        className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
        />
      </svg>
    </form>
  );
}
function ForumHeaderContent({
  forumDoc,
  identity,
  forumHandle,
}: {
  forumDoc: ForumDoc;
  identity: ResolvedIdentity;
  forumHandle: string;
}) {
  const did = identity?.did;
  const bannerCid = forumDoc?.$raw?.banner?.ref?.$link;
  const avatarCid = forumDoc?.$raw?.avatar?.ref?.$link;
  const bannerUrl =
    did && bannerCid
      ? `${identity?.pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${bannerCid}`
      : null;
  const avatarUrl =
    did && avatarCid
      ? `${identity?.pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${avatarCid}`
      : null;

  return (
    <div className="w-full flex flex-col items-center pt-6">
      <div className="w-full max-w-5xl rounded-2xl bg-gray-800 border border-t-0 shadow-2xl overflow-hidden">
        <div className="relative w-full h-32">
          {bannerUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${bannerUrl})` }}
            />
          ) : (
            <div className="absolute inset-0 bg-gray-700/50" />
          )}
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 flex items-center p-6 h-full">
            <div className="flex items-center gap-4 max-w-1/2">
              <Link
                //@ts-ignore
                to={`/f/${forumHandle}`}
                className="flex items-center gap-4 no-underline"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Forum avatar"
                    className="w-16 h-16 rounded-full border border-gray-700 object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-gray-400">
                    ?
                  </div>
                )}
                <div>
                  <div className="text-white text-3xl font-bold">
                    {forumDoc.displayName || "Unnamed Forum"}
                  </div>
                  <div className="text-blue-300 font-mono">
                    /f/{decodeURIComponent(forumHandle || "")}
                  </div>
                </div>
              </Link>
            </div>
            <div className="ml-auto text-gray-300 text-base text-end max-w-1/2">
              {forumDoc.description || "No description provided."}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pl-3 pr-[6px] py-1.5">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300 font-medium">
            {[
              "All Topics",
              "Announcements",
              "General",
              "Support",
              "Off-topic",
              "Introductions",
              "Guides",
              "Feedback",
            ].map((label) => (
              <button
                key={label}
                className="hover:underline hover:text-white transition"
                onClick={() => console.log(`Clicked ${label}`)}
              >
                {label}
              </button>
            ))}
          </div>

          <ForumHeaderSearch />
        </div>
      </div>
    </div>
  );
}

function ForumHeader() {
  const { forumHandle } = Route.useParams();
  const initialData = Route.useLoaderData();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    ...forumQueryOptions(queryClient, forumHandle),
    initialData,
  });

  const { forumDoc, identity } = data;

  return (
    <>
      <ForumHeaderContent
        forumDoc={forumDoc}
        identity={identity}
        forumHandle={forumHandle}
      />
      <Outlet />
    </>
  );
}
