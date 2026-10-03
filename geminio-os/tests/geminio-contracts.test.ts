import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  agentTaskSchema,
  apiEnvelopeSchema,
  applyCreditDelta,
  canTransitionTask,
  requiresExplicitApproval,
  transitionTask,
} from "../shared/geminio-contracts";

describe("Geminio autonomous contracts", () => {
  const task = agentTaskSchema.parse({
    id: "task_1",
    ownerId: 7,
    projectId: null,
    title: "Build a mobile app",
    state: "queued",
    progress: 0,
    requiresApproval: false,
    currentApprovalId: null,
    lastError: null,
    checkpoint: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });

  it("allows only declared task transitions", () => {
    expect(canTransitionTask("queued", "planning")).toBe(true);
    expect(canTransitionTask("queued", "completed")).toBe(false);
    expect(() => transitionTask(task, "completed")).toThrow("Invalid task transition");
  });

  it("preserves a typed task checkpoint while transitioning", () => {
    const planning = transitionTask(task, "planning", { progress: 10, checkpoint: "requirements-reviewed" });
    expect(planning.state).toBe("planning");
    expect(planning.progress).toBe(10);
    expect(planning.checkpoint).toBe("requirements-reviewed");
    expect(planning.updatedAt.getTime()).toBeGreaterThanOrEqual(task.updatedAt.getTime());
  });

  it("prevents credit balances from becoming negative", () => {
    expect(applyCreditDelta(12, -4.5)).toBe(7.5);
    expect(() => applyCreditDelta(2, -2.1)).toThrow("Insufficient credits");
  });

  it("marks sensitive actions as approval-gated", () => {
    expect(requiresExplicitApproval("deploy_production")).toBe(true);
    expect(requiresExplicitApproval("send_money")).toBe(true);
  });

  it("validates the success and error API envelopes", () => {
    expect(apiEnvelopeSchema.parse({ ok: true, requestId: "req_1", data: { state: "queued" } }).ok).toBe(true);
    expect(apiEnvelopeSchema.parse({ ok: false, requestId: "req_2", error: { code: "RATE_LIMITED", message: "Try again", requestId: "req_2", retryable: true } }).ok).toBe(false);
    expect(() => apiEnvelopeSchema.parse({ ok: "yes" })).toThrow(z.ZodError);
  });
});


describe("streaming and upload contracts", () => {
  it("accepts bounded AI stream events", async () => {
    const { parseAiStreamEvent } = await import("../shared/geminio-contracts");
    expect(parseAiStreamEvent({ type: "delta", requestId: "req-1", text: "hello" }).type).toBe("delta");
    const complete = parseAiStreamEvent({ type: "complete", requestId: "req-1", finishReason: "stop" });
    expect(complete.type).toBe("complete");
    if (complete.type === "complete") expect(complete.finishReason).toBe("stop");
  });

  it("rejects malformed upload descriptors", async () => {
    const { validateUploadDescriptor } = await import("../shared/geminio-contracts");
    expect(() => validateUploadDescriptor({ fileName: "x", mimeType: "text/plain", sizeBytes: 1, checksumSha256: "bad" })).toThrow();
    expect(() => validateUploadDescriptor({ fileName: "x", mimeType: "text/plain", sizeBytes: 60 * 1024 * 1024, checksumSha256: "a".repeat(64) })).toThrow();
  });
});
