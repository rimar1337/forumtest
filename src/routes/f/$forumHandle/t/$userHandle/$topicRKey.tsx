import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/providers/OAuthProvider";
import { esavQuery } from "@/helpers/esquery";
import {
  resolveIdentity,
  type ResolvedIdentity,
} from "@/helpers/cachedidentityresolver";
import AtpAgent, { Agent } from "@atproto/api";
import {
  ArrowLeftIcon,
  ChatBubbleIcon,
  FaceIcon,
  PlusIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import * as Popover from "@radix-ui/react-popover";
import { useQuery, useQueryClient, QueryClient } from "@tanstack/react-query";
import {
  parseAtUri,
  useCachedProfileJotai,
  useEsavDocument,
  useEsavQuery,
  type Profile,
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
  title?: string;
  reply?: {
    root: { uri: string; cid: string };
    parent: { uri: string; cid: string };
  };
  [key: string]: any;
};

type ReactionDoc = {
  "$metadata.uri": string;
  "$metadata.cid": string;
  "$metadata.did": string;
  "$metadata.rkey": string;
  "$metadata.indexedAt": string;
  reactionEmoji: string;
  reactionSubject: string;
};

type AuthorInfo = ResolvedIdentity & {
  avatarCid?: string;
  displayName?: string;
  footer?: string;
};

type TopicData = {
  posts: PostDoc[];
  authors: Record<string, AuthorInfo>;
  reactions: Record<string, ReactionDoc[]>;
};

const EMOJI_SELECTION = ["👍", "❤️", "😂", "🔥", "🤔", "🎉", "🙏", "🤯"];

// const topicQueryOptions = (
//   queryClient: QueryClient,
//   userHandle: string,
//   topicRKey: string
// ) => ({
//   queryKey: ["topic", userHandle, topicRKey],
//   queryFn: async (): Promise<TopicData> => {
//     const authorIdentity = await queryClient.fetchQuery({
//       queryKey: ["identity", userHandle],
//       queryFn: () => resolveIdentity({ didOrHandle: userHandle }),
//       staleTime: 1000 * 60 * 60 * 24,
//     });
//     if (!authorIdentity) throw new Error("Could not find topic author.");

//     const topicUri = `at://${authorIdentity.did}/party.whey.ft.topic.post/${topicRKey}`;

//     const [postRes, repliesRes] = await Promise.all([
//       esavQuery<{ hits: { hits: { _source: PostDoc }[] } }>({
//         query: { term: { "$metadata.uri": topicUri } },
//         size: 1,
//       }),
//       esavQuery<{ hits: { hits: { _source: PostDoc }[] } }>({
//         query: { term: { root: topicUri } },
//         sort: [{ "$metadata.indexedAt": "asc" }],
//         size: 100,
//       }),
//     ]);

//     if (postRes.hits.hits.length === 0) throw new Error("Topic not found.");
//     const mainPost = postRes.hits.hits[0]._source;
//     const fetchedReplies = repliesRes.hits.hits.map((h) => h._source);
//     const allPosts = [mainPost, ...fetchedReplies];

//     const postUris = allPosts.map((p) => p["$metadata.uri"]);
//     const authorDids = [...new Set(allPosts.map((p) => p["$metadata.did"]))];

//     const [reactionsRes, footersRes, pdsProfiles] = await Promise.all([
//       esavQuery<{ hits: { hits: { _source: ReactionDoc }[] } }>({
//         query: {
//           bool: {
//             must: [
//               {
//                 term: {
//                   "$metadata.collection": "party.whey.ft.topic.reaction",
//                 },
//               },
//               { terms: { reactionSubject: postUris } },
//             ],
//           },
//         },
//         _source: ["reactionSubject", "reactionEmoji"],
//         size: 1000,
//       }),
//       esavQuery<{
//         hits: {
//           hits: { _source: { "$metadata.did": string; footer: string } }[];
//         };
//       }>({
//         query: {
//           bool: {
//             must: [
//               { term: { $type: "party.whey.ft.user.profile" } },
//               { terms: { "$metadata.did": authorDids } },
//             ],
//           },
//         },
//         _source: ["$metadata.did", "footer"],
//         size: authorDids.length,
//       }),
//       Promise.all(
//         authorDids.map(async (did) => {
//           try {
//             const identity = await queryClient.fetchQuery({
//               queryKey: ["identity", did],
//               queryFn: () => resolveIdentity({ didOrHandle: did }),
//               staleTime: 1000 * 60 * 60 * 24,
//             });

//             if (!identity?.pdsUrl) {
//               console.warn(
//                 `Could not resolve PDS for ${did}, cannot fetch profile.`
//               );
//               return { did, profile: null };
//             }

//             const profileUrl = `${identity.pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${did}&collection=app.bsky.actor.profile&rkey=self`;
//             const profileRes = await fetch(profileUrl);

//             if (!profileRes.ok) {
//               console.warn(
//                 `Failed to fetch profile for ${did} from ${identity.pdsUrl}. Status: ${profileRes.status}`
//               );
//               return { did, profile: null };
//             }

//             const profileData = await profileRes.json();
//             return { did, profile: profileData.value };
//           } catch (e) {
//             console.error(
//               `Error during decentralized profile fetch for ${did}:`,
//               e
//             );
//             return { did, profile: null };
//           }
//         })
//       ),
//     ]);

//     const reactionsByPostUri = reactionsRes.hits.hits.reduce(
//       (acc, hit) => {
//         const reaction = hit._source;
//         (acc[reaction.reactionSubject] =
//           acc[reaction.reactionSubject] || []).push(reaction);
//         return acc;
//       },
//       {} as Record<string, ReactionDoc[]>
//     );

//     const footersByDid = footersRes.hits.hits.reduce(
//       (acc, hit) => {
//         acc[hit._source["$metadata.did"]] = hit._source.footer;
//         return acc;
//       },
//       {} as Record<string, string>
//     );

//     const authors: Record<string, AuthorInfo> = {};
//     await Promise.all(
//       authorDids.map(async (did) => {
//         const identity = await queryClient.fetchQuery({
//           queryKey: ["identity", did],
//           queryFn: () => resolveIdentity({ didOrHandle: did }),
//           staleTime: 1000 * 60 * 60 * 24,
//         });
//         if (!identity) return;
//         const pdsProfile = pdsProfiles.find((p) => p.did === did)?.profile;
//         authors[did] = {
//           ...identity,
//           displayName: pdsProfile?.displayName,
//           avatarCid: pdsProfile?.avatar?.ref?.["$link"],
//           footer: footersByDid[did],
//         };
//       })
//     );

//     return { posts: allPosts, authors, reactions: reactionsByPostUri };
//   },
// });

export const Route = createFileRoute(
  "/f/$forumHandle/t/$userHandle/$topicRKey"
)({
  component: ForumTopic,
});

export function PostCardSkeleton() {
  return (
    <div className="flex w-full gap-4 bg-gray-800 border border-gray-700/50 rounded-xl p-4 animate-pulse">
      <div className="w-32 flex-shrink-0 space-y-3">
        <div className="w-12 h-12 rounded-full bg-gray-700 mx-auto" />
        <div className="h-4 w-3/4 bg-gray-700 rounded-md mx-auto" />
        <div className="h-3 w-1/2 bg-gray-700 rounded-md mx-auto" />
        <div className="border-t border-gray-700 pt-3 mt-3 space-y-2">
          <div className="h-3 w-full bg-gray-600 rounded" />
          <div className="h-3 w-10/12 bg-gray-600 rounded" />
        </div>
      </div>
      <div className="flex-grow space-y-4">
        <div className="h-4 w-28 bg-gray-700 rounded-md" />
        <div className="space-y-2.5">
          <div className="h-4 w-full bg-gray-600 rounded" />
          <div className="h-4 w-11/12 bg-gray-600 rounded" />
          <div className="h-4 w-4/5 bg-gray-600 rounded" />
        </div>
        <div className="flex justify-between items-center pt-2">
          <div className="h-6 w-16 bg-gray-700 rounded-md" />
          <div className="h-8 w-20 bg-gray-700 rounded-md" />{" "}
        </div>
      </div>
    </div>
  );
}

function TopicPageSkeleton() {
  return (
    <div className="w-full flex flex-col items-center pt-6 px-4">
      <div className="w-full max-w-5xl space-y-4">
        <div className="animate-pulse">
          <div className="h-5 w-48 bg-gray-700 rounded-md" />
          <div className="h-8 w-3/4 bg-gray-700 rounded-md mt-4" />
        </div>
        <PostCardSkeleton />
        <PostCardSkeleton />
        <div className="p-4 bg-gray-800 rounded-xl border border-gray-700/50 animate-pulse">
          <div className="h-6 w-32 bg-gray-700 rounded-md mb-3" />
          <div className="h-28 w-full bg-gray-900 border border-gray-700 rounded-md" />
          <div className="flex justify-end mt-3">
            <div className="h-10 w-32 bg-gray-700 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

function UserInfoColumn({ author }: { author: Profile | null }) {
  const avatarUrl =
    author?.profile.avatar?.ref.$link && author?.pdsUrl
      ? `${author.pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${author.did}&cid=${author?.profile.avatar?.ref.$link}`
      : undefined;

  const authorDisplayName = author?.profile.displayName || author?.handle || "Unknown";
  const authorHandle = author?.handle ? `@${author.handle}` : "did:...";

  return (
    <div className="w-32 flex-shrink-0 text-center text-sm text-gray-400">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={authorDisplayName}
          className="w-12 h-12 rounded-full object-cover bg-gray-700 mx-auto"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 font-bold text-2xl mx-auto">
          {authorDisplayName.charAt(0)}
        </div>
      )}
      <div className="font-bold text-[15px] text-white mt-1 break-words whitespace-normal">
        {authorDisplayName}
      </div>
      <div className="break-words whitespace-normal">{authorHandle}</div>
      {/* {author?.footer && (
        <div className="border-t border-gray-700/80 mt-4 pt-3 text-xs text-gray-500 text-left whitespace-pre-wrap break-words">
          {author.footer}
        </div>
      )} */}
    </div>
  );
}

function Reactions({ reactions }: { reactions: ReactionDoc[] }) {
  const groupedReactions = useMemo(() => {
    return reactions.reduce(
      (acc, reaction) => {
        acc[reaction.reactionEmoji] = (acc[reaction.reactionEmoji] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [reactions]);

  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {Object.entries(groupedReactions).map(([emoji, count]) => (
        <button
          key={emoji}
          className="flex items-center gap-1.5 bg-gray-700/50 hover:bg-gray-700/80 px-2 py-1 rounded-full text-sm text-gray-300 transition-colors"
        >
          <span>{emoji}</span>
          <span className="font-semibold">{count}</span>
        </button>
      ))}
    </div>
  );
}

export function PostCard({
  forumdid,
  agent,
  post,
  //author,
  //reactions,
  index,
  onSetReplyParent,
  onNewReaction,
  isCreatingReaction,
}: {
  forumdid: string;
  agent: Agent | null;
  post: PostDoc;
  //author: AuthorInfo | null;
  //reactions: ReactionDoc[];
  index: number;
  onSetReplyParent: (post: PostDoc) => void;
  onNewReaction: (post: PostDoc, emoji: string) => Promise<void>;
  isCreatingReaction: boolean;
}) {
  const postUri = post["$metadata.uri"];
  const postDate = new Date(post["$metadata.indexedAt"]);
  const [author, authorloading] = useCachedProfileJotai(post["$metadata.did"]);

  const reactionsquery = {
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
              reactionSubject: [post["$metadata.uri"]]
            } 
          },
        ],
      },
    },
    sort: [{ "$metadata.indexedAt": { order: "asc" } }],
  };

  const { uris: reactionUris = [], isLoading: isReactionsLoading } =
    useEsavQuery(`forumtest/${forumdid}/${post["$metadata.uri"]}/reactions`, reactionsquery!, {
      enabled: !!reactionsquery,
    });
  
  function isReactionDoc(doc: unknown): doc is ReactionDoc {
    return (
      typeof doc === 'object' &&
      doc !== null &&
      'reactionEmoji' in doc &&
      'reactionSubject' in doc
    );
  }

  const docsMap = useEsavDocument(reactionUris);
  const reactions = reactionUris
  .map((uri) => docsMap?.[uri]?.doc as unknown)
  .filter(isReactionDoc);

  if (!author || authorloading) {
    return (
      <span>
        loading
      </span>
    )
  }

  return (
    <div
      id={postUri}
      className="w-full bg-gray-800 border border-gray-700/50 rounded-xl flex gap-x-4 p-1"
    >
      <div className="bg-gray-800/50 p-3 rounded-l-lg">
        <UserInfoColumn author={author} />
      </div>

      <div className="flex-grow flex flex-col py-3 pr-4">
        <div className="flex justify-between items-center text-xs text-gray-500 mb-4 border-b border-gray-700/50 pb-2">
          <span>{postDate.toLocaleString()}</span>
          <a
            href={`#${postUri}`}
            className="font-mono hover:underline hover:text-gray-300"
          >
            #{index + 1}
          </a>
        </div>

        <div className="flex-grow">
          <p className="whitespace-pre-wrap text-gray-200 text-[15px] leading-relaxed">
            {post.text}
          </p>
        </div>

        <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-700/50">
          <div className="flex items-center gap-1">
            <Reactions reactions={reactions} />
            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  disabled={isCreatingReaction || !agent || !agent.did}
                  className="flex items-center justify-center w-8 h-8 bg-gray-700/50 hover:bg-gray-700/80 rounded-full text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  aria-label="Add reaction"
                >
                  <FaceIcon className="w-4 h-4" />
                  <PlusIcon className="w-3 h-3 -ml-1.5 mt-2" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  sideOffset={5}
                  className="bg-gray-900 border border-gray-700 rounded-lg p-2 z-10 shadow-lg"
                >
                  <div className="grid grid-cols-4 gap-1">
                    {EMOJI_SELECTION.map((emoji) => (
                      <Popover.Close key={emoji} asChild>
                        <button
                          onClick={() => onNewReaction(post, emoji)}
                          className="text-2xl p-1.5 rounded-md hover:bg-gray-700/80 transition-colors"
                          aria-label={`React with ${emoji}`}
                        >
                          {emoji}
                        </button>
                      </Popover.Close>
                    ))}
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
          <div className="spacer flex-1" />
          <button
            onClick={() => onSetReplyParent(post)}
            className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-3 py-1.5 rounded-md font-semibold text-sm transition"
          >
            <ChatBubbleIcon />
            <span>Reply</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function ForumTopic() {
  const { forumHandle, userHandle, topicRKey } = useParams({
    from: "/f/$forumHandle/t/$userHandle/$topicRKey",
  });
  const [forum, isforumdidLoading] = useCachedProfileJotai(forumHandle);
  const [op, isOpdidLoading] = useCachedProfileJotai(userHandle);

  const uri = useMemo(() => {
    return `at://${op?.did}/party.whey.ft.topic.post/${topicRKey}`;
  }, [op?.did]);
  const { agent, status } = useAuth();
  const authLoading = status === 'loading'

  //const topic = useEsavDocument(uri);
  //const parsed = parseAtUri(uri);

  const opQuery = {
    query: {
      term: {
        "$metadata.uri": uri,
      },
    },
    size: 1,
    sort: [{ "$metadata.indexedAt": { order: "asc" } }],
  };

  const fullRepliesQuery = {
    query: {
      bool: { must: [{ term: { root: uri } }] },
    },
    sort: [{ "$metadata.indexedAt": { order: "asc" } }],
  };

  const { uris: opUris = [], isLoading: isopQueryLoading } = useEsavQuery(
    `forumtest/${op?.did}/${uri}`,
    opQuery!,
    {
      enabled: !!opQuery && !!op,
    }
  );

  const { uris: repliesUris = [], isLoading: isQueryLoading } = useEsavQuery(
    `forumtest/${op?.did}/${uri}/replies`,
    fullRepliesQuery!,
    {
      enabled: !!fullRepliesQuery && !!op,
    }
  );

  const oppost = useEsavDocument(uri);
  const docsMap = useEsavDocument(repliesUris);
  const posts = useMemo(() => { return [
    oppost?.doc as PostDoc,
    ...repliesUris.map((uri) => docsMap?.[uri]?.doc as PostDoc),
  ].filter((doc): doc is PostDoc => !!doc);
  }, [oppost, docsMap]);

  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<PostDoc | null>(null);
  const [isCreatingReaction, setIsCreatingReaction] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const handleSetReplyParent = (post: PostDoc) => {
    setReplyingTo(post);
    document.getElementById("reply-box")?.focus();
  };

  const handleCreateReaction = async (post: PostDoc, emoji: string) => {
    if (!agent?.did || isCreatingReaction) return;
    setIsCreatingReaction(true);
    setMutationError(null);
    try {
      await agent.com.atproto.repo.createRecord({
        repo: agent.did,
        collection: "party.whey.ft.topic.reaction",
        record: {
          $type: "party.whey.ft.topic.reaction",
          reactionEmoji: emoji,
          subject: post["$metadata.uri"],
          createdAt: new Date().toISOString(),
        },
      });
      //invalidateTopicQuery();
    } catch (e) {
      console.error("Failed to create reaction", e);
      setMutationError("Failed to post reaction. Please try again.");
    } finally {
      setIsCreatingReaction(false);
    }
  };

  const handleReply = async () => {
    if (!agent?.did || isSubmitting || !replyText.trim() || posts.length === 0)
      return;
    setIsSubmitting(true);
    setMutationError(null);
    try {
      const rootPost = posts[0];
      const parentPost = replyingTo || rootPost;
      const trimmed = forumHandle.startsWith("@")
        ? forumHandle.slice(1)
        : forumHandle;
      const identity = forum;
      const forumDid = identity?.did;
      if (!forumDid) {
        throw new Error("Could not resolve forum handle to DID.");
      }
      await agent.com.atproto.repo.createRecord({
        repo: agent.did,
        collection: "party.whey.ft.topic.post",
        record: {
          $type: "party.whey.ft.topic.post",
          text: replyText,
          forum: forumDid,
          reply: {
            root: {
              uri: rootPost["$metadata.uri"],
              cid: rootPost["$metadata.cid"],
            },
            parent: {
              uri: parentPost["$metadata.uri"],
              cid: parentPost["$metadata.cid"],
            },
          },
          createdAt: new Date().toISOString(),
        },
      });
      setReplyText("");
      setReplyingTo(null);
      //invalidateTopicQuery();
    } catch (e) {
      setMutationError(`Failed to post reply: ${(e as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  if (!forum?.did || isOpdidLoading || isQueryLoading || isforumdidLoading || isopQueryLoading) {
    return (
      <TopicPageSkeleton />
    )
  }

  // if (isError)
  //   return (
  //     <div className="text-red-500 p-8 text-center">
  //       Error: {(error as Error).message}
  //     </div>
  //   );

  const topicPost = posts[0];
  const postIndexBeingRepliedTo = replyingTo
    ? posts.findIndex((p) => p["$metadata.uri"] === replyingTo["$metadata.uri"])
    : -1;

  return (
    <div className="w-full flex flex-col items-center pt-6 px-4 pb-12">
      <div className="w-full max-w-5xl space-y-4">
        <div>
          <Link
            to="/f/$forumHandle"
            params={{ forumHandle }}
            className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-white hover:underline transition-colors"
          >
            <ArrowLeftIcon />
            Back to /f/{forumHandle}
          </Link>
          {topicPost.title && (
            <h1 className="text-3xl font-bold text-gray-50 mt-4 break-words">
              {topicPost.title}
            </h1>
          )}
        </div>

        {posts.map((post, index) => (
          <PostCard
            forumdid={forum?.did}
            agent={agent}
            key={post["$metadata.uri"]}
            post={post}
            //author={authors[post["$metadata.did"]]}
            //reactions={reactions[post["$metadata.uri"]] || []}
            index={index}
            onSetReplyParent={handleSetReplyParent}
            onNewReaction={handleCreateReaction}
            isCreatingReaction={isCreatingReaction}
          />
        ))}

        {agent && !authLoading && (
          <div className="p-4 bg-gray-800 rounded-xl border border-gray-700/50">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-gray-200">
                {replyingTo ? "Write a Reply" : "Reply to Topic"}
              </h3>
              {replyingTo && postIndexBeingRepliedTo !== -1 && (
                <div className="flex items-center gap-2 text-sm bg-gray-700/60 px-3 py-1 rounded-full">
                  <span className="text-gray-400">
                    Replying to #{postIndexBeingRepliedTo + 1}
                  </span>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="text-gray-500 hover:text-white"
                    aria-label="Cancel reply"
                  >
                    <Cross2Icon />
                  </button>
                </div>
              )}
            </div>
            {mutationError && (
              <p className="text-red-400 text-sm mb-2">{mutationError}</p>
            )}
            <textarea
              id="reply-box"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full p-3 bg-gray-900 border border-gray-700 rounded-md text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
              rows={5}
              placeholder="Share your thoughts..."
              disabled={isSubmitting}
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleReply}
                disabled={isSubmitting || !replyText.trim() || !agent?.did}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-md font-semibold transition disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Posting..." : "Submit Reply"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
