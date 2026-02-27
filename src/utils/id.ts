import { randomBytes } from "crypto";

export function generateEventId(prefix = "evt"): string {
  const ts = Date.now().toString(36);
  const rand = randomBytes(6).toString("hex");
  return `${prefix}_${ts}_${rand}`;
}
