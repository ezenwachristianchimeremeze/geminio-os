import { describe, expect, it } from "vitest";
import { applyChangeSet, ChangeSetError, diffAgainstManifest, normalizeWorkspacePath, planChangeSet, rejectChangeSet, restoreWorkspaceVersion, sha256, verifyWorkspaceIntegrity, type StoredFile } from "../server/live-builder/atomic-apply";
import { SqliteApplyStore } from "./helpers/sqlite-apply-store";

const U = 7, OTHER = 8, WS = "ws-1";
const h = (s: string) => sha256(s);

function setup(opts: { extraFiles?: { id: string; path: string; content: string; secret?: boolean }[] } = {}) {
  const s = new SqliteApplyStore();
  s.seedWorkspace(WS, U);
  s.seedFile(WS, { id: "f-index", path: "app/index.tsx", content: "ORIGINAL index", hash: h("ORIGINAL index") });
  s.seedFile(WS, { id: "f-util", path: "lib/util.ts", content: "ORIGINAL util", hash: h("ORIGINAL util") });
  s.seedFile(WS, { id: "f-secret", path: "config/secrets.json", kind: "config", content: null, hash: null, isSecret: true });
  for (const f of opts.extraFiles ?? []) s.seedFile(WS, { id: f.id, path: f.path, content: f.content, hash: h(f.content), isSecret: f.secret });
  s.seedVersion(WS, { id: "v1", number: 1, manifest: { files: [{ path: "app/index.tsx", kind: "page", content: "ORIGINAL index", contentHash: h("ORIGINAL index"), isSecret: false, status: "active" }, { path: "lib/util.ts", kind: "page", content: "ORIGINAL util", contentHash: h("ORIGINAL util"), isSecret: false, status: "active" }, { path: "config/secrets.json", kind: "config", content: null, contentHash: null, isSecret: true, status: "active" }] } });
  return s;
}
const mod = (path: string, content: string, base: string | null | undefined, kind = "page") => ({ path, operation: "modify", kind, content, summary: `edit ${path}`, ...(base === undefined ? {} : { baseHash: base }) });
const add = (path: string, content: string, kind = "page") => ({ path, operation: "add", kind, content, summary: `add ${path}` });
const del = (path: string, base: string | null | undefined) => ({ path, operation: "delete", kind: "page", content: null, summary: `delete ${path}`, ...(base === undefined ? {} : { baseHash: base }) });
const apply = (s: SqliteApplyStore, id: string, extra: Record<string, unknown> = {}) => applyChangeSet(s, { userId: U, workspaceId: WS, changeSetId: id, ...extra } as never);
const failure = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as ChangeSetError; } throw new Error("expected the operation to fail"); };

describe("1. successful application", () => {
  it("applies add + modify + delete in one commit and creates a version, audit and applied status", async () => {
    const s = setup();
    s.seedChange(WS, { id: "c1", sequence: 1, patches: [mod("app/index.tsx", "NEW index", h("ORIGINAL index")), add("components/Button.tsx", "export const B = 1;"), del("lib/util.ts", h("ORIGINAL util"))] });
    const r = await apply(s, "c1");
    expect(r.alreadyApplied).toBe(false);
    expect(r.filesChanged).toEqual({ added: 1, modified: 1, deleted: 1 });
    expect(r.staleCheck).toBe("verified");
    expect(r.version?.number).toBe(2);
    expect(s.activeFiles(WS).map((f) => f.path)).toEqual(["app/index.tsx", "components/Button.tsx", "config/secrets.json"]);
    expect(s.activeFiles(WS).find((f) => f.path === "app/index.tsx")?.content).toBe("NEW index");
    expect(s.changeStatus("c1")).toBe("applied");
    expect(s.versionCount(WS)).toBe(2);
  });
  it("applies a preview-document file and updates the workspace preview", async () => {
    const s = setup();
    const doc = { route: "/x", nodes: [] };
    s.seedChange(WS, { id: "c1", sequence: 1, patches: [add(".geminio/live-preview.json", JSON.stringify(doc), "manifest")] });
    const r = await apply(s, "c1");
    expect(r.preview).toEqual(doc);
    expect(JSON.parse((s.db.prepare("SELECT previewDocument p FROM workspaces").get() as { p: string }).p)).toEqual(doc);
  });
  it("revives a previously deleted path instead of violating the unique index", async () => {
    const s = setup(); s.seedFile(WS, { id: "f-old", path: "old.ts", content: "x", hash: h("x"), status: "deleted" });
    s.seedChange(WS, { id: "c1", sequence: 1, patches: [add("old.ts", "revived")] });
    await apply(s, "c1");
    expect(s.activeFiles(WS).find((f) => f.path === "old.ts")?.content).toBe("revived");
  });
});

