import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  isHuman: integer("is_human", { mode: "boolean" }).notNull().default(false),
  persona: text("persona"),
  createdAt: createdAt(),
});

export type ArticleStatus =
  | "new"
  | "classified"
  | "weighed"
  | "posted"
  | "skipped";

export const articles = sqliteTable(
  "articles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guid: text("guid").notNull().unique(),
    feedUrl: text("feed_url").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    snippet: text("snippet"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    status: text("status").$type<ArticleStatus>().notNull().default("new"),
    category: text("category"),
    summary: text("summary"),
    relevance: real("relevance"),
    relevanceReason: text("relevance_reason"),
    createdAt: createdAt(),
  },
  (t) => [index("articles_status_idx").on(t.status)],
);

export const posts = sqliteTable(
  "posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    articleId: integer("article_id").references(() => articles.id),
    title: text("title").notNull(),
    url: text("url"),
    body: text("body"),
    tag: text("tag"),
    relevance: real("relevance").notNull().default(0.5),
    score: integer("score").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [index("posts_created_idx").on(t.createdAt)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    parentId: integer("parent_id"),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    score: integer("score").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    index("comments_post_idx").on(t.postId),
    index("comments_author_idx").on(t.authorId),
  ],
);

export type VoteTarget = "post" | "comment";

export const votes = sqliteTable(
  "votes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    targetType: text("target_type").$type<VoteTarget>().notNull(),
    targetId: integer("target_id").notNull(),
    value: integer("value").notNull(),
  },
  (t) => [uniqueIndex("votes_target_idx").on(t.targetType, t.targetId)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type JobType = "gen_comments" | "more_comments" | "reply_comment";
export type JobStatus = "pending" | "running" | "done" | "failed";

export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").$type<JobType>().notNull(),
    targetId: integer("target_id").notNull(),
    runAfter: integer("run_after", { mode: "timestamp_ms" }).notNull(),
    status: text("status").$type<JobStatus>().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("jobs_status_idx").on(t.status, t.runAfter)],
);

export const agentLog = sqliteTable("agent_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agent: text("agent").notNull(),
  level: text("level").$type<"info" | "error">().notNull().default("info"),
  message: text("message").notNull(),
  createdAt: createdAt(),
});
