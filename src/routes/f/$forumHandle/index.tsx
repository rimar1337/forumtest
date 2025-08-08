import {
  createFileRoute,
  useNavigate,
  Link,
  useParams,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  resolveIdentity,
  type ResolvedIdentity,
} from "@/helpers/cachedidentityresolver";
import { esavQuery } from "@/helpers/esquery";
import * as Select from "@radix-ui/react-select";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDownIcon, CheckIcon, Cross2Icon } from "@radix-ui/react-icons";
import { useAuth } from "@/providers/PassAuthProvider";
import { AtUri, BskyAgent } from "@atproto/api";
import { useQuery, useQueryClient, QueryClient } from "@tanstack/react-query";
import {
  useCachedProfileJotai,
  useEsavQuery,
  useEsavDocument,
  parseAtUri,
  type Profile,
  useResolvedDocuments,
} from "@/esav/hooks";

type PostDoc = {
  "$metadata.uri": string;
  "$metadata.cid": string;
  "$metadata.did": string;
  "$metadata.collection": string;
  "$metadata.rkey": string;
  "$metadata.indexedAt": string;
  forum: string;
  text: string;
  title: string;
  reply?: any;
};

type LatestReply = {
  "$metadata.uri": string;
  "$metadata.cid": string;
  "$metadata.did": string;
  "$metadata.collection": string;
  "$metadata.rkey": string;
  "$metadata.indexedAt": string;
};

type TopReaction = {
  emoji: string;
  count: number;
};

type EnrichedPostDoc = PostDoc & {
  participants?: string[];
  replyCount?: number;
  latestReply: LatestReply | null;
  topReaction: TopReaction | null;
};

type ProfileData = {
  did: string;
  handle: string | null;
  pdsUrl: string | null;
  profile: {
    displayName?: string;
    avatar?: { ref: { $link: string } };
  } | null;
};

type TopicListData = {
  posts: EnrichedPostDoc[];
  identity: ResolvedIdentity;
  profilesMap: Record<string, ProfileData>;
};

function getRelativeTimeString(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const now = new Date();
  if (isNaN(date.getTime())) return "invalid date";
  const diff = (date.getTime() - now.getTime()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, secondsInUnit] of units) {
    const value = Math.round(diff / secondsInUnit);
    if (Math.abs(value) >= 1) return formatter.format(value, unit);
  }
  return "just now";
}

