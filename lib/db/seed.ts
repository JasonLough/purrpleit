import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { PERSONAS } from "../personas";
import { DEFAULT_SETTINGS } from "../settings-defaults";
import * as schema from "./schema";

export function seed(db: BetterSQLite3Database<typeof schema>) {
  db.insert(schema.users)
    .values(PERSONAS.map((p) => ({ ...p, isHuman: false })))
    .onConflictDoNothing()
    .run();

  db.insert(schema.settings)
    .values(
      Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
        key,
        value: String(value),
      })),
    )
    .onConflictDoNothing()
    .run();

  const human = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.isHuman, true))
    .get();
  if (!human) {
    db.insert(schema.users)
      .values({ username: DEFAULT_SETTINGS.username, isHuman: true })
      .onConflictDoNothing()
      .run();
  }
}