describe("2. empty change set", () => {
  it("is rejected as permanent, marked failed, workspace untouched", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [] });
    const filesBefore = JSON.stringify(s.activeFiles(WS)); const versionsBefore = s.versionCount(WS);
    const e = await failure(apply(s, "c1"));
    expect(e.code).toBe("EMPTY");
    expect(e.permanent).toBe(true);
    expect(s.changeStatus("c1")).toBe("failed");
    expect(JSON.stringify(s.activeFiles(WS))).toBe(filesBefore);
    expect(s.versionCount(WS)).toBe(versionsBefore);
  });
});

describe("3. invalid change set", () => {
  it("rejects non-array patches, non-object entries, bad operations and bad kinds, reporting every problem", async () => {
    expect((await failure(Promise.resolve().then(() => planChangeSet("nope", { files: [] })))).code).toBe("INVALID");
    const e = await failure(Promise.resolve().then(() => planChangeSet([null, { path: "a.ts", operation: "rename", kind: "page", content: "x" }, { path: "b.ts", operation: "add", kind: "weird", content: "x" }, { path: "c.ts", operation: "add", kind: "environment", content: "x" }], { files: [] })));
    expect(e.code).toBe("INVALID");
    expect(e.problems.length).toBe(4);
  });
  it("unknown change id and another user's workspace fail without writes", async () => {
    const s = setup();
    expect((await failure(apply(s, "missing"))).code).toBe("CHANGE_NOT_FOUND");
    s.seedChange(WS, { id: "c1", sequence: 1, patches: [add("n.ts", "x")] });
    const e = await failure(applyChangeSet(s, { userId: OTHER, workspaceId: WS, changeSetId: "c1" }));
    expect(e.code).toBe("WORKSPACE_UNAVAILABLE");
    expect(s.changeStatus("c1")).toBe("awaiting_approval"); // someone else's failed attempt must not alter it
    expect(s.versionCount(WS)).toBe(1);
  });
  it("enforces approval state", async () => {
    const s = setup();
    s.seedChange(WS, { id: "gated", sequence: 1, status: "proposed", requiresApproval: true, patches: [add("n.ts", "x")] });
    s.seedChange(WS, { id: "free", sequence: 2, status: "proposed", requiresApproval: false, patches: [add("m.ts", "y")] });
    s.seedChange(WS, { id: "rej", sequence: 3, status: "rejected", patches: [add("r.ts", "z")] });
    expect((await failure(apply(s, "gated"))).code).toBe("NOT_APPLICABLE");
    expect((await failure(apply(s, "rej"))).code).toBe("NOT_APPLICABLE");
    expect((await apply(s, "free")).alreadyApplied).toBe(false);
  });
});

describe("4. path traversal and unsafe paths", () => {
  const bad = ["../x.ts", "a/../../x.ts", "a/..", "/etc/passwd", "C:\\win.ts", "a//b.ts", "./a.ts", "a/./b.ts", ".env", "app/.env.local", ".git/config", "node_modules/x/y.js", "a\u0000b", "", "a\\..\\b"];
  for (const p of bad) it(`rejects ${JSON.stringify(p)}`, () => { expect(() => normalizeWorkspacePath(p)).toThrow(); });
  it("accepts ordinary nested paths and normalises backslashes", () => {
    expect(normalizeWorkspacePath("app/(tabs)/index.tsx")).toBe("app/(tabs)/index.tsx");
    expect(normalizeWorkspacePath("lib\\a\\b.ts")).toBe("lib/a/b.ts");
    expect(normalizeWorkspacePath("my.environment.ts")).toBe("my.environment.ts");
  });
  it("a traversal attempt in a stored change set is rejected and nothing is written", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [add("ok.ts", "x"), add("../../etc/passwd", "root")] });
    const e = await failure(apply(s, "c1"));
    expect(e.code).toBe("UNSAFE_PATH");
    expect(s.activeFiles(WS).some((f) => f.path === "ok.ts")).toBe(false);
    expect(s.writes).toBe(0);
  });
});

