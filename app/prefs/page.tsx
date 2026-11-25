import { connection } from "next/server";
import { Suspense } from "react";
import { rescoreBacklog, saveSettings } from "@/app/actions";
import { getHuman, getSettings } from "@/lib/settings";

async function PrefsForm() {
  await connection();
  const s = getSettings();
  const me = getHuman();
  return (
    <>
      <form action={saveSettings} className="form">
        <div className="field">
          <label className="field-title" htmlFor="username">
            your username
          </label>
          <input id="username" name="username" type="text" defaultValue={me.username} maxLength={20} />
        </div>
        <div className="field">
          <label className="field-title" htmlFor="interests">
            your interests
          </label>
          <textarea id="interests" name="interests" rows={5} defaultValue={s.interests} />
          <div className="hint">
            plain english. the weigher agent scores every story against this, including things you say you
            don&apos;t want.
          </div>
        </div>
        <div className="field">
          <label className="field-title" htmlFor="feeds">
            rss feeds
          </label>
          <textarea id="feeds" name="feeds" rows={8} defaultValue={s.feeds} style={{ fontFamily: "monospace" }} />
          <div className="hint">one url per line. lines starting with # are ignored.</div>
        </div>
        <div className="field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label className="field-title" htmlFor="cycleMinutes">
              fetch every (min)
            </label>
            <input id="cycleMinutes" name="cycleMinutes" type="number" min={1} defaultValue={s.cycleMinutes} />
          </div>
          <div>
            <label className="field-title" htmlFor="postsPerCycle">
              posts per cycle
            </label>
            <input id="postsPerCycle" name="postsPerCycle" type="number" min={1} max={20} defaultValue={s.postsPerCycle} />
          </div>
          <div>
            <label className="field-title" htmlFor="minRelevance">
              min relevance (0-100)
            </label>
            <input id="minRelevance" name="minRelevance" type="number" min={0} max={100} defaultValue={s.minRelevance} />
          </div>
        </div>
        <div className="field">
          <label>
            <input type="checkbox" name="agentsEnabled" defaultChecked={s.agentsEnabled} /> run agents in the
            background
          </label>
        </div>
        <button type="submit">save options</button>
      </form>
      <form action={rescoreBacklog} className="form" style={{ marginTop: 20 }}>
        <div className="hint" style={{ marginBottom: 4 }}>
          changed your interests? re-score stories that were fetched but haven&apos;t been posted yet.
        </div>
        <button type="submit">re-weigh unposted stories</button>
      </form>
    </>
  );
}

export default function PrefsPage() {
  return (
    <div className="page">
      <main className="content">
        <h1 className="page-heading">preferences</h1>
        <Suspense fallback={<div className="loading">loading…</div>}>
          <PrefsForm />
        </Suspense>
      </main>
    </div>
  );
}
