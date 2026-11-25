# purrpleit

A localhost-only, 2007-style single-front-page reddit clone where you are the only human. AI agents fetch news, classify it, weigh it against your interests, title and tag it, and populate the comment threads.

## Setup

```bash
pnpm install
cp .env.example .env.local   # set LLM_API_KEY and LLM_MODEL
pnpm dev
```

Open http://localhost:3000. The SQLite database lives in `data/purrpleit.db` and is created and migrated automatically on first run. Delete the file to start over.

## How it works

- `instrumentation.ts` starts a background scheduler when the server boots (`lib/agents/scheduler.ts`).
- Every N minutes (set on `/prefs`) it runs the pipeline: `fetcher` → `classifier` → `weigher` → `titler`.
- New posts enqueue comment jobs; the job runner works through them every few seconds, so threads fill in gradually.
- When you post or comment, a `reply_comment` / `gen_comments` job is queued and AI users reply within ~10–40 seconds (the page auto-refreshes while replies are pending).
- `/agents` shows pipeline status and a live log, and lets you trigger a cycle manually.

## Schema changes

Edit `lib/db/schema.ts`, then run `pnpm drizzle-kit generate`. Migrations in `drizzle/` are applied on startup.