export const Route = createFileRoute("/f/$forumHandle/")({
  component: Forum,
});

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
        <div className="flex items-center justify-end gap-2">
          <div className="flex flex-col items-end space-y-1.5">
            <div className="h-4 w-24 bg-gray-700 rounded-md" />
            <div className="h-3 w-20 bg-gray-600 rounded-md" />
          </div>
          <div className="w-8 h-8 rounded-full bg-gray-700" />
        </div>
      </td>
    </tr>
  );
}
function TopicListSkeleton() {
  return (
    <div className="w-full flex flex-col items-center pt-6 px-4">
      <div className="w-full max-w-5xl">
        <ForumHeaderSkeleton />
        <table className="w-full table-auto border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-sm text-gray-400">
              <th className="px-4 py-2">Topic</th>
              <th className="px-4 py-2 text-center">Participants</th>
              <th className="px-4 py-2 text-center">Replies</th>
              <th className="px-4 py-2 text-center">Reactions</th>
              <th className="px-4 py-2 text-right">Last Post</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TopicRowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Forum() {
  const { forumHandle } = Route.useParams();
  const [profile, isLoading] = useCachedProfileJotai(forumHandle);

  const postsQuery = useMemo(() => {
    if (!profile?.did) {
      return null;
    }

    const query = {
      query: {
        bool: {
          must: [
            { term: { forum: profile.did } },
            { term: { "$metadata.collection": "party.whey.ft.topic.post" } },
            { bool: { must_not: [{ exists: { field: "root" } }] } },
          ],
        },
      },
      sort: [{ "$metadata.indexedAt": { order: "desc" } }]
    };
    return query;
  }, [profile?.did]);

  const { uris = [], isLoading: isQueryLoading } = useEsavQuery(
    `forumtest/${profile?.did}/topics`,
    postsQuery!,
    {
      enabled: !!profile?.did && !!postsQuery,
    }
  );

  const navigate = useNavigate();
  const { agent, loading: authLoading } = useAuth();

  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState("uncategorized");
  const [sortOrder, setSortOrder] = useState("latest");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicText, setNewTopicText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreateTopic = async () => {
    if (!agent || !agent.did) {
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
      const response = await agent.com.atproto.repo.createRecord({
        repo: agent.did,
        collection: "party.whey.ft.topic.post",
        record: {
          $type: "party.whey.ft.topic.post",
          title: newTopicTitle,
          text: newTopicText,
          createdAt: new Date().toISOString(),
          forum: profile?.did,
        },
      });

      const postUri = new AtUri(response.data.uri);

      setIsModalOpen(false);
      setNewTopicTitle("");
      setNewTopicText("");

      queryClient.invalidateQueries({ queryKey: ["topics", forumHandle] });

      navigate({
        to: `/f/${forumHandle}/t/${agent.did}/${postUri.rkey}`,
      });
    } catch (e) {
      console.error("Failed to create topic:", e);
      setFormError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!profile || isLoading || isQueryLoading) {
    return <TopicListSkeleton />;
  }

  return (
    <div className="w-full flex flex-col items-center pt-6 px-4">
      <div className="w-full max-w-5xl">
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
                disabled={!profile}
                title={!profile ? "Loading forum..." : "Create a new topic"}
              >
                + New Topic
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="bg-black/60 data-[state=open]:animate-overlayShow fixed inset-0 z-50" />
              <Dialog.Content className="data-[state=open]:animate-contentShow fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-lg p-6 bg-gray-800 text-gray-100 rounded-lg shadow-xl focus:outline-none">
                <Dialog.Title className="text-xl font-bold mb-4">
                  Create New Topic in {forumHandle}
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
                      <p className="text-red-400 text-sm mt-2">{formError}</p>
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

        <table className="w-full table-auto border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-sm text-gray-400">
              <th className="px-4 py-2">Topic</th>
              <th className="px-4 py-2 text-center">Participants</th>
              <th className="px-4 py-2 text-center">Replies</th>
              <th className="px-4 py-2 text-center">Reactions</th>
              <th className="px-4 py-2 text-right">Last Post</th>
            </tr>
          </thead>
          <tbody>
            {uris.length > 0 ? (
              uris.map((uri) => (
                <TopicRow
                  forumHandle={forumHandle}
                  key={uri}
                  profile={profile}
                  uri={uri}
                />
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

function TopicRow({
  forumHandle,
  profile,
  uri,
}: {
  forumHandle: string;
  profile: Profile;
  uri: string;
}) {
  const navigate = useNavigate();
  const topic = useEsavDocument(uri);
  const parsed = parseAtUri(uri);

  const fullRepliesQuery = {
    query: {
      bool: { must: [{ term: { root: uri } }] },
    },
    sort: [{ "$metadata.indexedAt": { order: "asc" } }],
  };

  const { uris: repliesUris = [], isLoading: isQueryLoading } = useEsavQuery(
    `forumtest/${profile.did}/${uri}/replies`,
    fullRepliesQuery!,
    {
      enabled: !!fullRepliesQuery,
    }
  );

  const topReactions = {
    query: {
      bool: {
        must: [
          {
            term: {
              "$metadata.collection": "party.whey.ft.topic.reaction",
            },
          },
          { 
            terms: { 
              reactionSubject: [uri]
            } 
          },
        ],
      },
    },
    sort: [{ "$metadata.indexedAt": { order: "asc" } }],
  };

  const { uris: reactionUris = [], isLoading: isReactionsLoading } =
    useEsavQuery(`forumtest/${profile.did}/${uri}/OPreply/reactions`, topReactions!, {
      enabled: !!topReactions,
    });

  const lastReplyUri =
    repliesUris.length > 0 ? repliesUris[repliesUris.length - 1] : uri;

  const [op, isOpLoading] = useCachedProfileJotai(parsed?.did);
  const [lastReplyAuthor, isLastReplyAuthorLoading] = useCachedProfileJotai(
    lastReplyUri && parseAtUri(lastReplyUri)?.did
  );

  const lastReply = useEsavDocument(lastReplyUri);

  const participants = Array.from(
    new Set(
      [
        parsed?.did,
        ...repliesUris.map((i) => parseAtUri(i)?.did),
      ].filter((did): did is string => typeof did === "string")
    )
  );


  if (
    !topic ||
    isQueryLoading ||
    isOpLoading ||
    isLastReplyAuthorLoading ||
    !op ||
    isReactionsLoading 
  ) {
    return <TopicRowSkeleton />;
  }

  const rootAuthorProfile = op.profile;

  const lastPostAuthorDid = lastReply?.doc["$metadata.did"];
  const lastPostTimestamp = lastReply?.doc["$metadata.indexedAt"];
  const lastPostAuthorProfile = lastReplyAuthor;

  const lastPostAuthorAvatar =
    lastPostAuthorProfile?.profile?.avatar?.ref?.$link &&
    lastPostAuthorProfile.pdsUrl
      ? `${lastPostAuthorProfile.pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${lastPostAuthorDid}&cid=${lastPostAuthorProfile.profile.avatar.ref.$link}`
      : undefined;

  const post = topic.doc as PostDoc;

  return (
    <tr
      onClick={() =>
        navigate({
          to: `/f/${forumHandle}/t/${post["$metadata.did"]}/${post["$metadata.rkey"]}`,
        })
      }
      key={post["$metadata.uri"]}
      className="bg-gray-800 hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors duration-150 group relative"
    >
      <td className="px-4 py-3 text-white rounded-l-lg min-w-52">
        <Link
          // @ts-ignore
          to={`/f/${forumHandle}/t/${post["$metadata.did"]}/${post["$metadata.rkey"]}`}
          className="stretched-link"
        >
          <span className="sr-only">View topic:</span>
        </Link>
        <div className="font-semibold text-gray-50 line-clamp-1">
          {post.title}
        </div>
        <div className="text-sm text-gray-400">
          by{" "}
          <span className="font-medium text-gray-300">
            {op.handle ? `@${op.handle}` : op?.did.slice(4, 12)}
          </span>
          , {getRelativeTimeString(post["$metadata.indexedAt"])}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex -space-x-2 justify-center">
          {participants
            .filter(Boolean)
            .slice(0, 5)
            .map((did) => (
              <Participant key={did} did={did} />
            ))}
        </div>
      </td>
      <td className="px-4 py-3 text-center text-gray-100 font-medium">
        {(repliesUris.length ?? 0) < 1 ? "-" : repliesUris.length}
      </td>
      <td className="px-4 py-3 text-center text-gray-300 font-medium">
        {reactionUris ? <TopReactionc uris={reactionUris} /> : "-"}
      </td>
      <td className="px-4 py-3 text-gray-400 text-right rounded-r-lg">
        <div className="flex items-center justify-end gap-2">
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-100 line-clamp-1">
              {lastPostAuthorProfile?.profile?.displayName ||
                (lastPostAuthorProfile?.handle
                  ? `@${lastPostAuthorProfile.handle}`
                  : "...")}
            </div>
            <div className="text-xs">
              {lastPostTimestamp && getRelativeTimeString(lastPostTimestamp)}
            </div>
          </div>
          {lastPostAuthorAvatar ? (
            <img
              src={lastPostAuthorAvatar}
              alt={lastPostAuthorProfile?.profile?.displayName}
              className="w-8 h-8 rounded-full object-cover bg-gray-700 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-700 shrink-0" />
          )}
        </div>
      </td>
    </tr>
  );
}

function TopReactionc({ uris }: { uris: string[] }) {
  const resolvedReactions = useResolvedDocuments(uris);

  const didEmojiSet = new Map<string, Set<string>>();
  const emojiCounts = new Map<string, number>();

  Object.values(resolvedReactions).forEach((doc) => {
    if (!doc) return;

    const did = doc["$metadata.did"];
    const emoji = doc.$raw?.reactionEmoji as string;
    if (!emoji) return;

    if (!didEmojiSet.has(did)) {
      didEmojiSet.set(did, new Set());
    }

    const emojiSet = didEmojiSet.get(did)!;
    if (!emojiSet.has(emoji)) {
      emojiSet.add(emoji);
      emojiCounts.set(emoji, (emojiCounts.get(emoji) || 0) + 1);
    }
  });

  // Step 2: Find top emoji
  let topEmoji: string | null = null;
  let topCount = 0;
  for (const [emoji, count] of emojiCounts) {
    if (count > topCount) {
      topEmoji = emoji;
      topCount = count;
    }
  }

  if (!topEmoji) return null; // No valid reactions

  return (
    <div
      className="flex items-center justify-center gap-1.5"
      title={`${topCount} reactions`}
    >
      <span>{topEmoji}</span>
      <span className="text-sm font-normal">{topCount}</span>
    </div>
  );
}

function Participant({ did }: { did: string }) {
  const [user, isloading] = useCachedProfileJotai(did);
  if (isloading || !user) {
    return (
      <div
        key={did}
        className="w-6 h-6 rounded-full border-2 border-gray-800 bg-gray-700"
      />
    );
  }
  const avatarUrl =
    user.profile?.avatar?.ref?.$link && user.pdsUrl
      ? `${user.pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${user.profile.avatar.ref.$link}`
      : undefined;
  return (
    <img
      key={did}
      src={avatarUrl}
      alt={`@${user?.handle || did.slice(0, 8)}`}
      className="w-6 h-6 rounded-full border-2 border-gray-800 object-cover bg-gray-700"
      title={`@${user?.handle || did.slice(0, 8)}`}
    />
  );
}