describe("5. invalid file content", () => {
  it("rejects NUL bytes, oversize files, raw credentials, missing content and invalid preview JSON", () => {
    const files: StoredFile[] = [];
    const p = (patch: unknown) => planChangeSet([patch], { files });
    expect(() => p(add("a.ts", "x\u0000y"))).toThrow("failed validation");
    expect(() => p(add("a.ts", "x".repeat(250_001)))).toThrow("failed validation");
    expect(() => p(add("a.ts", 'const apiKey = "sk-live-0123456789";'))).toThrow("failed validation");
    expect(() => p({ path: "a.ts", operation: "add", kind: "page", content: null })).toThrow("failed validation");
    expect(() => p(add(".geminio/live-preview.json", "{not json"))).toThrow("failed validation");
    expect(() => planChangeSet(Array.from({ length: 10 }, (_, i) => add(`f${i}.ts`, "x".repeat(240_000))), { files })).toThrow("failed validation"); // total bytes
    expect(() => planChangeSet(Array.from({ length: 201 }, (_, i) => add(`f${i}.ts`, "x")), { files })).toThrow("at most 200");
  });
  it("a preview file with invalid JSON no longer corrupts the workspace halfway (previous behaviour parsed it mid-loop)", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [mod("app/index.tsx", "CHANGED", h("ORIGINAL index")), add(".geminio/live-preview.json", "{bad", "manifest")] });
    const e = await failure(apply(s, "c1"));
    expect(e.code).toBe("INVALID");
    expect(s.activeFiles(WS).find((f) => f.path === "app/index.tsx")?.content).toBe("ORIGINAL index");
  });
});

describe("6. validation failures against current state", () => {
  it("rejects add-over-existing, modify/delete-missing, secret files and case-only collisions, then marks the change failed", async () => {
    const s = setup();
    const ctxFiles = (): StoredFile[] => [{ id: "i", path: "app/index.tsx", kind: "page", content: "a", contentHash: h("a"), isSecret: false, status: "active" }, { id: "s", path: "sec.json", kind: "config", content: null, contentHash: null, isSecret: true, status: "active" }];
    const probs = (patch: unknown) => { try { planChangeSet([patch], { files: ctxFiles() }); return []; } catch (e) { return (e as ChangeSetError).problems; } };
    expect(probs(add("app/index.tsx", "x"))[0]).toContain("already exists");
    expect(probs(mod("nope.ts", "x", undefined))[0]).toContain("does not exist");
    expect(probs(del("nope.ts", undefined))[0]).toContain("does not exist");
    expect(probs(mod("sec.json", "x", undefined, "config"))[0]).toContain("secret file");
    expect(probs(add("App/Index.tsx", "x"))[0]).toContain("differs only by letter case");
    s.seedChange(WS, { id: "c1", sequence: 1, patches: [add("fine.ts", "ok"), add("app/index.tsx", "dup")] });
    const e = await failure(apply(s, "c1"));
    expect(["STALE", "INVALID"]).toContain(e.code);
    expect(s.changeStatus("c1")).toBe("failed");
    expect(s.activeFiles(WS).some((f) => f.path === "fine.ts")).toBe(false);
  });
  it("reports duplicate paths within one change set (case-insensitively)", () => {
    expect(() => planChangeSet([add("a.ts", "1"), add("A.ts", "2")], { files: [] })).toThrow("failed validation");
  });
});

