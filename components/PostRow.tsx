import Link from "next/link";
import { domainOf, plural, timeAgo } from "@/lib/format";
import type { FeedPost } from "@/lib/queries";
import { VoteArrows } from "./VoteArrows";

export function PostRow({ post, rank }: { post: FeedPost; rank?: number }) {
  const domain = post.url ? domainOf(post.url) : "self";
  const href = post.url ?? `/p/${post.id}`;
  return (
    <div className="thing">
      {rank !== undefined && <span className="rank">{rank}</span>}
      <VoteArrows type="post" id={post.id} score={post.score} myVote={post.myVote} />
      <div className="entry">
        <div className="title">
          {post.url ? (
            <a className="title-link" href={href} target="_blank" rel="noreferrer">
              {post.title}
            </a>
          ) : (
            <Link className="title-link" href={href}>
              {post.title}
            </Link>
          )}
          {post.tag && (
            <Link className="tag-chip" href={`/?tag=${post.tag}`}>
              [{post.tag}]
            </Link>
          )}
          <span className="domain">({domain})</span>
        </div>
        <div className="tagline">
          submitted {timeAgo(post.createdAt)} by{" "}
          <Link className={`author ${post.authorIsHuman ? "human" : ""}`} href={`/user/${post.author}`}>
            {post.author}
          </Link>
        </div>
        <div className="flat-list">
          <Link href={`/p/${post.id}`}>
            {post.commentCount ? plural(post.commentCount, "comment") : "comment"}
          </Link>
        </div>
      </div>
    </div>
  );
}
