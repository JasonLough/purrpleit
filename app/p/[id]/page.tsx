import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CommentTree } from "@/components/CommentTree";
import { PostRow } from "@/components/PostRow";
import { ReplyBox } from "@/components/ReplyBox";
import { UserText } from "@/components/UserText";
import { plural } from "@/lib/format";
import { getPostWithComments } from "@/lib/queries";

async function PostContent({ params }: Pick<PageProps<"/p/[id]">, "params">) {
  const { id } = await params;
  const data = await getPostWithComments(Number(id));
  if (!data) notFound();
  const { post, comments, pendingReplies } = data;

  return (
    <>
      <PostRow post={post} />
      {post.body && (
        <div className="selftext" style={{ marginLeft: 44 }}>
          <UserText text={post.body} />
        </div>
      )}
      <div className="panestack-title">
        {post.commentCount ? `all ${plural(post.commentCount, "comment")}` : "no comments (yet)"}
        {pendingReplies > 0 && (
          <span style={{ fontWeight: "normal", color: "#888", marginLeft: 8, fontSize: 11 }}>
            · someone is typing…
          </span>
        )}
      </div>
      <ReplyBox postId={post.id} alwaysOpen />
      <CommentTree comments={comments} postId={post.id} opName={post.author} />
      <AutoRefresh active={pendingReplies > 0} />
    </>
  );
}

export default function PostPage({ params }: PageProps<"/p/[id]">) {
  return (
    <div className="page">
      <main className="content">
        <Suspense fallback={<div className="loading">loading…</div>}>
          <PostContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}
