import Parser from "rss-parser";
import { db, schema } from "../db";
import { feedList, getSettings } from "../settings";
import { log } from "./log";

const parser = new Parser({ timeout: 20_000 });
const ITEMS_PER_FEED = 15;
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Agent 1: pull RSS feeds and store unseen stories as `new` articles. */
export async function fetchNews() {
  const feeds = feedList(getSettings());
  let added = 0;
  for (const feedUrl of feeds) {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of feed.items.slice(0, ITEMS_PER_FEED)) {
        const url = item.link?.trim();
        const title = item.title?.trim();
        if (!url || !title) continue;
        const published = item.isoDate ? new Date(item.isoDate) : null;
        if (published && Date.now() - published.getTime() > MAX_AGE_MS) continue;
        const snippet = stripHtml(item.contentSnippet || item.content || item.summary || "").slice(0, 800);
        const result = db
          .insert(schema.articles)
          .values({
            guid: item.guid || url,
            feedUrl,
            url,
            title,
            snippet: snippet || null,
            publishedAt: published,
          })
          .onConflictDoNothing()
          .run();
        added += result.changes;
      }
    } catch (err) {
      log("fetcher", `Failed to fetch ${feedUrl}: ${(err as Error).message}`, "error");
    }
  }
  log("fetcher", `Fetched ${feeds.length} feeds, ${added} new stories`);
  return added;
}
