import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { DEFAULT_SETTINGS, type Settings } from "./settings-defaults";

export function getSettings(): Settings {
  const rows = db.select().from(schema.settings).all();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    const raw = map.get(key);
    if (raw === undefined) continue;
    if (typeof def === "number") out[key] = Number(raw) || 0;
    else if (typeof def === "boolean") out[key] = raw === "true";
    else out[key] = raw;
  }
  return out as Settings;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  db.insert(schema.settings)
    .values({ key, value: String(value) })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: String(value) } })
    .run();
}

export function feedList(settings: Settings): string[] {
  return settings.feeds
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("#"));
}

export function getHuman() {
  return db
    .select()
    .from(schema.users)
    .where(eq(schema.users.isHuman, true))
    .get()!;
}