describe("7. failure before mutation performs zero writes", () => {
  it("validation failure, wrong owner, wrong state and missing change all leave writes = 0 and the database byte-identical", async () => {
    const s = setup(); s.seedChange(WS, { id: "bad", sequence: 1, patches: [add("a.ts", "ok"), add("../b", "x")] }); s.seedChange(WS, { id: "gated", sequence: 2, status: "proposed", patches: [add("g.ts", "x")] });
    const before = s.snapshot();
    for (const run of [() => apply(s, "bad"), () => apply(s, "gated"), () => apply(s, "none"), () => applyChangeSet(s, { userId: OTHER, workspaceId: WS, changeSetId: "bad" })]) {
      const e = await failure(run()); expect(e).toBeInstanceOf(ChangeSetError); expect(s.writes).toBe(0);
    }
    // only the permanent-failure status flip of "bad" differs, and only that
    const after = JSON.parse(s.snapshot()); const was = JSON.parse(before);
    expect(after.files).toEqual(was.files); expect(after.versions).toEqual(was.versions); expect(after.workspaces).toEqual(was.workspaces);
  });
});

describe("8 + 9. failure during a multi-file mutation rolls everything back", () => {
  for (const n of [1, 2, 3, 4, 5, 6]) {
    it(`injected failure on write #${n} leaves the workspace exactly as before`, async () => {
      const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [mod("app/index.tsx", "NEW", h("ORIGINAL index")), add("a/new1.ts", "1"), add("a/new2.ts", "2"), del("lib/util.ts", h("ORIGINAL util"))] });
      const before = s.snapshot();
      s.failOnWrite = n;
      const e = await failure(apply(s, "c1"));
      expect(e.message).toContain("injected failure");
      s.failOnWrite = null;
      expect(s.snapshot()).toBe(before); // files, change status, versions, preview: identical (real SQLite ROLLBACK)
      expect(s.audit("live_builder.change_set.applied")).toHaveLength(0); // success audit rolled back too
      expect(s.audit("live_builder.change_set.apply_failed")).toHaveLength(1); // failure audit survives (written after rollback)
      expect(s.changeStatus("c1")).toBe("awaiting_approval"); // transient failure: change preserved and retryable
    });
  }
  it("after a transient failure the same change set can be retried and succeeds exactly once", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [mod("app/index.tsx", "NEW", h("ORIGINAL index")), add("a/new1.ts", "1")] });
    s.failOnWrite = 2; await failure(apply(s, "c1")); s.failOnWrite = null;
    const r = await apply(s, "c1");
    expect(r.alreadyApplied).toBe(false); expect(s.versionCount(WS)).toBe(2); expect(s.audit("live_builder.change_set.applied")).toHaveLength(1);
  });
  it("transaction mechanism itself: a real constraint violation mid-transaction rolls back earlier inserts", async () => {
    const s = setup();
    const e = await s.transaction(async (tx) => {
      await tx.insertFile(WS, { id: "x1", path: "Same.ts", kind: "page", content: "1", contentHash: h("1"), isSecret: false, status: "active" });
      await tx.insertFile(WS, { id: "x2", path: "same.TS", kind: "page", content: "2", contentHash: h("2"), isSecret: false, status: "active" }); // case-insensitive unique index violation
    }).catch((err: Error) => err);
    expect((e as Error).message).toMatch(/UNIQUE|constraint/i);
    expect(s.activeFiles(WS).some((f) => f.path.toLowerCase() === "same.ts")).toBe(false);
  });
});

describe("10. concurrent application", () => {
  it("two simultaneous applies of the same change set: exactly one writes, the other gets the original result", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [mod("app/index.tsx", "NEW", h("ORIGINAL index")), add("n.ts", "1")] });
    const [a, b] = await Promise.all([apply(s, "c1"), apply(s, "c1")]);
    expect([a.alreadyApplied, b.alreadyApplied].sort()).toEqual([false, true]);
    expect(a.version?.id).toBe(b.version?.id);
    expect(s.versionCount(WS)).toBe(2);
    expect(s.audit("live_builder.change_set.applied")).toHaveLength(1);
  });
  it("two different change sets proposed from the same base: the first wins, the second is stale and changes nothing", async () => {
    const s = setup();
    s.seedChange(WS, { id: "c1", sequence: 1, patches: [mod("app/index.tsx", "FIRST", h("ORIGINAL index"))] });
    s.seedChange(WS, { id: "c2", sequence: 2, patches: [mod("app/index.tsx", "SECOND", h("ORIGINAL index"))] });
    const results = await Promise.allSettled([apply(s, "c1"), apply(s, "c2")]);
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
    expect((results[1] as PromiseRejectedResult).reason.code).toBe("STALE");
    expect(s.activeFiles(WS).find((f) => f.path === "app/index.tsx")?.content).toBe("FIRST");
    expect(s.changeStatus("c2")).toBe("failed");
    expect(s.versionCount(WS)).toBe(2);
  });
  it("20 racing applies of one change set produce exactly one version", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [add("n.ts", "1")] });
    const rs = await Promise.all(Array.from({ length: 20 }, () => apply(s, "c1")));
    expect(rs.filter((r) => !r.alreadyApplied)).toHaveLength(1);
    expect(s.versionCount(WS)).toBe(2);
  });
  it("apply racing a reject: exactly one outcome and the workspace is consistent with it", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [add("n.ts", "1")] });
    const [a, r] = await Promise.allSettled([apply(s, "c1"), rejectChangeSet(s, { userId: U, workspaceId: WS, changeSetId: "c1" })]);
    const applied = s.changeStatus("c1") === "applied";
    expect(a.status === "fulfilled").toBe(applied);
    expect(r.status === "fulfilled").toBe(!applied);
    expect(s.activeFiles(WS).some((f) => f.path === "n.ts")).toBe(applied);
  });
});

