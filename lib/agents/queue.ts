import { db, schema } from "../db";
import type { JobType } from "../db/schema";

export function enqueue(type: JobType, targetId: number, delayMs = 0) {
  db.insert(schema.jobs)
    .values({ type, targetId, runAfter: new Date(Date.now() + delayMs) })
    .run();
}

export function randomBetween(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}
