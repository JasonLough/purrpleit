import Link from "next/link";
import { plural, timeAgo } from "@/lib/format";
import type { CommentNode } from "@/lib/queries";
import { CommentShell } from "./CommentShell";
import { ReplyBox } from "./ReplyBox";
import { UserText } from "./UserText";

function countDescendants(node: CommentNode): number {
  return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

function Comment({ node, postId, opName }: { node: CommentNode; postId: number; opName: string }) {
  return (
    <CommentShell
      id={node.id}
      score={node.score}
      myVote={node.myVote}
      descendants={countDescendants(node)}
      tagline={
        <>
          <Link className={`author ${node.authorIsHuman ? "human" : ""}`} href={`/user/${node.author}`}>
            {node.author}
          </Link>
          {node.author === opName && <span style={{ color: "#0055df" }}> [S]</span>}{" "}
          <span className="score-inline">{plural(node.score, "point")}</span> {timeAgo(node.createdAt)}
        </>
      }
    >
      <UserText text={node.body} />
      <ReplyBox postId={postId} parentId={node.id} />
      {node.children.length > 0 && (
        <div className="child">
          {node.children.map((c) => (
            <Comment key={c.id} node={c} postId={postId} opName={opName} />
          ))}
        </div>
      )}
    </CommentShell>
  );
}

export function CommentTree({
  comments,
  postId,
  opName,
}: {
  comments: CommentNode[];
  postId: number;
  opName: string;
}) {
  return (
    <div className="comment-area">
      {comments.map((c) => (
        <Comment key={c.id} node={c} postId={postId} opName={opName} />
      ))}
    </div>
  );
}
