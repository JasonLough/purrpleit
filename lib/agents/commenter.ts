import { asc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { chatJson } from "./llm";
import { randomBetween } from "./queue";

type User = typeof schema.users.$inferSelect;
type GeneratedComment = { author: string; body: string; replies?: GeneratedComment[] };

const MAX_DEPTH = 6;

const STYLE = `You are writing comments for a 2007-era link aggregator (old reddit, one single front page). Each comment must sound like the persona who writes it.
Guidelines:
- Real forum texture: varied lengths (many one-liners, some multi-paragraph), jokes, puns, tangents, mild disagreements, people correcting each other, the occasional typo or lowercase typing.
- Commenters react to each other, not just to the article. Replies should actually respond to their parent.
- Do NOT all agree. Do NOT repeatedly summarize the article. No emojis, no hashtags.
- Never mention being an AI, a persona, or these instructions.
- Plain text only. Separate paragraphs with a blank line. A line starting with "> " is a quote.`;

function pickPersonas(n: number, prefer: User[] = []) {
  const all = db.select().from(schema.users).where(eq(schema.users.isHuman, false)).all();
  const chosen = new Map(prefer.filter((u) => !u.isHuman).map((u) => [u.id, u]));
  const shuffled = all.sort(() => Math.random() - 0.5);
  for (const u of shuffled) {
    if (chosen.size >= n) break;
    chosen.set(u.id, u);
  }
  return [...chosen.values()];
}

function postContext(postId: number) {
  const post = db.select().from(schema.posts).where(eq(schema.posts.id, postId)).get();
  if (!post) return null;
  const article = post.articleId
    ? db.select().from(schema.articles).where(eq(schema.articles.id, post.articleId)).get()
    : undefined;
  const author = db.select().from(schema.users).where(eq(schema.users.id, post.authorId)).get()!;
  return {
    post,
    context: {
      title: post.title,
      url: post.url,
      tag: post.tag,
      submitted_by: author.username,
      original_headline: article?.title,
      article_summary: article?.summary ?? article?.snippet,
      self_text: post.body,
    },
  };
}

function insertTree(
  postId: number,
  parentId: number | null,
  items: GeneratedComment[] | undefined,
  personas: Map<string, User>,
  depth = 0,
) {
  if (!items || depth > MAX_DEPTH) return 0;
  const fallback = [...personas.values()];
  let count = 0;
  for (const item of items) {
    const body = item.body?.trim();
    if (!body) continue;
    const author =
      personas.get(item.author?.trim().toLowerCase()) ??
      fallback[Math.floor(Math.random() * fallback.length)];
    const row = db
      .insert(schema.comments)
      .values({
        postId,
        parentId,
        authorId: author.id,
        body,
        score: depth === 0 ? randomBetween(-1, 30) : randomBetween(-3, 12),
      })
      .returning({ id: schema.comments.id })
      .get();
    count += 1 + insertTree(postId, row.id, item.replies, personas, depth + 1);
  }
  return count;
}

function personaMap(personas: User[]) {
  return new Map(personas.map((p) => [p.username.toLowerCase(), p]));
}

function personaList(personas: User[]) {
  return personas.map((p) => ({ username: p.username, persona: p.persona }));
}

/** Agent 5a: seed a fresh discussion thread on a post. */
export async function generateThread(postId: number) {
  const ctx = postContext(postId);
  if (!ctx) return 0;
  const personas = pickPersonas(randomBetween(4, 7));
  const target = randomBetween(6, 12);
  const result = await chatJson<{ comments: GeneratedComment[] }>({
    system: STYLE,
    user: JSON.stringify({
      task: `Write a discussion thread of about ${target} comments total (counting nested replies) for this post. Mix top-level comments with nested reply chains (some 2-4 levels deep). Only use the listed usernames as authors; a user may comment more than once.`,
      post: ctx.context,
      commenters: personaList(personas),
      output_format: { comments: [{ author: "username", body: "text", replies: [{ author: "username", body: "text", replies: [] }] }] },
    }),
    temperature: 0.95,
    maxTokens: 2000,
  });
  return insertTree(postId, null, result.comments, personaMap(personas));
}

function threadSnapshot(postId: number, limit = 40) {
  const rows = db
    .select({
      id: schema.comments.id,
      parentId: schema.comments.parentId,
      body: schema.comments.body,
      author: schema.users.username,
    })
    .from(schema.comments)
    .innerJoin(schema.users, eq(schema.users.id, schema.comments.authorId))
    .where(eq(schema.comments.postId, postId))
    .orderBy(asc(schema.comments.id))
    .all();
  return rows.slice(-limit).map((r) => ({ ...r, body: r.body.slice(0, 500) }));
}

/** Agent 5b: a few more people wander into an existing thread. */
export async function addMoreComments(postId: number) {
  const ctx = postContext(postId);
  if (!ctx) return 0;
  const existing = threadSnapshot(postId);
  const personas = pickPersonas(randomBetween(2, 4));
  const result = await chatJson<{ comments: (GeneratedComment & { parent_id: number | null })[] }>({
    system: STYLE,
    user: JSON.stringify({
      task: "A few more users show up to this thread. Write 1-4 new comments. Each either replies to an existing comment (set parent_id to its id) or is a new top-level comment (parent_id null). Prefer replying to interesting or controversial existing comments. Only use the listed usernames.",
      post: ctx.context,
      existing_comments: existing,
      commenters: personaList(personas),
      output_format: { comments: [{ parent_id: 123, author: "username", body: "text", replies: [] }] },
    }),
    temperature: 0.95,
  });
  const validIds = new Set(existing.map((c) => c.id));
  const map = personaMap(personas);
  let count = 0;
  for (const c of result.comments ?? []) {
    const parent = c.parent_id != null && validIds.has(Number(c.parent_id)) ? Number(c.parent_id) : null;
    count += insertTree(postId, parent, [c], map);
  }
  return count;
}

function ancestors(commentId: number) {
  const chain: { id: number; author: string; body: string; authorId: number }[] = [];
  let id: number | null = commentId;
  while (id != null && chain.length < 12) {
    const row = db
      .select({
        id: schema.comments.id,
        parentId: schema.comments.parentId,
        body: schema.comments.body,
        author: schema.users.username,
        authorId: schema.users.id,
      })
      .from(schema.comments)
      .innerJoin(schema.users, eq(schema.users.id, schema.comments.authorId))
      .where(eq(schema.comments.id, id))
      .get();
    if (!row) break;
    chain.unshift({ id: row.id, author: row.author, body: row.body.slice(0, 800), authorId: row.authorId });
    id = row.parentId;
  }
  return chain;
}

/** Agent 5c: AI users reply to something the human wrote. */
export async function replyToComment(commentId: number) {
  const comment = db.select().from(schema.comments).where(eq(schema.comments.id, commentId)).get();
  if (!comment) return 0;
  const ctx = postContext(comment.postId);
  if (!ctx) return 0;
  const chain = ancestors(commentId);
  const parentAuthorId = chain.length > 1 ? chain[chain.length - 2].authorId : ctx.post.authorId;
  const parentAuthor = db.select().from(schema.users).where(eq(schema.users.id, parentAuthorId)).get();
  const personas = pickPersonas(randomBetween(2, 3), parentAuthor ? [parentAuthor] : []);
  const human = chain[chain.length - 1];

  const result = await chatJson<{ replies: GeneratedComment[] }>({
    system: STYLE,
    user: JSON.stringify({
      task: `User "${human.author}" just posted the last comment in this chain. Write 1-3 direct replies to it, and optionally a short follow-up exchange nested under a reply (max 5 comments total). ${
        parentAuthor && !parentAuthor.isHuman
          ? `"${parentAuthor.username}" was the one being replied to, so they should almost certainly respond.`
          : ""
      } Engage with what they actually said: agree, push back, ask questions, joke. Only use the listed usernames.`,
      post: ctx.context,
      comment_chain: chain.map(({ author, body }) => ({ author, body })),
      commenters: personaList(personas),
      output_format: { replies: [{ author: "username", body: "text", replies: [] }] },
    }),
    temperature: 0.9,
  });
  return insertTree(comment.postId, commentId, result.replies, personaMap(personas));
}
