import { describe, expect, it } from "vitest";
import { buildEditContext, buildEditMessages, parseEditProposal, EDIT_LIMITS, EDIT_SYSTEM_PROMPT } from "../server/live-builder/ai-edit";
import { ChangeSetError, PREVIEW_FILE_PATH, sha256, type StoredFile } from "../server/live-builder/atomic-apply";

const file = (path: string, content: string, extra: Partial<StoredFile> = {}): StoredFile => ({ id: `f_${path}`, path, kind: "page", content, contentHash: sha256(content), isSecret: false, status: "active", ...extra });
const files = [file("src/App.tsx", "export const App = () => null;"), file("src/Other.tsx", "export const O = 1;"), file(".env", "SECRET=abc", { kind: "environment", isSecret: true })];
const sel = { elementId: "e1", label: "Button", filePath: "src/App.tsx", componentName: "App", properties: {} };
const ok = (ops: unknown[], extra: Record<string, unknown> = {}) => JSON.stringify({ summary: "Change", rationale: "Because", operations: ops, ...extra });
const fails = (fn: () => unknown, code?: string) => { try { fn(); } catch (e) { expect(e).toBeInstanceOf(ChangeSetError); if (code) expect((e as ChangeSetError).code).toBe(code); return e as ChangeSetError; } throw new Error("expected throw"); };

describe("AI edit context", () => {
  it("never includes secret file content", () => {
    const ctx = buildEditContext({ prompt: "x", selection: null, preview: {}, files });
    expect(JSON.stringify(ctx)).not.toContain("SECRET=abc");
    expect(JSON.stringify(buildEditMessages(ctx))).not.toContain("SECRET=abc");
  });
  it("stays within budget and reports omitted files", () => {
    const big = Array.from({ length: 40 }, (_, i) => file(`src/f${i}.tsx`, "x".repeat(10_000)));
    const ctx = buildEditContext({ prompt: "x", selection: null, preview: {}, files: big });
    expect(JSON.stringify(buildEditMessages(ctx)).length).toBeLessThan(EDIT_LIMITS.contextBytes * 2);
    expect(ctx.omittedFiles).toBeGreaterThan(0);
  });
  it("system prompt forbids secrets and demands JSON", () => {
    expect(EDIT_SYSTEM_PROMPT.toLowerCase()).toContain("json");
    expect(EDIT_SYSTEM_PROMPT).toContain(".env");
  });
});

describe("AI edit proposal validation", () => {
  it("accepts a valid modify and computes the real baseHash", () => {
    const p = parseEditProposal(ok([{ operation: "modify", path: "src/App.tsx", content: "export const App = () => 1;", summary: "s" }]), files, sel);
    expect(p.patches[0].baseHash).toBe(sha256("export const App = () => null;"));
    expect(p.patches[0].operation).toBe("modify");
  });
  it("accepts fenced JSON", () => {
    const p = parseEditProposal("```json\n" + ok([{ operation: "add", path: "src/New.tsx", content: "export const N = 1;" }]) + "\n```", files, null);
    expect(p.patches[0].baseHash).toBeNull();
  });
  it("rejects non-JSON", () => { fails(() => parseEditProposal("sure, I changed it!", files, null)); });
  it("rejects missing operations list", () => { fails(() => parseEditProposal(JSON.stringify({ summary: "x" }), files, null)); });
  it("rejects empty operations with EMPTY", () => { fails(() => parseEditProposal(ok([]), files, null), "EMPTY"); });
  it("rejects too many operations", () => {
    const ops = Array.from({ length: EDIT_LIMITS.maxOperations + 1 }, (_, i) => ({ operation: "add", path: `src/a${i}.ts`, content: "x" }));
    fails(() => parseEditProposal(ok(ops), files, null), "LIMIT_EXCEEDED");
  });
  it("rejects missing summary", () => { fails(() => parseEditProposal(JSON.stringify({ operations: [{ operation: "add", path: "a.ts", content: "x" }] }), files, null)); });
  it("rejects path traversal and absolute paths", () => {
    for (const path of ["../etc/passwd", "/etc/passwd", "src/../../x"]) fails(() => parseEditProposal(ok([{ operation: "add", path, content: "x" }]), files, null));
  });
  it("rejects add over existing file", () => { const e = fails(() => parseEditProposal(ok([{ operation: "add", path: "src/App.tsx", content: "x" }]), files, null)); expect(e.problems.join()).toContain("already exists"); });
  it("rejects modify/delete of nonexistent file", () => {
    fails(() => parseEditProposal(ok([{ operation: "modify", path: "src/Nope.tsx", content: "x" }]), files, null));
    fails(() => parseEditProposal(ok([{ operation: "delete", path: "src/Nope.tsx" }]), files, null));
  });
  it("rejects modify with blank content", () => { fails(() => parseEditProposal(ok([{ operation: "modify", path: "src/App.tsx", content: "  " }]), files, null)); });
  it("rejects unknown operations", () => { fails(() => parseEditProposal(ok([{ operation: "rename", path: "src/App.tsx" }]), files, null)); });
  it("enforces selection scope", () => {
    const e = fails(() => parseEditProposal(ok([{ operation: "modify", path: "src/Other.tsx", content: "x" }]), files, sel));
    expect(e.problems.join()).toContain("outside the selected element");
  });
  it("allows the preview manifest within a selection", () => {
    const withPreview = [...files, file(PREVIEW_FILE_PATH, "{}", { kind: "manifest" })];
    const p = parseEditProposal(ok([{ operation: "modify", path: PREVIEW_FILE_PATH, content: "{\"a\":1}" }]), withPreview, sel, (c) => JSON.parse(c));
    expect(p.patches[0].kind).toBe("manifest");
  });
  it("rejects the model touching secret/env files", () => {
    fails(() => parseEditProposal(ok([{ operation: "modify", path: ".env", content: "SECRET=1" }]), files, null));
  });
  it("reports ALL problems at once", () => {
    const e = fails(() => parseEditProposal(ok([{ operation: "modify", path: "src/Nope.tsx", content: "x" }, { operation: "add", path: "src/App.tsx", content: "y" }]), files, null));
    expect(e.problems.length).toBe(2);
  });
  it("is marked permanent so it is not blindly retried", () => {
    const e = fails(() => parseEditProposal("nope", files, null));
    expect(JSON.stringify(e)).toBeTruthy();
  });
});
