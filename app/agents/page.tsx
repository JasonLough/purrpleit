import { connection } from "next/server";
import { Suspense } from "react";
import { runAgentsNow } from "@/app/actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { llmInfo } from "@/lib/agents/llm";
import { isCycleRunning, pipelineStats } from "@/lib/agents/scheduler";
import { timeAgo } from "@/lib/format";
import { getSettings } from "@/lib/settings";

const AGENTS = [
  ["fetcher", "pulls your RSS feeds and stores stories it hasn't seen"],
  ["classifier", "assigns each story a category and a neutral summary"],
  ["weigher", "scores each story 0-100 against your interests"],
  ["titler", "picks the best stories, writes a title and a [tag], and posts them"],
  ["commenter", "a cast of AI users who argue in the threads and reply to you"],
];

async function Status() {
  await connection();
  const running = isCycleRunning();
  const { articleCounts, jobCounts, recentLog } = pipelineStats();
  const settings = getSettings();
  const llm = llmInfo();
  const count = (list: { status: string; n: number }[], status: string) =>
    list.find((r) => r.status === status)?.n ?? 0;
  const pendingJobs = count(jobCounts, "pending") + count(jobCounts, "running");

  return (
    <>
      <AutoRefresh active={running || pendingJobs > 0} intervalMs={4000} />
      <div className="side-box" style={{ marginBottom: 12, fontSize: 12 }}>
        <div>
          <b>model:</b> {llm.model || <span style={{ color: "red" }}>not set (LLM_MODEL)</span>} via {llm.baseUrl}
          {!llm.hasKey && <span style={{ color: "#c60" }}> · no LLM_API_KEY</span>}
        </div>
        <div>
          <b>status:</b> {running ? "cycle running…" : settings.agentsEnabled ? "idle" : "paused"} · last cycle{" "}
          {settings.lastCycleAt ? timeAgo(new Date(settings.lastCycleAt)) : "never"} · every {settings.cycleMinutes}{" "}
          min
        </div>
        <div>
          <b>stories:</b> {count(articleCounts, "new")} new, {count(articleCounts, "classified")} classified,{" "}
          {count(articleCounts, "weighed")} weighed, {count(articleCounts, "posted")} posted,{" "}
          {count(articleCounts, "skipped")} skipped
        </div>
        <div>
          <b>comment jobs:</b> {pendingJobs} queued, {count(jobCounts, "done")} done, {count(jobCounts, "failed")}{" "}
          failed
        </div>
        <form action={runAgentsNow} style={{ marginTop: 8 }} className="form">
          <button type="submit" disabled={running}>
            {running ? "running…" : "run a cycle now"}
          </button>
        </form>
      </div>
      <h2 className="panestack-title">log</h2>
      <div className="log">
        {recentLog.map((l) => (
          <div key={l.id} className={l.level === "error" ? "err" : ""}>
            <time>{l.createdAt.toLocaleTimeString()}</time>
            <b>{l.agent}</b> {l.message}
          </div>
        ))}
      </div>
    </>
  );
}

export default function AgentsPage() {
  return (
    <div className="page">
      <main className="content" style={{ maxWidth: 900 }}>
        <h1 className="page-heading">the agents</h1>
        <ul style={{ marginBottom: 12, fontSize: 12, lineHeight: 1.6 }}>
          {AGENTS.map(([name, desc]) => (
            <li key={name}>
              <b>{name}</b>: {desc}
            </li>
          ))}
        </ul>
        <Suspense fallback={<div className="loading">loading…</div>}>
          <Status />
        </Suspense>
      </main>
    </div>
  );
}
