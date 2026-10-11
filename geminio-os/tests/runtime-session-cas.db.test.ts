/** SQLite STAND-IN (not MySQL). Mirrors updateSession(..., ["starting"]) in server/live-builder/runtime.ts: a slow runner start must not overwrite a session that was stopped meanwhile. */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DatabaseSync } from "./helpers/sqlite";

const open = () => { const f = join(mkdtempSync(join(tmpdir(), "rt-")), "db.sqlite"); const a = new DatabaseSync(f); a.exec("CREATE TABLE s (id TEXT PRIMARY KEY, status TEXT NOT NULL, url TEXT)"); a.prepare("INSERT INTO s VALUES ('s1','starting',NULL)").run(); return { a, b: new DatabaseSync(f) }; };
const finishStart = (db: DatabaseSync, status: string) => Number(db.prepare("UPDATE s SET status=?, url='http://preview' WHERE id='s1' AND status IN ('starting')").run(status).changes);
const stop = (db: DatabaseSync) => Number(db.prepare("UPDATE s SET status='stopped' WHERE id='s1'").run().changes);
const row = (db: DatabaseSync) => db.prepare("SELECT * FROM s WHERE id='s1'").get() as { status: string; url: string | null };

describe("runtime start vs stop (SQLite stand-in)", () => {
  it("a start that finishes first is ready; a later stop then stops it", () => {
    const { a, b } = open();
    expect(finishStart(a, "ready")).toBe(1); expect(stop(b)).toBe(1); expect(row(a).status).toBe("stopped");
  });
  it("a stop that lands while the runner is still starting is NOT overwritten by the late 'ready'", () => {
    const { a, b } = open();
    expect(stop(b)).toBe(1);
    expect(finishStart(a, "ready")).toBe(0);
    expect(row(a)).toEqual({ id: "s1", status: "stopped", url: null });
  });
  it("production code uses the compare-and-set and discards a superseded start (static check)", () => {
    const src = readFileSync(new URL("../server/live-builder/runtime.ts", import.meta.url), "utf8");
    expect(src).toContain('}, ["starting"]);');
    expect(src).toContain("start_superseded");
    expect(src).toMatch(/inArray\(liveBuilderRuntimeSessions\.status, onlyIfStatus\)/);
  });
});
