"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import type { VoteTarget } from "@/lib/db/schema";
import { enqueue, randomBetween } from "@/lib/agents/queue";
import { runCycle } from "@/lib/agents/scheduler";
import { getHuman, setSetting } from "@/lib/settings";

export async function vote(targetType: VoteTarget, targetId: number, value: -1 | 0 | 1) {
  const existing = db
    .select()
    .from(schema.votes)
    .where(and(eq(schema.votes.targetType, targetType), eq(schema.votes.targetId, targetId)))
    .get();
  const delta = value - (existing?.value ?? 0);
  if (delta === 0) return;
  const table = targetType === "post" ? schema.posts : schema.comments;
  db.transaction((tx) => {
    tx.update(table)
      .set({ score: sql`${table.score} + ${delta}` })
      .where(eq(table.id, targetId))
      .run();
    tx.insert(schema.votes)
      .values({ targetType, targetId, value })
      .onConflictDoUpdate({
        target: [schema.votes.targetType, schema.votes.targetId],
        set: { value },
      })
      .run();
  });
}

export type SubmitState = { error?: string };

export async function submitPost(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const kind = formData.get("kind") === "self" ? "self" : "link";
  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const tag = String(formData.get("tag") ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20);

  if (!title) return { error: "a title is required" };
  if (kind === "link") {
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error();
    } catch {
      return { error: "that doesn't look like a valid url" };
    }
  } else if (!body) {
    return { error: "text posts need some text" };
  }

  const human = getHuman();
  const post = db
    .insert(schema.posts)
    .values({
      authorId: human.id,
      title: title.slice(0, 300),
      url: kind === "link" ? url : null,
      body: kind === "self" ? body : null,
      tag: tag || null,
      relevance: 0.8,
      score: 1,
    })
    .returning({ id: schema.posts.id })
    .get();
  db.insert(schema.votes).values({ targetType: "post", targetId: post.id, value: 1 }).run();
  enqueue("gen_comments", post.id, randomBetween(10_000, 40_000));
  redirect(`/p/${post.id}`);
}

export async function addComment(formData: FormData) {
  const postId = Number(formData.get("postId"));
  const parentRaw = formData.get("parentId");
  const parentId = parentRaw ? Number(parentRaw) : null;
  const body = String(formData.get("body") ?? "").trim();
  if (!postId || !body) return;

  const human = getHuman();
  const comment = db
    .insert(schema.comments)
    .values({ postId, parentId, authorId: human.id, body, score: 1 })
    .returning({ id: schema.comments.id })
    .get();
  db.insert(schema.votes).values({ targetType: "comment", targetId: comment.id, value: 1 }).run();
  enqueue("reply_comment", comment.id, randomBetween(8_000, 30_000));
  refresh();
}

export async function saveSettings(formData: FormData) {
  const username = String(formData.get("username") ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 20);
  if (username) {
    const taken = db.select().from(schema.users).where(eq(schema.users.username, username)).get();
    const human = getHuman();
    if (!taken || taken.id === human.id) {
      db.update(schema.users).set({ username }).where(eq(schema.users.id, human.id)).run();
    }
  }
  setSetting("interests", String(formData.get("interests") ?? "").trim());
  setSetting("feeds", String(formData.get("feeds") ?? "").trim());
  setSetting("cycleMinutes", Math.max(1, Number(formData.get("cycleMinutes")) || 30));
  setSetting("postsPerCycle", Math.max(1, Math.min(20, Number(formData.get("postsPerCycle")) || 4)));
  setSetting("minRelevance", Math.max(0, Math.min(100, Number(formData.get("minRelevance")) || 0)));
  setSetting("agentsEnabled", formData.get("agentsEnabled") === "on");
  refresh();
}

export async function runAgentsNow() {
  void runCycle(true);
  await new Promise((r) => setTimeout(r, 500));
  refresh();
}

export async function rescoreBacklog() {
  db.update(schema.articles)
    .set({ status: "classified" })
    .where(eq(schema.articles.status, "weighed"))
    .run();
  refresh();
}
