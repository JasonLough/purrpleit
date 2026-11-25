import { db, schema } from "../db";

export function log(agent: string, message: string, level: "info" | "error" = "info") {
  const line = `[purrpleit:${agent}] ${message}`;
  if (level === "error") console.error(line);
  else console.log(line);
  db.insert(schema.agentLog).values({ agent, message, level }).run();
}