describe("10b. compare-and-set is the second line of defence when the lock is not enough", () => {
  it("if the change set leaves the appliable state after it was read, the apply aborts as CONFLICT and rolls everything back", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [add("a.ts", "1"), add("b.ts", "2")] });
    const before = s.snapshot();
    // simulate another writer that bypasses the workspace lock (e.g. a code path that forgot to take it)
    s.afterWrite = (n) => { if (n === 2) s.db.prepare("UPDATE changes SET status='rejected' WHERE id='c1'").run(); };
    const e = await failure(apply(s, "c1"));
    s.afterWrite = null;
    expect(e.code).toBe("CONFLICT");
    expect(s.snapshot()).toBe(before.replace('"status":"awaiting_approval"', '"status":"awaiting_approval"')); // the rejected flip was inside the rolled-back transaction
    expect(s.activeFiles(WS).some((f) => f.path === "a.ts")).toBe(false);
    expect(s.versionCount(WS)).toBe(1);
  });
});

describe("11. stale version", () => {
  it("rejects a modify whose base hash no longer matches, writes nothing, marks the change failed", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [mod("app/index.tsx", "X", h("SOMETHING ELSE")), add("n.ts", "1")] });
    const e = await failure(apply(s, "c1"));
    expect(e.code).toBe("STALE"); expect(e.permanent).toBe(true);
    expect(s.changeStatus("c1")).toBe("failed");
    expect(s.activeFiles(WS).some((f) => f.path === "n.ts")).toBe(false);
    expect(s.writes).toBe(0);
  });
  it("legacy patches without a base hash still apply but are reported as only partially stale-checked", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [mod("app/index.tsx", "X", undefined)] });
    expect((await apply(s, "c1")).staleCheck).toBe("partial");
  });
  it("a delete of a file changed since the proposal is stale", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [del("lib/util.ts", h("old"))] });
    expect((await failure(apply(s, "c1"))).code).toBe("STALE");
  });
});

describe("12. already-applied change set", () => {
  it("is idempotent: same version returned, no new version, no new audit event, no file writes", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [add("n.ts", "1")] });
    const first = await apply(s, "c1");
    const snap = s.snapshot(); const auditCount = s.audit().length;
    const again = await apply(s, "c1");
    expect(again.alreadyApplied).toBe(true); expect(again.version?.id).toBe(first.version?.id);
    expect(s.writes).toBe(0); expect(s.snapshot()).toBe(snap); expect(s.audit()).toHaveLength(auditCount);
  });
});

