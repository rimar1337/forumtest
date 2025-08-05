import {
  createFileRoute,
  useSearch,
  useNavigate,
  Link,
} from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/providers/PassAuthProvider";
import { usePersistentStore } from "@/providers/PersistentStoreProvider";
import { esavQuery } from "@/helpers/esquery";
import {
  cachedResolveIdentity,
  type ResolvedIdentity,
} from "@/helpers/cachedidentityresolver";
import AtpAgent, { AtUri } from "@atproto/api";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import {
  PostCard,
  PostCardSkeleton,
} from "@/routes/f/$forumHandle/t/$userHandle/$topicRKey";

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
  "$metadata.collection": string;
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

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: SearchPage,
});

interface SearchResultCardProps {
  agent: AtpAgent | null;
  post: PostDoc;
  author: AuthorInfo | null;
  reactions: ReactionDoc[];
  index: number;
  onNewReaction: (post: PostDoc, emoji: string) => Promise<void>;
  isCreatingReaction: boolean;
}

function SearchResultCard({ post, ...rest }: SearchResultCardProps) {
  const navigate = useNavigate();
  const [forumHandle, setForumHandle] = useState<string | undefined>(undefined);
  const { get, set } = usePersistentStore();

  const thing = post["forum"]// || new AtUripost["root"]
  const trimmed = thing.startsWith("@") ? thing.slice(1) : thing


  const rootUri = useMemo(() => post.root || post["$metadata.uri"], [post]);
  const postUri = post["$metadata.uri"];

  const [threadLink, setThreadLink] = useState<{
    to: string;
    hash: string;
  } | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const buildLink = async () => {
      try {
        //const forumAtUri = new AtUri(forumdid);
        const authorIdentity = await cachedResolveIdentity({
          didOrHandle: trimmed,
          get,
          set,
        });
        setForumHandle("@" + authorIdentity?.handle);
        if (!isCancelled && authorIdentity?.handle) {
          setThreadLink({
            to: "/f/$forumHandle/t/$userHandle/$topicRKey",
            hash: postUri,
          });
        }
      } catch (e) {
        console.error("Failed to build thread link for search result", e);
      }
    };
    buildLink();
    return () => {
      isCancelled = true;
    };
  }, [rootUri, postUri, get, set]);

  const handleNavigateToPost = () => {
    if (!threadLink) return;
    const rootAtUri = new AtUri(rootUri);
    const authorIdentity = authors[rootAtUri.hostname];
    if (!authorIdentity?.handle) return;

    navigate({
      to: threadLink.to,
      params: {
        forumHandle: post.forum,
        userHandle: authorIdentity.handle,
        topicRKey: rootAtUri.rkey,
      },
      hash: threadLink.hash,
    });
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl">
      <div className="flex justify-between items-center px-4 py-2.5 border-b border-gray-700/50">
        <span className="text-sm text-gray-400">
          From forum:{" "}
          <Link
            to="/f/$forumHandle"
            params={{ forumHandle: post.forum }}
            className="font-semibold text-blue-300 hover:underline"
          >
            /f/{forumHandle}
          </Link>
        </span>
        {threadLink ? (
          <Link
            to={threadLink.to}
            params={{
              forumHandle: post.forum,
              userHandle: authors[new AtUri(rootUri).hostname]?.handle || "",
              topicRKey: new AtUri(rootUri).rkey,
            }}
            hash={threadLink.hash}
            className="flex items-center gap-2 text-sm font-semibold text-blue-300 hover:text-white transition-colors"
          >
            View Full Thread <ArrowRightIcon />
          </Link>
        ) : (
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-500">
            View Full Thread <ArrowRightIcon />
          </span>
        )}
      </div>

      <PostCard {...rest} post={post} onSetReplyParent={handleNavigateToPost} />
    </div>
  );
}

let authors: Record<string, AuthorInfo> = {};

