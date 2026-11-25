import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "../db";
import { getSettings } from "../settings";
import { CATEGORIES } from "./classifier";
import { chatJson } from "./llm";
import { log } from "./log";
import { enqueue, randomBetween } from "./queue";

const STALE_MS = 2 * 24 * 60 * 60 * 1000;

/** Agent 4: turn the most relevant weighed articles into posts with a reddit-style title and tag. */
export async function publishPosts() {
  const { postsPerCycle, minRelevance } = getSettings();

  db.update(schema.articles)
    .set({ status: "skipped" })
    .where(
      and(
        eq(schema.articles.status, "weighed"),
        lt(schema.articles.createdAt, new Date(Date.now() - STALE_MS)),
      ),
    )
    .run();

  const picks = db
    .select()
    .from(schema.articles)
    .where(
      and(
        eq(schema.articles.status, "weighed"),
        gte(schema.articles.relevance, minRelevance / 100),
      ),
    )
    .orderBy(desc(schema.articles.relevance))
    .limit(postsPerCycle)
    .all();
  if (picks.length === 0) {
    log("titler", "Nothing relevant enough to post this cycle");
    return 0;
  }

  const result = await chatJson<{ items: { id: number; title: string; tag: string }[] }>({
    system:
      "You write post titles for a 2007-era link aggregator (old reddit). Titles are written by a regular user submitting the link: plain, informative, sometimes a bit editorial or witty, never clickbait, no emojis, no hashtags, sentence case, max 120 characters. Also pick a single short lowercase tag (one word) describing the topic; prefer one of the suggested tags.",
    user: JSON.stringify({
      suggested_tags: CATEGORIES,
      output_format: { items: [{ id: 0, title: "...", tag: "science" }] },
      stories: picks.map((a) => ({ id: a.id, original_title: a.title, summary: a.summary, category: a.category })),
    }),
    temperature: 0.8,
  });

  const byId = new Map(result.items?.map((r) => [Number(r.id), r]) ?? []);
  const personas = db.select().from(schema.users).where(eq(schema.users.isHuman, false)).all();

  picks.forEach((article, i) => {
    const r = byId.get(article.id);
    const author = personas[Math.floor(Math.random() * personas.length)];
    const relevance = article.relevance ?? 0.5;
    const tag = (r?.tag || article.category || "other").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "other";
    const post = db
      .insert(schema.posts)
      .values({
        authorId: author.id,
        articleId: article.id,
        title: (r?.title || article.title).slice(0, 300),
        url: article.url,
        tag,
        relevance,
        score: Math.round(relevance * randomBetween(5, 60)) + 1,
      })
      .returning({ id: schema.posts.id })
      .get();
    db.update(schema.articles).set({ status: "posted" }).where(eq(schema.articles.id, article.id)).run();
    enqueue("gen_comments", post.id, i * randomBetween(15_000, 45_000));
  });

  log("titler", `Published ${picks.length} posts`);
  return picks.length;
}
