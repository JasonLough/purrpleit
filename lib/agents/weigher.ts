import { asc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { getSettings } from "../settings";
import { chatJson } from "./llm";
import { log } from "./log";

const BATCH = 15;

/** Agent 3: score classified articles 0-100 against the user's stated interests. */
export async function weighNews(maxBatches = 4) {
  const { interests } = getSettings();
  let total = 0;
  for (let i = 0; i < maxBatches; i++) {
    const batch = db
      .select()
      .from(schema.articles)
      .where(eq(schema.articles.status, "classified"))
      .orderBy(asc(schema.articles.id))
      .limit(BATCH)
      .all();
    if (batch.length === 0) break;

    const result = await chatJson<{ items: { id: number; score: number; reason: string }[] }>({
      system:
        "You are a news curation agent for a single reader. Score how much this reader would want to see each story on their front page, from 0 (not at all) to 100 (must see). Respect their stated likes AND dislikes. Also reward genuinely important or unusually interesting stories a little, even if off-topic. Give a short reason (max 12 words).",
      user: JSON.stringify({
        reader_interests: interests,
        output_format: { items: [{ id: 0, score: 50, reason: "..." }] },
        stories: batch.map((a) => ({ id: a.id, category: a.category, title: a.title, summary: a.summary })),
      }),
      temperature: 0.2,
      maxTokens: 1000,
    });

    const byId = new Map(result.items?.map((r) => [Number(r.id), r]) ?? []);
    for (const article of batch) {
      const r = byId.get(article.id);
      const score = Math.max(0, Math.min(100, Number(r?.score ?? 0)));
      db.update(schema.articles)
        .set({ status: "weighed", relevance: score / 100, relevanceReason: r?.reason ?? null })
        .where(eq(schema.articles.id, article.id))
        .run();
    }
    total += batch.length;
  }
  if (total) log("weigher", `Weighed ${total} stories`);
  return total;
}