export function SearchPage() {
  const { q } = useSearch({ from: "/search" });

  const { agent, loading: authLoading } = useAuth();
  const { get, set } = usePersistentStore();

  const [results, setResults] = useState<PostDoc[]>([]);
  const [reactions, setReactions] = useState<Record<string, ReactionDoc[]>>({});
  const [_authors, setAuthors] = useState<Record<string, AuthorInfo>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingReaction, setIsCreatingReaction] = useState(false);

  useEffect(() => {
    authors = _authors;
  }, [_authors]);

  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      setError(null);
      setResults([]);
      setAuthors({});
      setReactions({});
      try {
        const searchRes = await esavQuery<{
          hits: { hits: { _source: PostDoc }[] };
        }>({
          query: {
            bool: {
              must: {
                multi_match: { query: query, fields: ["text", "title^2"] },
              },
              filter: [
                {
                  term: { "$metadata.collection": "com.example.ft.topic.post" },
                },
              ],
            },
          },
          sort: [{ _score: "desc" }, { "$metadata.indexedAt": "desc" }],
          size: 25,
        });
        const foundPosts = searchRes.hits.hits.map((hit) => hit._source);
        if (foundPosts.length === 0) {
          setIsLoading(false);
          return;
        }
        setResults(foundPosts);

        const allUris = foundPosts
          .flatMap((p) => [p["$metadata.uri"], p.reply?.root.uri])
          .filter(Boolean) as string[];
        const uniqueUris = [...new Set(allUris)];
        const allDids = [
          ...new Set(uniqueUris.map((uri) => new AtUri(uri).hostname)),
        ];

        const [reactionsRes, footersRes, pdsProfiles] = await Promise.all([
          esavQuery<{ hits: { hits: { _source: ReactionDoc }[] } }>({
            query: {
              bool: {
                must: [
                  {
                    term: {
                      "$metadata.collection": "com.example.ft.topic.reaction",
                    },
                  },
                ],
                filter: [
                  {
                    terms: {
                      reactionSubject: allUris.filter((u) =>
                        u.includes("post")
                      ),
                    },
                  },
                ],
              },
            },
            _source: ["reactionSubject", "reactionEmoji"],
            size: 1000,
          }),
          esavQuery<{
            hits: {
              hits: { _source: { "$metadata.did": string; footer: string } }[];
            };
          }>({
            query: {
              bool: {
                must: [{ term: { $type: "com.example.ft.user.profile" } }],
                filter: [{ terms: { "$metadata.did": allDids } }],
              },
            },
            _source: ["$metadata.did", "footer"],
            size: allDids.length,
          }),
          Promise.all(
            allDids.map(async (did) => {
              if (!agent) return { did, profile: null };
              try {
                const res = await agent.com.atproto.repo.getRecord({
                  repo: did,
                  collection: "app.bsky.actor.profile",
                  rkey: "self",
                });
                return {
                  did,
                  profile: JSON.parse(JSON.stringify(res.data.value)),
                };
              } catch (e) {
                return { did, profile: null };
              }
            })
          ),
        ]);

        const reactionsByPostUri = reactionsRes.hits.hits.reduce(
          (acc, hit) => {
            const r = hit._source;
            (acc[r.reactionSubject] = acc[r.reactionSubject] || []).push(r);
            return acc;
          },
          {} as Record<string, ReactionDoc[]>
        );
        setReactions(reactionsByPostUri);

        const footersByDid = footersRes.hits.hits.reduce(
          (acc, hit) => {
            acc[hit._source["$metadata.did"]] = hit._source.footer;
            return acc;
          },
          {} as Record<string, string>
        );

        const newAuthors: Record<string, AuthorInfo> = {};
        await Promise.all(
          allDids.map(async (did) => {
            const identity = await cachedResolveIdentity({
              didOrHandle: did,
              get,
              set,
            });
            if (!identity) return;
            const pdsProfile = pdsProfiles.find((p) => p.did === did)?.profile;
            newAuthors[did] = {
              ...identity,
              displayName: pdsProfile?.displayName,
              avatarCid: pdsProfile?.avatar?.ref?.["$link"],
              footer: footersByDid[did],
            };
          })
        );
        setAuthors(newAuthors);
      } catch (e) {
        console.error("Search failed:", e);
        setError("An error occurred during the search.");
      } finally {
        setIsLoading(false);
      }
    },
    [agent, get, set]
  );

  useEffect(() => {
    if (!authLoading) performSearch(q);
  }, [q, authLoading, performSearch]);

  const handleCreateReaction = async (post: PostDoc, emoji: string) => {
    if (!agent?.did || isCreatingReaction) return;
    setIsCreatingReaction(true);
    const postUri = post["$metadata.uri"];
    try {
      const date = new Date().toISOString();
      const response = await agent.com.atproto.repo.createRecord({
        repo: agent.did,
        collection: "com.example.ft.topic.reaction",
        record: {
          $type: "com.example.ft.topic.reaction",
          reactionEmoji: emoji,
          subject: postUri,
          createdAt: date,
        },
      });
      const uri = new AtUri(response.data.uri)
      const newReaction: ReactionDoc = {
        "$metadata.collection": "com.example.ft.topic.reaction",
        "$metadata.uri": response.data.uri,
        "$metadata.cid": response.data.cid,
        "$metadata.did": agent.did,
        "$metadata.rkey": uri.rkey,
        "$metadata.indexedAt": date,
        reactionEmoji: emoji,
        reactionSubject: postUri,
      };
      setReactions((prev) => ({
        ...prev,
        [postUri]: [...(prev[postUri] || []), newReaction],
      }));
    } catch (e) {
      console.error("Failed to create reaction", e);
      setError("Failed to post reaction.");
    } finally {
      setIsCreatingReaction(false);
    }
  };

  const renderContent = () => {
    if (isLoading)
      return (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      );
    if (error)
      return <div className="text-center text-red-400 p-8">{error}</div>;
    if (!q.trim())
      return (
        <div className="text-center text-gray-400 p-8">
          Enter a search term to begin.
        </div>
      );
    if (results.length === 0)
      return (
        <div className="text-center text-gray-400 p-8">
          No results found for "{q}".
        </div>
      );
    return (
      <div className="space-y-4">
        {results.map((post, index) => (
          <SearchResultCard
            agent={agent}
            key={post["$metadata.uri"]}
            post={post}
            author={_authors[post["$metadata.did"]] || null}
            reactions={reactions[post["$metadata.uri"]] || []}
            index={index}
            onNewReaction={handleCreateReaction}
            isCreatingReaction={isCreatingReaction}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col items-center pt-6 px-4 pb-12">
      <div className="w-full max-w-5xl space-y-4">
        <h1 className="text-2xl font-bold text-gray-100 mb-2">
          Search Results
        </h1>
        {q && (
          <p className="text-gray-400">
            Showing results for:{" "}
            <span className="font-semibold text-gray-200">"{q}"</span>
          </p>
        )}
        <div className="mt-6">{renderContent()}</div>
      </div>
    </div>
  );
}
