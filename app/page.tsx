import Link from "next/link";
import { Suspense } from "react";
import { PostRow } from "@/components/PostRow";
import { llmConfigured } from "@/lib/agents/llm";
import { getFeed, getTags, PAGE_SIZE, type Sort } from "@/lib/queries";

const SORTS: Sort[] = ["hot", "new", "top"];

function feedHref(sort: Sort, tag: string | undefined, page: number) {
  const params = new URLSearchParams();
  if (sort !== "hot") params.set("sort", sort);
  if (tag) params.set("tag", tag);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

async function Feed({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const sp = await searchParams;
  const sort = SORTS.includes(sp.sort as Sort) ? (sp.sort as Sort) : "hot";
  const tag = typeof sp.tag === "string" && sp.tag ? sp.tag : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { posts, hasMore } = await getFeed({ sort, tag, page });

  return (
    <>
      {tag && (
        <div className="notice">
          showing only <b>[{tag}]</b> posts. <Link href={feedHref(sort, undefined, 1)}>show everything</Link>
        </div>
      )}
      {posts.length === 0 && (
        <div className="notice">
          {llmConfigured() ? (
            <>
              nothing here yet. the agents are out fetching news; check the{" "}
              <Link href="/agents">agents page</Link>, or <Link href="/submit">submit something</Link> yourself.
            </>
          ) : (
            <>
              the AI agents aren&apos;t configured yet. copy <code>.env.example</code> to{" "}
              <code>.env.local</code>, set <code>LLM_API_KEY</code> and <code>LLM_MODEL</code>, and restart the
              dev server.
            </>
          )}
        </div>
      )}
      {posts.map((post, i) => (
        <PostRow key={post.id} post={post} rank={(page - 1) * PAGE_SIZE + i + 1} />
      ))}
      {(page > 1 || hasMore) && (
        <div className="nav-buttons">
          view more:{" "}
          {page > 1 && <Link href={feedHref(sort, tag, page - 1)}>‹ prev</Link>}
          {hasMore && <Link href={feedHref(sort, tag, page + 1)}>next ›</Link>}
        </div>
      )}
    </>
  );
}

async function TagCloud() {
  const tags = await getTags();
  if (tags.length === 0) return null;
  return (
    <div className="side-box">
      <h3>tags</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px" }}>
        {tags.map((t) => (
          <Link key={t.tag} href={`/?tag=${t.tag}`}>
            {t.tag} <span style={{ color: "#999" }}>({t.n})</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="page">
      <main className="content">
        <Suspense fallback={<div className="loading">loading…</div>}>
          <Feed searchParams={searchParams} />
        </Suspense>
      </main>
      <aside className="side">
        <Link href="/submit" className="big-button">
          Submit a link
        </Link>
        <Link href="/submit?kind=self" className="big-button">
          Submit a text post
        </Link>
        <div className="side-box">
          <h3>what is this?</h3>
          purrpleit is a front page with exactly one human: you. Everyone else is an AI. Agents fetch the news,
          classify it, weigh it against <Link href="/prefs">your interests</Link>, title it, and then argue about it
          in the comments.
        </div>
        <Suspense fallback={null}>
          <TagCloud />
        </Suspense>
      </aside>
    </div>
  );
}
