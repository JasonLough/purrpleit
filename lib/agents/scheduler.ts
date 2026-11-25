import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { getSettings, setSetting } from "../settings";
import { classifyNews } from "./classifier";
import { addMoreComments, generateThread, replyToComment } from "./commenter";
import { fetchNews } from "./fetcher";
import { llmConfigured } from "./llm";
import { log } from "./log";
import { enqueue, randomBetween } from "./queue";
import { publishPosts } from "./titler";
import { weighNews } from "./weigher";

const JOB_TICK_MS = 8_000;
const CYCLE_CHECK_MS = 30_000;
const MAX_ATTEMPTS = 3;

type SchedulerState = { started: boolean; cycleRunning: boolean; jobRunning: boolean };
const g = globalThis as unknown as { __purrpleScheduler?: SchedulerState };
const state: SchedulerState = (g.__purrpleScheduler ??= {
  started: false,
  cycleRunning: false,
  jobRunning: false,
});

export function isCycleRunning() {
  return state.cycleRunning;
}

/** One full pass of the news pipeline: fetch → classify → weigh → title/publish → keep threads alive. */
export async function runCycle(force = false) {
  if (state.cycleRunning) return false;
  const settings = getSettings();
  if (!force && !settings.agentsEnabled) return false;
  if (!llmConfigured()) {
    log("scheduler", "LLM_MODEL not set in .env.local; skipping cycle", "error");
    setSetting("lastCycleAt", Date.now());
    return false;
  }
  state.cycleRunning = true;
  setSetting("lastCycleAt", Date.now());
  try {
    log("scheduler", "Cycle started");
    await fetchNews();
    await classifyNews();
    await weighNews();
    await publishPosts();
    stirOldThreads();
    driftScores();
    log("scheduler", "Cycle finished");
  } catch (err) {
    log("scheduler", `Cycle failed: ${(err as Error).message}`, "error");
  } finally {
    state.cycleRunning = false;
  }
  return true;
}

function stirOldThreads() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = db
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(gte(schema.posts.createdAt, since))
    .orderBy(sql`random()`)
    .limit(2)
    .all();
  for (const p of recent) enqueue("more_comments", p.id, randomBetween(30_000, 180_000));
}

/** Fake the rest of the userbase voting: recent, relevant posts keep climbing. */
function driftScores() {
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000);
  const recent = db.select().from(schema.posts).where(gte(schema.posts.createdAt, since)).all();
  for (const p of recent) {
    const bump = Math.round(p.relevance * randomBetween(0, 25)) - randomBetween(0, 3);
    db.update(schema.posts)
      .set({ score: sql`${schema.posts.score} + ${bump}` })
      .where(eq(schema.posts.id, p.id))
      .run();
  }
  db.run(sql`
    update comments set score = score + (abs(random()) % 5) - 1
    where post_id in (select id from posts where created_at >= ${since.getTime()})
  `);
}

async function runDueJob() {
  if (state.jobRunning || !llmConfigured()) return;
  const job = db
    .select()
    .from(schema.jobs)
    .where(and(eq(schema.jobs.status, "pending"), lte(schema.jobs.runAfter, new Date())))
    .orderBy(asc(schema.jobs.runAfter))
    .limit(1)
    .get();
  if (!job) return;

  state.jobRunning = true;
  db.update(schema.jobs)
    .set({ status: "running", attempts: job.attempts + 1 })
    .where(eq(schema.jobs.id, job.id))
    .run();
  try {
    let n = 0;
    if (job.type === "gen_comments") n = await generateThread(job.targetId);
    else if (job.type === "more_comments") n = await addMoreComments(job.targetId);
    else if (job.type === "reply_comment") n = await replyToComment(job.targetId);
    db.update(schema.jobs).set({ status: "done" }).where(eq(schema.jobs.id, job.id)).run();
    log("commenter", `${job.type} #${job.targetId}: wrote ${n} comments`);
  } catch (err) {
    const failed = job.attempts + 1 >= MAX_ATTEMPTS;
    db.update(schema.jobs)
      .set({
        status: failed ? "failed" : "pending",
        error: (err as Error).message,
        runAfter: new Date(Date.now() + 30_000),
      })
      .where(eq(schema.jobs.id, job.id))
      .run();
    log("commenter", `${job.type} #${job.targetId} failed: ${(err as Error).message}`, "error");
  } finally {
    state.jobRunning = false;
  }
}

function maybeStartCycle() {
  const { agentsEnabled, cycleMinutes, lastCycleAt } = getSettings();
  if (!agentsEnabled) return;
  if (Date.now() - lastCycleAt >= Math.max(1, cycleMinutes) * 60_000) void runCycle();
}

export function startScheduler() {
  if (state.started) return;
  state.started = true;
  db.update(schema.jobs).set({ status: "pending" }).where(eq(schema.jobs.status, "running")).run();
  log("scheduler", "Background agents started");
  setTimeout(maybeStartCycle, 3_000);
  setInterval(maybeStartCycle, CYCLE_CHECK_MS);
  setInterval(() => void runDueJob(), JOB_TICK_MS);
}

export function pipelineStats() {
  const articleCounts = db
    .select({ status: schema.articles.status, n: sql<number>`count(*)` })
    .from(schema.articles)
    .groupBy(schema.articles.status)
    .all();
  const jobCounts = db
    .select({ status: schema.jobs.status, n: sql<number>`count(*)` })
    .from(schema.jobs)
    .groupBy(schema.jobs.status)
    .all();
  const recentLog = db.select().from(schema.agentLog).orderBy(desc(schema.agentLog.id)).limit(60).all();
  return { articleCounts, jobCounts, recentLog };
}