describe("13. cancellation", () => {
  it("a rejected change can no longer be applied; rejecting twice is idempotent", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [add("n.ts", "1")] });
    expect((await rejectChangeSet(s, { userId: U, workspaceId: WS, changeSetId: "c1" })).alreadyRejected).toBe(false);
    expect((await rejectChangeSet(s, { userId: U, workspaceId: WS, changeSetId: "c1" })).alreadyRejected).toBe(true);
    expect((await failure(apply(s, "c1"))).code).toBe("NOT_APPLICABLE");
    expect(s.activeFiles(WS).some((f) => f.path === "n.ts")).toBe(false);
    expect(s.audit("live_builder.change_set.rejected")).toHaveLength(1);
  });
  it("rejecting an applied change is a conflict (use restore)", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [add("n.ts", "1")] }); await apply(s, "c1");
    expect((await failure(rejectChangeSet(s, { userId: U, workspaceId: WS, changeSetId: "c1" }))).code).toBe("CONFLICT");
  });
  it("only the owner can reject", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [add("n.ts", "1")] });
    expect((await failure(rejectChangeSet(s, { userId: OTHER, workspaceId: WS, changeSetId: "c1" }))).code).toBe("WORKSPACE_UNAVAILABLE");
    expect(s.changeStatus("c1")).toBe("awaiting_approval");
  });
  it("an AbortSignal fired already aborted stops before any write", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [add("n.ts", "1")] }); const before = s.snapshot();
    const ac = new AbortController(); ac.abort();
    const e = await failure(apply(s, "c1", { signal: ac.signal }));
    expect(e.code).toBe("CANCELLED"); expect(s.writes).toBe(0); expect(s.snapshot()).toBe(before);
  });
  it("an AbortSignal fired mid-apply (after some writes) rolls everything back", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [mod("app/index.tsx", "NEW", h("ORIGINAL index")), add("a.ts", "1"), add("b.ts", "2")] });
    const before = s.snapshot(); const ac = new AbortController();
    s.afterWrite = (n) => { if (n === 2) ac.abort(); };
    const e = await failure(apply(s, "c1", { signal: ac.signal }));
    s.afterWrite = null;
    expect(e.code).toBe("CANCELLED"); expect(s.snapshot()).toBe(before);
    expect(s.audit("live_builder.change_set.apply_failed")[0].status).toBe("warning");
  });
});

describe("14. recovery after an interrupted operation", () => {
  it("a crash mid-transaction leaves no partial state (the database rolled back); integrity check agrees", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [mod("app/index.tsx", "NEW", h("ORIGINAL index")), add("a.ts", "1")] });
    s.afterWrite = (n) => { if (n === 2) throw new Error("process killed"); };
    await failure(apply(s, "c1")); s.afterWrite = null;
    const report = await verifyWorkspaceIntegrity(s, { userId: U, workspaceId: WS, appliedChangeIds: [] });
    expect(report.consistent).toBe(true); expect(report.drift).toEqual([]);
  });
  it("drift left by a PRE-atomic partial failure is detected and repaired by restoring the latest version", async () => {
    const s = setup();
    // simulate the old bug: a change set marked applied, file overwritten, extra file created, but no version row
    s.db.prepare("UPDATE files SET content='HALF', contentHash=? WHERE id='f-index'").run(h("HALF"));
    s.seedFile(WS, { id: "f-stray", path: "stray.ts", content: "s", hash: h("s") });
    s.seedChange(WS, { id: "cx", sequence: 1, status: "applied", patches: [mod("app/index.tsx", "HALF", undefined)] });
    const report = await verifyWorkspaceIntegrity(s, { userId: U, workspaceId: WS, appliedChangeIds: ["cx"] });
    expect(report.consistent).toBe(false);
    expect(report.appliedWithoutVersion).toEqual(["cx"]);
    expect(report.drift.map((d) => `${d.path}:${d.reason}`)).toEqual(["app/index.tsx:content_differs", "stray.ts:unexpected"]);
    const fixed = await restoreWorkspaceVersion(s, { userId: U, workspaceId: WS, reason: "Recovered to latest version" });
    expect(fixed.removed).toBe(1);
    const after = await verifyWorkspaceIntegrity(s, { userId: U, workspaceId: WS, appliedChangeIds: [] });
    expect(after.consistent).toBe(true);
    expect(s.activeFiles(WS).find((f) => f.path === "app/index.tsx")?.content).toBe("ORIGINAL index");
    expect(s.audit("live_builder.version.restored")).toHaveLength(1);
  });
  it("restore is atomic too: a failure midway leaves the workspace unchanged", async () => {
    const s = setup(); s.seedFile(WS, { id: "f-stray", path: "stray.ts", content: "s", hash: h("s") });
    const before = s.snapshot(); s.failOnWrite = 2;
    await failure(restoreWorkspaceVersion(s, { userId: U, workspaceId: WS, versionId: "v1" })); s.failOnWrite = null;
    expect(s.snapshot()).toBe(before);
    expect(s.audit("live_builder.version.restore_failed")).toHaveLength(1);
  });
  it("restoring an unknown version or another user's workspace fails", async () => {
    const s = setup();
    expect((await failure(restoreWorkspaceVersion(s, { userId: U, workspaceId: WS, versionId: "nope" }))).code).toBe("CHANGE_NOT_FOUND");
    expect((await failure(restoreWorkspaceVersion(s, { userId: OTHER, workspaceId: WS, versionId: "v1" }))).code).toBe("WORKSPACE_UNAVAILABLE");
  });
  it("diffAgainstManifest ignores secret file contents and reports kind changes", () => {
    const cur: StoredFile[] = [{ id: "1", path: "a", kind: "api", content: "x", contentHash: h("x"), isSecret: false, status: "active" }, { id: "2", path: "s", kind: "config", content: null, contentHash: null, isSecret: true, status: "active" }];
    const manifest = { files: [{ path: "a", kind: "page", content: "x", contentHash: h("x"), isSecret: false, status: "active" }, { path: "s", kind: "config", content: null, contentHash: "irrelevant", isSecret: true, status: "active" }] };
    expect(diffAgainstManifest(cur, manifest)).toEqual([{ path: "a", reason: "kind_differs" }]);
  });
});

