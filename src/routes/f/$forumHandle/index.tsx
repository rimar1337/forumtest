import {
  createFileRoute,
  useLoaderData,
  useNavigate,
  Link,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  cachedResolveIdentity,
  type ResolvedIdentity,
} from "@/helpers/cachedidentityresolver";
import { usePersistentStore } from "@/providers/PersistentStoreProvider";
import { esavQuery } from "@/helpers/esquery";
import * as Select from "@radix-ui/react-select";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ChevronDownIcon,
  CheckIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import { useAuth } from "@/providers/PassAuthProvider";
import { AtUri } from "@atproto/api";

type PostDoc = {
  $type: "com.example.ft.topic.post";
  $metadata: {
    uri: string;
    did: string;
    rkey: string;
    indexedAt: string;
  };
  forum: string;
  text: string;
  title: string;
  reply?: any;
  participants?: string[];
  replyCount?: number;
  [key: string]: any;
};

export const Route = createFileRoute("/f/$forumHandle/")({
  loader: ({ params }) => ({ forumHandle: params.forumHandle }),
  component: Forum,
});

function getRelativeTimeString(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const now = new Date();
  if (isNaN(date.getTime())) return "invalid date";
  const diff = (date.getTime() - now.getTime()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],["month", 2592000],["week", 604800],["day", 86400],["hour", 3600],["minute", 60],["second", 1],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, secondsInUnit] of units) {
    const value = Math.round(diff / secondsInUnit);
    if (Math.abs(value) >= 1) return formatter.format(value, unit);
  }
  return "just now";
}

function ForumHeaderSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between mb-4 gap-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-16 bg-gray-700 rounded-md" />
          <div className="h-9 w-[150px] bg-gray-900 border border-gray-700 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-16 bg-gray-700 rounded-md" />
          <div className="h-9 w-[150px] bg-gray-900 border border-gray-700 rounded-md" />
        </div>
      </div>
      <div className="ml-auto h-9 w-28 bg-gray-700 rounded-md" />
    </div>
  );
}
function TopicRowSkeleton() {
  return (
    <tr className="bg-gray-800 animate-pulse">
      <td className="px-4 py-3 rounded-l-lg min-w-52">
        <div className="space-y-2">
          <div className="h-5 w-3/4 bg-gray-700 rounded-md" />
          <div className="h-4 w-full bg-gray-600 rounded-md" />
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex -space-x-2 justify-center">
          <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-800" />
          <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-800" />
          <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-800" />
        </div>
      </td>

      <td className="px-4 py-3 text-center">
        <div className="w-8 h-5 bg-gray-700 rounded-md mx-auto" />
      </td>

      <td className="px-4 py-3 text-center">
        <div className="w-10 h-5 bg-gray-700 rounded-md mx-auto" />
      </td>

      <td className="px-4 py-3 text-right rounded-r-lg">
        <div className="flex flex-col items-end space-y-1.5">
          <div className="h-4 w-24 bg-gray-700 rounded-md" />
          <div className="h-3 w-20 bg-gray-600 rounded-md" />
        </div>
      </td>
    </tr>
  );
}

