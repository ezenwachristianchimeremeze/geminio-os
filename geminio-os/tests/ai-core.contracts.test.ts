import { describe, expect, it } from "vitest";
import { capabilityPromptCatalog, getCapability, listCapabilities } from "../server/ai-core/capabilities";
import { getProviderAdapter, normalizeProviderError } from "../server/ai-core/providers";
import { authorizeCapability, consumeRateLimit } from "../server/ai-core/security";
import { aiIntentSchema, canTransitionTask, liveBuilderFilePatchSchema, liveBuilderPreviewDocumentSchema, liveBuilderSelectionSchema, orchestrationPlanSchema, redactSensitiveMetadata } from "../shared/geminio-contracts";
import { LIVE_BUILDER_PREVIEW_DIMENSIONS } from "../server/live-builder/service";
import { createProjectRunner } from "../server/live-builder/runner";
import { destinationForCapability } from "../server/ai-core/destinations";

describe("AI Core contracts", () => {
  it("exposes enabled capabilities with explicit risk and provider boundaries", () => {
    const capabilities = listCapabilities();
    expect(capabilities.length).toBeGreaterThan(5);
    expect(capabilities.every((item) => item.enabled && item.supportedProviders.length > 0)).toBe(true);
    expect(getCapability("project.deploy")?.descriptor.requiresApproval).toBe(true);
    expect(capabilityPromptCatalog()).toContain("builder.app.generate");
    expect(getCapability("media.video.create")?.descriptor.displayName).toBe("Create a video");
    expect(getCapability("career.opportunity.search")?.descriptor.risk).toBe("read");
  });

  it("maps specialized AI capabilities to real Geminio product destinations", () => {
    expect(destinationForCapability("builder.website.generate")).toEqual({ label: "Open AI Builder", route: "/workspace/ai-builder" });
    expect(destinationForCapability("media.video.create")?.route).toBe("/workspace/media-studio/Videos");
    expect(destinationForCapability("unknown.capability")).toBeNull();
  });

  it("uses explicit execution instructions for conversation and AI Builder capabilities", () => {
    const conversationHandler = getCapability("conversation.reply")?.handler;
    const builderHandler = getCapability("builder.app.generate")?.handler;
    expect(conversationHandler).toBeTypeOf("function");
    expect(builderHandler).toBeTypeOf("function");
    const context = {
      userId: 1,
      runId: "run_1",
      taskId: "task_1",
      projectId: "project_1",
      requestMessage: "Create a habit tracker",
      parameters: { brief: "Create a habit tracker" },
      conversationMessages: [{ role: "user" as const, content: "Create a habit tracker" }],
    };
    expect(conversationHandler?.(context)).toMatchObject({ outputKind: "conversation", maxTokens: 2000 });
    expect(builderHandler?.(context)).toMatchObject({ outputKind: "implementation", maxTokens: 4000 });
    expect(builderHandler?.(context).messages[0]?.content).toContain("Do not claim that files were exported");
  });

  it("does not claim unavailable providers are connected", async () => {
    const adapter = getProviderAdapter("anthropic");
    expect(adapter.isAvailable()).toBe(false);
    await expect(adapter.invoke({ messages: [{ role: "user", content: "hello" }] })).rejects.toMatchObject({ name: "ProviderUnavailableError" });
  });

  it("validates an approval-gated orchestration plan", () => {
    const intent = aiIntentSchema.parse({
      name: "Deploy a project",
      capability: "project.deploy",
      confidence: 0.99,
      rationale: "The request explicitly asks to deploy.",
      requiresApproval: true,
      risk: "external_side_effect",
      parameters: { projectId: "project_1", target: "production" },
    });
    const plan = orchestrationPlanSchema.parse({
      version: 1,
      intent,
      steps: [{
        id: "step_1",
        capability: intent.capability,
        title: intent.name,
        input: intent.parameters,
        risk: intent.risk,
        requiresApproval: true,
        status: "pending",
        output: null,
        error: null,
      }],
      verification: ["External provider confirms deployment."],
    });
    expect(plan.steps[0]?.requiresApproval).toBe(true);
  });

  it("requires approval for external side effects and allows low-risk capabilities", () => {
    expect(authorizeCapability({ userId: 1, capability: "project.deploy", approved: false }).allowed).toBe(false);
    expect(authorizeCapability({ userId: 1, capability: "project.deploy", approved: true }).allowed).toBe(true);
    expect(authorizeCapability({ userId: 1, capability: "conversation.reply", approved: false }).allowed).toBe(true);
    expect(authorizeCapability({ userId: 1, capability: "unknown.capability", approved: true }).allowed).toBe(false);
  });

  it("permits cancellation from active task states but keeps terminal task states immutable", () => {
    expect(canTransitionTask("queued", "cancelled")).toBe(true);
    expect(canTransitionTask("running", "cancelled")).toBe(true);
    expect(canTransitionTask("completed", "cancelled")).toBe(false);
    expect(canTransitionTask("cancelled", "retrying")).toBe(false);
  });

  it("enforces a bounded per-user request window", () => {
    const userId = 900000 + Math.floor(Math.random() * 100000);
    expect(consumeRateLimit(userId, 2, 60_000)).toBe(true);
    expect(consumeRateLimit(userId, 2, 60_000)).toBe(true);
    expect(consumeRateLimit(userId, 2, 60_000)).toBe(false);
  });

  it("validates Live Builder responsive targets and scoped edit context", () => {
    expect(Object.entries(LIVE_BUILDER_PREVIEW_DIMENSIONS)).toEqual(expect.arrayContaining([
      ["phone", expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) })],
      ["tablet", expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) })],
      ["laptop", expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) })],
      ["desktop", expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) })],
    ]));
    const selection = liveBuilderSelectionSchema.parse({ elementId: "hero-title", label: "Hero title", filePath: "src/pages/home.tsx", componentName: "Hero", properties: { responsive: true } });
    expect(selection.filePath).toBe("src/pages/home.tsx");
    const patch = liveBuilderFilePatchSchema.parse({ path: selection.filePath, operation: "modify", kind: "page", content: "export default function Home() {}", summary: "Update the home page" });
    expect(patch.operation).toBe("modify");
    const preview = liveBuilderPreviewDocumentSchema.parse({ route: "/", nodes: [{ id: selection.elementId, type: "heading", label: selection.label, filePath: selection.filePath, componentName: selection.componentName, properties: selection.properties }] });
    expect(preview.nodes).toHaveLength(1);
  });

  it("keeps executable runner work behind an explicit isolated adapter boundary", async () => {
    const input = { workspaceId: "workspace_1", target: "desktop" as const, engine: "external_runner" as const, versionId: null };
    const unavailable = await createProjectRunner("external_runner").start(input);
    expect(unavailable.status).toBe("unavailable");
    expect(unavailable.outputMode).toBe("unavailable");
    expect(unavailable.diagnostics[0]?.code).toBe("EXTERNAL_RUNNER_UNAVAILABLE");

    const controlled = await createProjectRunner("controlled_canvas").start({ ...input, engine: "controlled_canvas" });
    expect(controlled.status).toBe("ready");
    expect(controlled.isolation).toBe("controlled_canvas");
    expect(controlled.outputMode).toBe("declarative");
  });

  it("redacts sensitive metadata and normalizes provider failures", () => {
    expect(redactSensitiveMetadata({ apiKey: "secret", requestId: "req_1", nested: { ok: true } })).toEqual({ apiKey: "[REDACTED]", requestId: "req_1", nested: { ok: true } });
    expect(normalizeProviderError(new Error("temporary timeout"), "builtin-llm")).toMatchObject({ retryable: true, code: "provider_transient_failure" });
  });
});
