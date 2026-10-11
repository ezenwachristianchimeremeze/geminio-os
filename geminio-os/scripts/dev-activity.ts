/**
 * Append a REAL activity entry for the Preview panel.
 *   tsx scripts/dev-activity.ts "Editing server/ai-builder/service.ts"
 *   tsx scripts/dev-activity.ts --level error --detail "<output>" "Waiting for npm registry"
 * Source is always "agent". Entries are redacted before they are written.
 */
import { join } from "node:path";
import { appendActivity } from "../server/dev-preview/activity";

const args = process.argv.slice(2);
let level: "info" | "warning" | "error" = "info";
let detail: string | undefined;
const rest: string[] = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--level") { const v = args[++i]; if (v === "info" || v === "warning" || v === "error") level = v; else { console.error("level must be info|warning|error"); process.exit(2); } }
  else if (args[i] === "--detail") detail = args[++i];
  else rest.push(args[i]);
}
const message = rest.join(" ").trim();
if (!message) { console.error('usage: tsx scripts/dev-activity.ts [--level info|warning|error] [--detail "..."] "message"'); process.exit(2); }
appendActivity(join(process.cwd(), ".geminio", "dev-activity.jsonl"), { source: "agent", level, message, detail });
