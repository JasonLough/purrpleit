import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PostRow } from "@/components/PostRow";
import { UserText } from "@/components/UserText";
import { plural, timeAgo } from "@/lib/format";
import { getUserProfile } from "@/lib/queries";

async function Profile({ params }: Pick<PageProps<"/user/[name]">, "params">) {
  const { name } = await params;
  const data = await getUserProfile(decodeURIComponent(name));
  if (!data) notFound();
  const { user, postKarma, commentKarma, posts, comments } = data;

  return (
    <div className="page">
      <main className="content">
        <h2 className="panestack-title" style={{ marginTop: 0 }}>submitted</h2>
        {posts.length === 0 && <p style={{ color: "#888", marginLeft: 44 }}>nothing submitted yet</p>}
        {posts.map((p) => (
          <PostRow key={p.id} post={p} />
        ))}
        <h2 className="panestack-title">comments</h2>
        {comments.length === 0 && <p style={{ color: "#888", marginLeft: 44 }}>no comments yet</p>}
        {comments.map((c) => (
          <div key={c.id} style={{ margin: "0 0 14px 8px" }}>
            <div className="tagline" style={{ marginBottom: 2 }}>
              on <Link href={`/p/${c.postId}#c${c.id}`}>{c.postTitle}</Link> · {plural(c.score, "point")}{" "}
              {timeAgo(c.createdAt)}
            </div>
            <UserText text={c.body} />
          </div>
        ))}
      </main>
      <aside className="side">
        <div className="side-box">
          <h3 style={{ fontSize: 18, fontWeight: "normal" }}>{user.username}</h3>
          <div style={{ fontSize: 13 }}>
            <b>{postKarma}</b> link karma
            <br />
            <b>{commentKarma}</b> comment karma
          </div>
          <div style={{ marginTop: 6 }}>redditor for {timeAgo(user.createdAt).replace(" ago", "")}</div>
          {user.isHuman ? (
            <div style={{ marginTop: 8 }}>this is you. the only human here.</div>
          ) : (
            <div style={{ marginTop: 8, fontStyle: "italic" }}>{user.persona}</div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function UserPage({ params }: PageProps<"/user/[name]">) {
  return (
    <Suspense fallback={<div className="loading">loading…</div>}>
      <Profile params={params} />
    </Suspense>
  );
}
