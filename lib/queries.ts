import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "./db";

export const PAGE_SIZE = 25;
export type Sort = "hot" | "new" | "top";

const commentCount = sql<number>`(select count(*) from comments c where c.post_id = ${schema.posts.id})`;

const postSelect = {
  id: schema.posts.id,
  title: schema.posts.title,
  url: schema.posts.url,
  body: schema.posts.body,
  tag: schema.posts.tag,
  score: schema.posts.score,
  relevance: schema.posts.relevance,
  createdAt: schema.posts.createdAt,
  author: schema.users.username,
  authorIsHuman: schema.users.isHuman,
  commentCount,
};

export type FeedPost = Awaited<ReturnType<typeof getFeed>>["posts"][number];

function hotScore(score: number, createdAt: Date, relevance: number) {
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  const seconds = createdAt.getTime() / 1000 - 1134028003;
  return sign * order + seconds / 45000 + relevance * 1.5;
}

function voteMap(type: "post" | "comment", ids: number[]) {
  if (ids.length === 0) return new Map<number, number>();
  const rows = db
    .select()
    .from(schema.votes)
    .where(and(eq(schema.votes.targetType, type), inArray(schema.votes.targetId, ids)))
    .all();
  return new Map(rows.map((r) => [r.targetId, r.value]));
}

export async function getFeed({ sort, tag, page }: { sort: Sort; tag?: string; page: number }) {
  await connection();
  const where = tag ? eq(schema.posts.tag, tag) : undefined;
  const base = db
    .select(postSelect)
    .from(schema.posts)
    .innerJoin(schema.users, eq(schema.users.id, schema.posts.authorId))
    .where(where);

  let rows;
  const offset = (page - 1) * PAGE_SIZE;
  if (sort === "hot") {
    rows = base
      .orderBy(desc(schema.posts.createdAt))
      .limit(1000)
      .all()
      .sort((a, b) => hotScore(b.score, b.createdAt, b.relevance) - hotScore(a.score, a.createdAt, a.relevance))
      .slice(offset, offset + PAGE_SIZE + 1);
  } else {
    rows = base
      .orderBy(sort === "top" ? desc(schema.posts.score) : desc(schema.posts.createdAt), desc(schema.posts.id))
      .limit(PAGE_SIZE + 1)
      .offset(offset)
      .all();
  }
  const hasMore = rows.length > PAGE_SIZE;
  const posts = rows.slice(0, PAGE_SIZE);
  const votes = voteMap("post", posts.map((p) => p.id));
  return {
    posts: posts.map((p) => ({ ...p, myVote: votes.get(p.id) ?? 0 })),
    hasMore,
  };
}

export type CommentNode = {
  id: number;
  body: string;
  score: number;
  createdAt: Date;
  author: string;
  authorIsHuman: boolean;
  myVote: number;
  children: CommentNode[];
};

export async function getPostWithComments(id: number) {
  await connection();
  const post = db
    .select(postSelect)
    .from(schema.posts)
    .innerJoin(schema.users, eq(schema.users.id, schema.posts.authorId))
    .where(eq(schema.posts.id, id))
    .get();
  if (!post) return null;

  const rows = db
    .select({
      id: schema.comments.id,
      parentId: schema.comments.parentId,
      body: schema.comments.body,
      score: schema.comments.score,
      createdAt: schema.comments.createdAt,
      author: schema.users.username,
      authorIsHuman: schema.users.isHuman,
    })
    .from(schema.comments)
    .innerJoin(schema.users, eq(schema.users.id, schema.comments.authorId))
    .where(eq(schema.comments.postId, id))
    .all();

  const votes = voteMap("comment", rows.map((r) => r.id));
  const nodes = new Map<number, CommentNode>();
  for (const r of rows) {
    nodes.set(r.id, { ...r, myVote: votes.get(r.id) ?? 0, children: [] });
  }
  const roots: CommentNode[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    const parent = r.parentId != null ? nodes.get(r.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const sortTree = (list: CommentNode[]) => {
    list.sort((a, b) => b.score - a.score || a.id - b.id);
    list.forEach((n) => sortTree(n.children));
  };
  sortTree(roots);

  const pendingReplies = db
    .select({ n: sql<number>`count(*)` })
    .from(schema.jobs)
    .where(
      and(
        inArray(schema.jobs.status, ["pending", "running"]),
        or(
          and(inArray(schema.jobs.type, ["gen_comments", "more_comments"]), eq(schema.jobs.targetId, id)),
          and(
            eq(schema.jobs.type, "reply_comment"),
            sql`${schema.jobs.targetId} in (select id from comments where post_id = ${id})`,
          ),
        ),
      ),
    )
    .get()!.n;

  const [myVote] = voteMap("post", [id]).values();
  return { post: { ...post, myVote: myVote ?? 0 }, comments: roots, pendingReplies };
}

export async function getUserProfile(username: string) {
  await connection();
  const user = db.select().from(schema.users).where(eq(schema.users.username, username)).get();
  if (!user) return null;
  const postKarma = db
    .select({ n: sql<number>`coalesce(sum(score), 0)` })
    .from(schema.posts)
    .where(eq(schema.posts.authorId, user.id))
    .get()!.n;
  const commentKarma = db
    .select({ n: sql<number>`coalesce(sum(score), 0)` })
    .from(schema.comments)
    .where(eq(schema.comments.authorId, user.id))
    .get()!.n;
  const posts = db
    .select(postSelect)
    .from(schema.posts)
    .innerJoin(schema.users, eq(schema.users.id, schema.posts.authorId))
    .where(eq(schema.posts.authorId, user.id))
    .orderBy(desc(schema.posts.createdAt))
    .limit(25)
    .all();
  const comments = db
    .select({
      id: schema.comments.id,
      body: schema.comments.body,
      score: schema.comments.score,
      createdAt: schema.comments.createdAt,
      postId: schema.posts.id,
      postTitle: schema.posts.title,
    })
    .from(schema.comments)
    .innerJoin(schema.posts, eq(schema.posts.id, schema.comments.postId))
    .where(eq(schema.comments.authorId, user.id))
    .orderBy(desc(schema.comments.createdAt))
    .limit(25)
    .all();
  const postVotes = voteMap("post", posts.map((p) => p.id));
  return {
    user,
    postKarma,
    commentKarma,
    posts: posts.map((p) => ({ ...p, myVote: postVotes.get(p.id) ?? 0 })),
    comments,
  };
}

export async function getTags() {
  await connection();
  return db
    .select({ tag: schema.posts.tag, n: sql<number>`count(*)` })
    .from(schema.posts)
    .where(sql`${schema.posts.tag} is not null`)
    .groupBy(schema.posts.tag)
    .orderBy(desc(sql`count(*)`))
    .limit(20)
    .all();
}
