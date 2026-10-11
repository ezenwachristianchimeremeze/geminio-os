import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Source-scan guard: a tRPC *query* is safe to re-fetch, so no query handler may call an AI-consuming function. */
const AI_CALLS = /\b(invokeLLM|meteredLLM|onceLLM|submitGatewayRequest|submitAiRequest|sendHomeMessage|streamChatCompletion)\s*\(/;
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? (f === "node_modules" ? [] : walk(p)) : /\.ts$/.test(p) ? [p] : []; });

describe("AI-consuming procedures are never queries", () => {
  it("no .query( handler calls an AI function", () => {
    const offenders: string[] = [];
    for (const file of walk("server")) {
      const src = readFileSync(file, "utf8");
      const parts = src.split(/\n\s+(?=\w+:\s*(?:protected|public|admin)Procedure)/);
      for (const p of parts.slice(1)) {
        if (/\.query\(/.test(p) && !/\.mutation\(/.test(p) && AI_CALLS.test(p)) offenders.push(`${file}: ${p.split(":")[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
  it("every legacy LLM procedure accepts an idempotency key", () => {
    for (const file of ["server/routers/features.ts", "server/routers/chat.ts", "server/routers/jobs.ts", "server/builders.ts"]) {
      const parts = readFileSync(file, "utf8").split(/\n  (?=\w+: (?:protected|public)Procedure)/).slice(1);
      for (const p of parts) if (/onceLLM\(/.test(p)) expect(`${file}:${p.split(":")[0]}:${p.includes("idempotencyKeySchema")}`).toBe(`${file}:${p.split(":")[0]}:true`);
    }
  });
  it("no direct provider/LLM call exists outside the metered wrappers and provider layer", () => {
    const allowed = new Set(["server/_core/llm.ts", "server/ai-core/providers.ts", "server/credits/metered-llm.ts"]);
    const offenders = walk("server").filter((f) => !allowed.has(f) && /\binvokeLLM\s*\(/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
  it("provider-backed helpers (image generation, transcription, data API) are not wired into any route without metering", () => {
    // They call the platform provider with the server key and are currently unreferenced. If one is ever wired up it
    // must go through runMetered/onceLLM-style metering first; add it to this allowlist only together with that change.
    const allowed = new Set<string>(["server/_core/imageGeneration.ts", "server/_core/voiceTranscription.ts", "server/_core/dataApi.ts"]);
    const offenders = walk("server").filter((f) => !allowed.has(f) && /\b(generateImage|transcribeAudio|callDataApi)\s*\(/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("stale-worker guard is wired in (source scan; the orchestrator itself needs MySQL to run)", () => {
  it("executeQueuedJob claims and finishes through compare-and-set, not unconditional status writes", () => {
    const src = readFileSync("server/ai-core/orchestrator.ts", "utf8");
    const body = src.slice(src.indexOf("export async function executeQueuedJob"), src.indexOf("function responseForStoredRun"));
    expect(body).toContain("claimForExecution(");
    expect(body).toContain("finishIfStillRunning(");
    expect(/updateOrchestrationRun\(runId, userId, \{ status: "(executing|completed|failed)"/.test(body)).toBe(false);
  });
  it("control-plane transitions are compare-and-set and ordered safely (cancel/pause/resume/retry)", () => {
    const src = readFileSync("server/ai-core/orchestrator.ts", "utf8");
    expect(/updateOrchestrationRun\(run\.id, userId, \{ status: "(cancelled|paused|accepted)"/.test(src)).toBe(false);
    const resume = src.slice(src.indexOf("export async function resumePausedRun"), src.indexOf("export async function expirePausedRuns"));
    expect(resume.indexOf('["paused"], { status: "accepted" }')).toBeGreaterThan(-1);
    expect(resume.indexOf('["paused"], { status: "accepted" }')).toBeLessThan(resume.indexOf("enqueueAiJob("));
    const retry = src.slice(src.indexOf("export async function retryAiRun"), src.indexOf("const PAUSE_MAX_HOURS"));
    expect(retry.indexOf('["failed"], { status: "accepted"')).toBeLessThan(retry.indexOf("enqueueAiJob("));
  });
  it("liveBuilder.proposeFileChange (user-authored edit) does not create an AI run or reserve credits", () => {
    const src = readFileSync("server/live-builder/service.ts", "utf8");
    const fn = src.slice(src.indexOf("export async function proposeLiveBuilderFileChange"), src.indexOf("export async function applyLiveBuilderChangeSet"));
    expect(fn).not.toContain("submitGatewayRequest");
    expect(fn).toContain("recordAiAudit");
  });
});