export function Forum({ forumHandle: propHandle }: { forumHandle?: string }) {
  const navigate = useNavigate();
  const { agent, loading: authLoading } = useAuth();
  const { forumHandle: routeHandle } = useLoaderData({ from: "/f/$forumHandle/" });
  const forumHandle = propHandle ?? routeHandle;

  const { get, set } = usePersistentStore();
  const [posts, setPosts] = useState<PostDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<ResolvedIdentity | null>(null);
  const [participantAvatars, setParticipantAvatars] = useState<Record<string, { avatarCid?: string; pdsUrl: string; handle?: string }>>({});
  const [postAuthors, setPostAuthors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState("uncategorized");
  const [sortOrder, setSortOrder] = useState("latest");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicText, setNewTopicText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    async function loadForum() {
      if (!forumHandle) return;

      setIsLoading(true);
      setPosts([]);
      setError(null);

      try {
        const normalizedHandle = decodeURIComponent(forumHandle).replace(
          /^@/,
          ""
        );
        const identity = await cachedResolveIdentity({
          didOrHandle: normalizedHandle,
          get,
          set,
        });
        setIdentity(identity);

        if (!identity) throw new Error("Could not resolve forum handle");
        const resolvedDid = identity.did;

        const postRes = await esavQuery<{
          hits: { hits: { _source: PostDoc }[] };
        }>({
          query: {
            bool: {
              must: [
                { term: { forum: resolvedDid } },
                {
                  term: { "$metadata.collection": "com.example.ft.topic.post" },
                },
                { bool: { must_not: [{ exists: { field: "root" } }] } },
              ],
            },
          },
          sort: [
            {
              "$metadata.indexedAt": {
                order: "desc",
              },
            },
          ],
          size: 100,
        });

        const initialPosts = postRes.hits.hits.map((h) => h._source);

        const postsWithReplies = await Promise.all(
          initialPosts.map(async (post) => {
            const topicUri = post["$metadata.uri"];

            const repliesRes = await esavQuery<{
              hits: { total: { value: number } };
              aggregations: {
                unique_dids: { buckets: { key: string }[] };
              };
            }>({
              size: 0,
              track_total_hits: true,
              query: {
                bool: {
                  must: [{ term: { root: topicUri } }],
                },
              },
              aggs: {
                unique_dids: {
                  terms: {
                    field: "$metadata.did",
                    size: 10000,
                  },
                },
              },
            });

            const replyCount = repliesRes.hits.total.value;
            const replyDids = repliesRes.aggregations.unique_dids.buckets.map(
              (bucket) => bucket.key
            );

            const allParticipants = Array.from(
              new Set([post["$metadata.did"], ...replyDids])
            );

            return {
              ...post,
              replyCount: replyCount,
              participants: allParticipants,
            };
          })
        );

        setPosts(postsWithReplies);

        const authorsToResolve = new Set(
          // @ts-ignore
          postsWithReplies.map((post) => post["$metadata.did"])
        );

        const participantsToResolve = new Set<string>();
        postsWithReplies.forEach((post) => {
          post.participants?.forEach((did) => {
            if (did) participantsToResolve.add(did);
          });
        });

        const peopleToResolve = new Set<string>([
          ...authorsToResolve,
          ...participantsToResolve,
        ]);

        const resolvedAuthors: Record<string, string> = {};
        await Promise.all(
          Array.from(peopleToResolve).map(async (did) => {
            try {
              const identity = await cachedResolveIdentity({
                didOrHandle: did,
                get,
                set,
              });
              if (identity?.handle) resolvedAuthors[did] = identity.handle;
            } catch {}
          })
        );

        setPostAuthors(resolvedAuthors);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setIsLoading(false);
      }
    }

    loadForum();
  }, [forumHandle, get, set]);

  useEffect(() => {
    if (!agent || authLoading || posts.length === 0) return;

    const fetchAvatars = async () => {
      const participantsToResolve = new Set<string>();
      posts.forEach((post) => {
        post.participants?.forEach((did) => {
          if (did) participantsToResolve.add(did);
        });
      });

      const avatarMap: Record<
        string,
        { avatarCid?: string; pdsUrl: string; handle?: string }
      > = {};

      await Promise.all(
        Array.from(participantsToResolve).map(async (did) => {
          try {
            const identity = await cachedResolveIdentity({
              didOrHandle: did,
              get,
              set,
            });
            if (!identity) return;

            let avatarCid: string | undefined;
            try {
              const profile = await agent.com.atproto.repo.getRecord({
                repo: did,
                collection: "app.bsky.actor.profile",
                rkey: "self",
              });
              const rejason = JSON.parse(JSON.stringify(profile, null, 2));
              avatarCid = rejason.data?.value?.avatar?.ref?.["$link"];
            } catch {}

            avatarMap[did] = {
              avatarCid,
              pdsUrl: identity.pdsUrl,
              handle: identity.handle,
            };
          } catch {}
        })
      );

      setParticipantAvatars(avatarMap);
    };

    fetchAvatars();
  }, [agent, authLoading, posts, get, set]);

  const handleCreateTopic = async () => {
    if (!agent || !agent.did || !identity) {
      setFormError("You must be logged in to create a topic.");
      return;
    }
    if (!newTopicTitle.trim() || !newTopicText.trim()) {
      setFormError("Title and text cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const topicRecord = {
        $type: "com.example.ft.topic.post",
        title: newTopicTitle,
        text: newTopicText,
        createdAt: new Date().toISOString(),
        forum: identity.did,
      };

      const response = await agent.com.atproto.repo.createRecord({
        repo: agent?.did,
        collection: "com.example.ft.topic.post",
        record: topicRecord,
      });

      const postUri = new AtUri(response.data.uri);

      setIsModalOpen(false);
      setNewTopicTitle("");
      setNewTopicText("");
      navigate({
        to: `/f/${forumHandle}/t/${agent?.did}/${postUri.rkey}`,
      });
    } catch (e) {
      console.error("Failed to create topic:", e);
      setFormError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error) return <div className="text-red-500 p-8">Error: {error}</div>;

  return (
    <div className="w-full flex flex-col items-center pt-6 px-4">
      <div className="w-full max-w-5xl">
        {isLoading ? (
          <ForumHeaderSkeleton />
        ) : (
          <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-gray-100 text-sm">Category:</span>
              <Select.Root
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <Select.Trigger
                  className="inline-flex items-center justify-between rounded-md bg-gray-900 px-3 py-2 text-sm text-gray-100 border border-gray-700 w-[150px] focus:outline-none"
                  aria-label="Category"
                >
                  <Select.Value placeholder="Select category" />
                  <Select.Icon className="text-gray-400">
                    <ChevronDownIcon />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="z-50 overflow-hidden rounded-md bg-gray-800 text-gray-100 shadow-lg">
                    <Select.Viewport className="p-1">
                      {["uncategorized", "general", "meta", "support"].map(
                        (category) => (
                          <Select.Item
                            key={category}
                            value={category}
                            className="flex items-center px-3 py-2 text-sm hover:bg-gray-700 rounded-md cursor-pointer select-none"
                          >
                            <Select.ItemIndicator className="mr-2">
                              <CheckIcon className="h-3 w-3 text-gray-100" />
                            </Select.ItemIndicator>
                            <Select.ItemText>{category}</Select.ItemText>
                          </Select.Item>
                        )
                      )}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-100 text-sm">Sort by:</span>
              <Select.Root value={sortOrder} onValueChange={setSortOrder}>
                <Select.Trigger
                  className="inline-flex items-center justify-between rounded-md bg-gray-900 px-3 py-2 text-sm text-gray-100 border border-gray-700 w-[150px] focus:outline-none"
                  aria-label="Sort"
                >
                  <Select.Value placeholder="Sort by" />
                  <Select.Icon className="text-gray-400">
                    <ChevronDownIcon />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="z-50 overflow-hidden rounded-md bg-gray-800 text-gray-100 shadow-lg">
                    <Select.Viewport className="p-1">
                      {["latest", "top", "active", "views"].map((sort) => (
                        <Select.Item
                          key={sort}
                          value={sort}
                          className="flex items-center px-3 py-2 text-sm hover:bg-gray-700 rounded-md cursor-pointer select-none"
                        >
                          <Select.ItemIndicator className="mr-2">
                            <CheckIcon className="h-3 w-3 text-gray-100" />
                          </Select.ItemIndicator>
                          <Select.ItemText>{sort}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
              <Dialog.Trigger asChild>
                <button
                  className="ml-auto bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-semibold transition disabled:bg-gray-500"
                  disabled={!identity}
                  title={
                    !identity ? "Loading forum..." : "Create a new topic"
                  }
                >
                  + New Topic
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="bg-black/60 data-[state=open]:animate-overlayShow fixed inset-0 z-50" />
                <Dialog.Content className="data-[state=open]:animate-contentShow fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-lg p-6 bg-gray-800 text-gray-100 rounded-lg shadow-xl focus:outline-none">
                  <Dialog.Title className="text-xl font-bold mb-4">
                    Create New Topic in @{forumHandle}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      className="absolute top-4 right-4 text-gray-400 hover:text-white"
                      aria-label="Close"
                    >
                      <Cross2Icon />
                    </button>
                  </Dialog.Close>

                  {!agent || !agent.did ? (
                    <div className="text-center py-4">
                      <p className="text-gray-300">
                        You must be logged in to create a new topic.
                      </p>
                      <span className="inline-block mt-4 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-semibold">
                        Log In
                      </span>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleCreateTopic();
                      }}
                    >
                      <fieldset disabled={isSubmitting} className="space-y-4">
                        <div>
                          <label
                            htmlFor="topic-title"
                            className="text-sm font-medium text-gray-300 block mb-1"
                          >
                            Topic Title
                          </label>
                          <input
                            id="topic-title"
                            value={newTopicTitle}
                            onChange={(e) => setNewTopicTitle(e.target.value)}
                            className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="A short, descriptive title"
                            required
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="topic-text"
                            className="text-sm font-medium text-gray-300 block mb-1"
                          >
                            Topic Content
                          </label>
                          <textarea
                            id="topic-text"
                            value={newTopicText}
                            onChange={(e) => setNewTopicText(e.target.value)}
                            className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            rows={8}
                            placeholder="Write the main content of your topic here..."
                            required
                          />
                        </div>
                      </fieldset>
                      {formError && (
                        <p className="text-red-400 text-sm mt-2">
                          {formError}
                        </p>
                      )}
                      <div className="flex justify-end gap-4 mt-6">
                        <Dialog.Close asChild>
                          <button
                            type="button"
                            className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 font-semibold"
                            disabled={isSubmitting}
                          >
                            Cancel
                          </button>
                        </Dialog.Close>
                        <button
                          type="submit"
                          className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed"
                          disabled={
                            isSubmitting ||
                            !newTopicTitle.trim() ||
                            !newTopicText.trim()
                          }
                        >
                          {isSubmitting ? "Creating..." : "Create Topic"}
                        </button>
                      </div>
                    </form>
                  )}
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        )}

        <table className="w-full table-auto border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-sm text-gray-400">
              <th className="px-4 py-2">Topic</th>
              <th className="px-4 py-2 text-center">Participants</th>
              <th className="px-4 py-2 text-center">Replies</th>
              <th className="px-4 py-2 text-center">Views</th>
              <th className="px-4 py-2 text-right">Last Post</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => <TopicRowSkeleton key={i} />)
            ) : posts.length > 0 ? (
              posts.map((post) => (
                <tr
                  onClick={() =>
                    navigate({
                      to: `/f/${forumHandle}/t/${post?.["$metadata.did"]}/${post?.["$metadata.rkey"]}`,
                    })
                  }
                  key={post?.["$metadata.uri"]}
                  className="bg-gray-800 hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors duration-150 group relative"
                >
                  <td className="px-4 py-3 text-white rounded-l-lg">
                    <Link
                    // @ts-ignore
                      to={`/f/${forumHandle}/t/${post?.["$metadata.did"]}/${post?.["$metadata.rkey"]}`}
                      className="stretched-link"
                    >
                      <span className="sr-only">View topic:</span>
                    </Link>
                    <div className="font-semibold text-gray-50 line-clamp-1">{post.title}</div>
                    <div className="text-sm text-gray-400">#general • #meta</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex -space-x-2 justify-center">
                      {post.participants?.slice(0, 5).map((did) => {
                        const participant = participantAvatars[did];
                        const avatarUrl =
                          participant?.avatarCid && participant?.pdsUrl
                            ? `${participant.pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${participant.avatarCid}`
                            : undefined;
                        return (
                           avatarUrl ?
                            <img
                              key={did}
                              src={avatarUrl}
                              alt={`@${participant?.handle || did.slice(0, 8)}`}
                              className="w-6 h-6 rounded-full border-2 border-gray-800 object-cover bg-gray-700"
                              title={`@${participant?.handle || did.slice(0, 8)}`}
                            /> : <div className="w-6 h-6 rounded-full border-2 border-gray-800 bg-gray-700" />
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-100 font-medium">
                    {post.replyCount ?? 0}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300 font-medium">
                    idk
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-right rounded-r-lg">
                    <div className="text-sm">
                      by{" "}
                      <span className="text-blue-400 hover:underline">
                        {postAuthors[post?.["$metadata.did"]]
                          ? `@${postAuthors[post?.["$metadata.did"]]}`
                          : post?.["$metadata.did"].slice(4,12)}
                      </span>
                    </div>
                    <div className="text-xs">
                      {getRelativeTimeString(post?.["$metadata.indexedAt"])}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center text-gray-500 py-10">
                  No topics have been posted yet. Be the first!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}