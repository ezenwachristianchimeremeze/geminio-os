/**
 * Requires a real MySQL (DATABASE_URL). Every Live Builder proposal submits an AI Core run, which reserves credits:
 * run with CREDITS_ENFORCEMENT=off (honoured outside production only) or seed the test user with credits.
 * The AI-generated edit test additionally needs an LLM provider (BUILT_IN_FORGE_API_URL/KEY) and skips without one.
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import { getUserByOpenId, upsertUser } from "../server/db";
import type { TrpcContext } from "../server/_core/context";

function createAuthenticatedContext(user: NonNullable<TrpcContext["user"]>): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

describe("Authenticated Live Builder workflow", () => {
  it.skipIf(!process.env.DATABASE_URL)("completes create → run → edit → rebuild → recover without bypassing auth", async () => {
    const openId = `live-builder-e2e-${Date.now()}`;
    await upsertUser({ openId, email: `${openId}@example.test`, name: "Live Builder E2E", loginMethod: "test", role: "user", lastSignedIn: new Date() });
    const user = await getUserByOpenId(openId);
    if (!user) throw new Error("The authenticated E2E user fixture could not be created.");

    const caller = appRouter.createCaller(createAuthenticatedContext(user));
    const created = await caller.liveBuilder.create({ name: "Authenticated E2E Project", description: "Workflow verification", kind: "website", existingProjectId: null });
    expect(created.ok).toBe(true);
    if (!created.data) throw new Error("Workspace creation returned no data.");
    const workspaceId = created.data.id;
    const initialVersionId = created.data.versions[0]?.id;
    if (!initialVersionId) throw new Error("Initial workspace version was not persisted.");

    const firstRun = await caller.liveBuilder.startRuntime({ workspaceId, target: "desktop", engine: "controlled_canvas", versionId: initialVersionId });
    expect(firstRun.data.session.status).toBe("ready");
    const sessionId = firstRun.data.session.id;

    const selected = await caller.liveBuilder.selectElement({ workspaceId, selection: { elementId: "primary-action", label: "Primary action", filePath: "app/index.tsx", componentName: "HomeScreen", properties: { responsive: true } } });
    expect(selected.data?.elementId).toBe("primary-action");
    // Deterministic, non-AI path: the user supplies the exact file content. (The AI-generated path is covered below
    // and needs an LLM provider.) Keeps this workflow independent of provider credentials and credits.
    const proposed = await caller.liveBuilder.proposeFileChange({ workspaceId, filePath: "app/index.tsx", content: 'export default function HomeScreen() { return null; } // Start now', summary: "Update primary action text" });
    expect(["proposed", "awaiting_approval"]).toContain(proposed.data.status);
    const applied = await caller.liveBuilder.applyChange({ workspaceId, changeSetId: proposed.data.id });
    expect(applied.data.version?.number).toBeGreaterThan(1);

    const validation = await caller.liveBuilder.validate({ workspaceId, target: "desktop", changeSetId: proposed.data.id });
    expect(["blocked", "passed"]).toContain(validation.data.status);

    const rebuilt = await caller.liveBuilder.rebuildRuntime({ sessionId });
    expect(rebuilt.data.session.status).toBe("ready");
    expect(rebuilt.data.events.some((event) => event.type === "recovered")).toBe(true);

    const unavailable = await caller.liveBuilder.startRuntime({ workspaceId, target: "desktop", engine: "external_runner", versionId: applied.data.version?.id ?? initialVersionId });
    expect(unavailable.data.session.status).toBe("failed");
    expect(unavailable.data.session.lastError).toContain("isolated executable runner");

    const restored = await caller.liveBuilder.restoreVersion({ workspaceId, versionId: initialVersionId });
    expect(restored.data.restoredVersionId).toBe(initialVersionId);
    const recoveredRun = await caller.liveBuilder.startRuntime({ workspaceId, target: "desktop", engine: "controlled_canvas", versionId: initialVersionId });
    expect(recoveredRun.data.session.status).toBe("ready");

    const runtimes = await caller.liveBuilder.listRuntimes({ workspaceId });
    expect(runtimes.data.length).toBeGreaterThanOrEqual(3);
  }, 30_000);

  // Requires: MySQL (DATABASE_URL) + a real LLM provider (BUILT_IN_FORGE_API_KEY) + credits (seed the user, or CREDITS_ENFORCEMENT=off outside production).
  it.skipIf(!process.env.DATABASE_URL || !process.env.BUILT_IN_FORGE_API_KEY)("AI-generated edit: propose -> awaiting approval -> apply creates a new version", async () => {
    const openId = `live-builder-ai-e2e-${Date.now()}`;
    await upsertUser({ openId, email: `${openId}@example.test`, name: "Live Builder AI E2E", loginMethod: "test", role: "user", lastSignedIn: new Date() });
    const user = await getUserByOpenId(openId);
    if (!user) throw new Error("The authenticated E2E user fixture could not be created.");
    const caller = appRouter.createCaller(createAuthenticatedContext(user));
    const created = await caller.liveBuilder.create({ name: "AI Edit E2E", description: "AI edit verification", kind: "website", existingProjectId: null });
    if (!created.data) throw new Error("Workspace creation returned no data.");
    const workspaceId = created.data.id;
    const proposed = await caller.liveBuilder.proposeChange({ workspaceId, prompt: 'Change the primary heading text to "Start now".' });
    expect(["proposed", "awaiting_approval"]).toContain(proposed.data.status);
    const applied = await caller.liveBuilder.applyChange({ workspaceId, changeSetId: proposed.data.id });
    expect(applied.data.version?.number).toBeGreaterThan(1);
  }, 120_000);
});
