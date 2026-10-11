import { describe, expect, it } from "vitest";
import { assertAdvance, canAdvance, stageProgress, stageRequiresApproval, STAGES } from "../server/ai-builder/stages";
import { buildGeneratedPatches, stripCodeFences, inferKind } from "../server/ai-builder/generated-files";
import { FILE_KINDS, planChangeSet, sha256, type StoredFile } from "../server/live-builder/atomic-apply";
import { analyzeWorkspace } from "../server/ai-builder/workspace-analyzer";
import { AiBuilderLlmUnavailableError, parseModelJson, setAiBuilderLlm } from "../lib/ai-builder/llm-port";
import { RequirementsGatheringEngine } from "../lib/ai-builder/requirements-engine";
import { ProjectMemory } from "../lib/ai-builder/project-memory";

describe("AI Builder stages", () => {
  it("allows the documented forward path and rejects skipping", () => {
    expect(canAdvance("prompt", "requirements")).toBe(true);
    expect(canAdvance("plan", "deploy")).toBe(false);
    expect(() => assertAdvance("prompt", "code")).toThrow("Invalid AI Builder transition");
  });
  it("supports the debug/rebuild loop and gates deploy", () => {
    expect(canAdvance("test", "debug")).toBe(true);
    expect(canAdvance("debug", "rebuild")).toBe(true);
    expect(canAdvance("validate", "deploy")).toBe(true);
    expect(stageRequiresApproval("deploy")).toBe(true);
    expect(stageRequiresApproval("code")).toBe(false);
  });
  it("progress spans 0..100", () => {
    expect(stageProgress(STAGES[0])).toBe(0);
    expect(stageProgress("deploy")).toBe(100);
  });
});

describe("generated file preparation (uses the real atomic-apply validator)", () => {
  const stored = (path: string, content: string): StoredFile => ({ id: `f_${path}`, path, kind: "page", content, contentHash: sha256(content), isSecret: false, status: "active" });
  it("rejects traversal, env files and raw credentials with the shared policy", () => {
    expect(() => buildGeneratedPatches([{ path: "../x.ts", content: "x" }], [])).toThrow("Path traversal");
    expect(() => buildGeneratedPatches([{ path: "/etc/passwd", content: "x" }], [])).toThrow("Absolute paths");
    expect(() => buildGeneratedPatches([{ path: "C:\\x.ts", content: "x" }], [])).toThrow("Absolute paths");
    expect(() => buildGeneratedPatches([{ path: "app/.env.local", content: "x" }], [])).toThrow("Environment files");
    expect(() => buildGeneratedPatches([{ path: "node_modules/a/b.js", content: "x" }], [])).toThrow("not allowed");
    expect(() => buildGeneratedPatches([{ path: "a.ts", content: 'const apiKey = "sk-live-12345678901";' }], [])).toThrow("failed validation");
  });
  it("uses add/modify (the Live Builder vocabulary), valid kinds, and base hashes for stale detection", () => {
    const out = buildGeneratedPatches(
      [{ path: "app/index.tsx", content: "```tsx\nexport default 1;\n```" }, { path: "server/api/users.ts", content: "export {}" }],
      [stored("app/index.tsx", "old")],
    );
    expect(out[0].operation).toBe("modify");
    expect(out[0].content).toBe("export default 1;");
    expect(out[0].baseHash).toBe(sha256("old"));
    expect(out[1].operation).toBe("add");
    expect(out[1].baseHash).toBeNull();
    expect(out[1].kind).toBe("api");
    for (const p of out) expect(FILE_KINDS.includes(p.kind)).toBe(true);
    expect(inferKind("components/Card.tsx")).toBe("component");
    expect(inferKind("package.json")).toBe("config");
    expect(inferKind("drizzle/0001.sql")).toBe("database");
    expect(inferKind("assets/logo.png")).toBe("asset");
    expect(stripCodeFences("plain")).toBe("plain");
  });
  it("output is accepted by the real apply planner (round-trip), not just by this module", () => {
    const patches = buildGeneratedPatches([{ path: "app/new.tsx", content: "export default 2;" }], [stored("app/index.tsx", "x")]);
    const plan = planChangeSet(patches, { files: [stored("app/index.tsx", "x")] });
    expect(plan.ops.length).toBe(1);
    expect(plan.ops[0].op).toBe("add");
  });
  it("rejects empty, duplicate, oversized and wrongly-typed output", () => {
    expect(() => buildGeneratedPatches([], [])).toThrow("no files");
    expect(() => buildGeneratedPatches([{ path: "a.ts", content: " " }], [])).toThrow("empty file");
    expect(() => buildGeneratedPatches([{ path: "a.ts", content: "x" }, { path: "./a.ts", content: "y" }], [])).toThrow();
    expect(() => buildGeneratedPatches([{ path: "a.ts", content: "x".repeat(250_001) }], [])).toThrow("failed validation");
    expect(() => buildGeneratedPatches([{ path: 5 as never, content: "x" }], [])).toThrow("string path");
  });
});

describe("workspace analysis", () => {
  it("analyses workspace files, not the host filesystem", () => {
    const a = analyzeWorkspace([
      { path: "package.json", content: JSON.stringify({ dependencies: { react: "1", expo: "1" } }) },
      { path: "app/index.tsx", content: "export default function A(){ return (1) } // TODO" },
      { path: "server/index.ts", content: "app.get('/health', h); app.post(\"/users\", h);" },
      { path: "bad.json", content: "{nope" },
      { path: "broken.ts", content: "function a( {" },
      { path: "secrets.txt", content: 'password = "hunter2hunter2"', isSecret: true },
    ]);
    expect(a.fileCount).toBe(6);
    expect(a.dependencies).toEqual(["expo", "react"]);
    expect(a.routes).toEqual(["GET /health", "POST /users"]);
    expect(a.screens).toEqual(["app/index.tsx"]);
    expect(a.hasTests).toBe(false);
    const msgs = a.findings.map((f) => f.message).join("|");
    expect(msgs).toContain("Invalid JSON");
    expect(msgs).toContain("Unbalanced brackets");
    expect(msgs).toContain("TODO");
    expect(msgs).toContain("no test files");
    expect(msgs).not.toContain("credential"); // secret files are never read
  });
});

describe("LLM port + requirements engine", () => {
  it("fails loudly with no provider registered (no fabricated empty result)", async () => {
    setAiBuilderLlm(null);
    const eng = new RequirementsGatheringEngine(new ProjectMemory("p" as never), { id: "p" } as never);
    await expect(eng.extractRequirements("x")).rejects.toThrow("No AI provider");
    expect(new AiBuilderLlmUnavailableError().retryable).toBe(false);
  });
  it("parses fenced JSON and rejects prose", async () => {
    setAiBuilderLlm(async () => ({ text: '```json\n[{"id":"REQ-1"}]\n```' }));
    const eng = new RequirementsGatheringEngine(new ProjectMemory("p" as never), { id: "p" } as never);
    expect(await eng.extractRequirements("x")).toEqual([{ id: "REQ-1" }]);
    expect(() => parseModelJson("here you go")).toThrow("not valid JSON");
    setAiBuilderLlm(null);
  });
});