describe("15. audit events", () => {
  it("success writes one audit event atomically with the commit, carrying counts and the version", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [add("n.ts", "1")] });
    const r = await apply(s, "c1");
    const ev = s.audit("live_builder.change_set.applied");
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ resource: "c1", status: "success" });
    expect(ev[0].details.versionNumber).toBe(r.version?.number);
    expect(ev[0].details.added).toBe(1);
  });
  it("permanent failure records the problems; the change set row and its patches are preserved", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [add("../x", "1")] });
    await failure(apply(s, "c1"));
    const ev = s.audit("live_builder.change_set.apply_failed");
    expect(ev).toHaveLength(1);
    expect(ev[0].status).toBe("error");
    expect(ev[0].details.workspaceModified).toBe(false);
    expect(ev[0].details.permanent).toBe(true);
    expect(JSON.stringify(ev[0].details.problems)).toContain("traversal");
    expect((s.db.prepare("SELECT patches p FROM changes WHERE id='c1'").get() as { p: string }).p).toContain("../x");
  });
  it("reject writes an audit event", async () => {
    const s = setup(); s.seedChange(WS, { id: "c1", sequence: 1, patches: [add("n.ts", "1")] });
    await rejectChangeSet(s, { userId: U, workspaceId: WS, changeSetId: "c1" });
    expect(s.audit("live_builder.change_set.rejected")[0].details.previousStatus).toBe("awaiting_approval");
  });
});

import { changeSetErrorCode } from "../server/live-builder/atomic-apply";
describe("API error mapping", () => {
  it("never reveals another tenant's workspace, maps conflicts/stale/precondition/cancel distinctly", () => {
    const e = (code: ChangeSetError["code"]) => new ChangeSetError(code, "x");
    expect(changeSetErrorCode(e("WORKSPACE_UNAVAILABLE"))).toBe("NOT_FOUND");
    expect(changeSetErrorCode(e("CHANGE_NOT_FOUND"))).toBe("NOT_FOUND");
    expect(changeSetErrorCode(e("STALE"))).toBe("CONFLICT");
    expect(changeSetErrorCode(e("CONFLICT"))).toBe("CONFLICT");
    expect(changeSetErrorCode(e("NOT_APPLICABLE"))).toBe("PRECONDITION_FAILED");
    expect(changeSetErrorCode(e("CANCELLED"))).toBe("CLIENT_CLOSED_REQUEST");
    for (const c of ["EMPTY", "INVALID", "UNSAFE_PATH", "INVALID_CONTENT", "LIMIT_EXCEEDED"] as const) expect(changeSetErrorCode(e(c))).toBe("BAD_REQUEST");
    expect(changeSetErrorCode(new Error("db down"))).toBe("INTERNAL_SERVER_ERROR");
  });
});
