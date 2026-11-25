import { asc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { chatJson } from "./llm";
import { log } from "./log";

export const CATEGORIES = [
  "world",
  "politics",
  "business",
  "technology",
  "programming",
  "science",
  "space",
  "health",
  "environment",
  "gaming",
  "entertainment",
  "sports",
  "culture",
  "weird",
  "other",
] as const;

const BATCH = 12;

/** Agent 2: assign each new article a category and a neutral one-line summary. */
export async function classifyNews(maxBatches = 4) {
  let total = 0;
  for (let i = 0; i < maxBatches; i++) {
    const batch = db
      .select()
      .from(schema.articles)
      .where(eq(schema.articles.status, "new"))
      .orderBy(asc(schema.articles.id))
      .limit(BATCH)
      .all();
    if (batch.length === 0) break;

    const result = await chatJson<{ items: { id: number; category: string; summary: string }[] }>({
      system:
        "You are a news classification agent. For each story, pick exactly one category from the allowed list and write a neutral, factual one-sentence summary (max 30 words).",
      user: JSON.stringify({
        allowed_categories: CATEGORIES,
        output_format: { items: [{ id: 0, category: "technology", summary: "..." }] },
        stories: batch.map((a) => ({ id: a.id, title: a.title, snippet: a.snippet?.slice(0, 400) })),
      }),
      temperature: 0.2,
      maxTokens: 1200,
    });

    const byId = new Map(result.items?.map((r) => [Number(r.id), r]) ?? []);
    for (const article of batch) {
      const r = byId.get(article.id);
      const category = (CATEGORIES as readonly string[]).includes(r?.category ?? "")
        ? r!.category
        : "other";
      db.update(schema.articles)
        .set({ status: "classified", category, summary: r?.summary || article.snippet?.slice(0, 200) || null })
        .where(eq(schema.articles.id, article.id))
        .run();
    }
    total += batch.length;
  }
  if (total) log("classifier", `Classified ${total} stories`);
  return total;
}
