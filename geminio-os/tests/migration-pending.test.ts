/**
 * Static consistency of the staged (hand-written, un-journaled) migrations against drizzle/schema.ts. This does NOT run SQL and is
 * NOT a substitute for applying migrations to MySQL; it catches the mistakes that are detectable by reading (missing primary key,
 * schema tables that no migration creates, lost manual backfill).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const schema = readFileSync("drizzle/schema.ts", "utf8");
const journaled = readdirSync("drizzle").filter((f) => /^\d{4}_.*\.sql$/.test(f)).map((f) => readFileSync(`drizzle/${f}`, "utf8")).join("\n");
const pendingFiles = readdirSync("drizzle/pending").filter((f) => f.endsWith(".sql")).sort();
const pending = pendingFiles.map((f) => readFileSync(`drizzle/pending/${f}`, "utf8")).join("\n");
const created = (sql: string) => new Set([...sql.matchAll(/CREATE TABLE `(\w+)`/g)].map((m) => m[1]));
const schemaTables = [...schema.matchAll(/mysqlTable\("(\w+)"/g)].map((m) => m[1]);

describe("staged migrations", () => {
  it("every table in schema.ts is created by a journaled or a staged migration", () => {
    const known = new Set([...created(journaled), ...created(pending)]);
    expect(schemaTables.filter((t) => !known.has(t))).toEqual([]);
  });
  it("every staged CREATE TABLE has a primary key (managed MySQL can reject keyless tables)", () => {
    for (const m of pending.matchAll(/CREATE TABLE `(\w+)` \(([\s\S]*?)\n?\);/g)) expect(`${m[1]}:${/PRIMARY KEY/.test(m[2])}`).toBe(`${m[1]}:true`);
  });
  it("homeChatScheduleRuns has a composite primary key in both schema and SQL", () => {
    expect(schema).toMatch(/primaryKey\(\{ columns: \[table\.scheduleId, table\.occurrence\] \}\)/);
    expect(pending).toMatch(/homeChatScheduleRuns_scheduleId_occurrence_pk` PRIMARY KEY\(`scheduleId`,`occurrence`\)/);
  });
  it("conversations.lastMessageAt is backfilled from messages, and the README says generated SQL must keep it", () => {
    expect(pending).toMatch(/UPDATE `conversations` c SET c\.`lastMessageAt` = COALESCE\(\(SELECT MAX\(m\.`createdAt`\)/);
    expect(readFileSync("drizzle/pending/README.md", "utf8")).toMatch(/lastMessageAt/);
  });
  it("the fencing-token column exists in schema and SQL with a safe default for existing rows", () => {
    expect(schema).toMatch(/fence: int\("fence"\)\.default\(0\)\.notNull\(\)/);
    expect(pending).toMatch(/ALTER TABLE `orchestrationRuns` ADD `fence` int DEFAULT 0 NOT NULL/);
  });
  it("staged migrations contain no destructive statements", () => {
    expect(pending).not.toMatch(/\b(DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM)\b/i);
  });
  it("pending directory is not journaled (so drizzle-kit migrate cannot apply hand-written SQL by accident)", () => {
    const journal = readFileSync("drizzle/meta/_journal.json", "utf8");
    expect(journal).not.toMatch(/0010_|0011_|0012_/);
  });
});
