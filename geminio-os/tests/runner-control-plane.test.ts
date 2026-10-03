import { describe, expect, it } from "vitest";
import { PreviewGateway } from "@/server/live-builder/preview-gateway";
import { RunnerControlPlane, SAFE_DEFAULT_EXECUTION_POLICY, canTransitionRunnerJob } from "@/server/live-builder/control-plane";

describe("Runner control plane", () => {
  it("accepts the safe create → queue → start → prepare → build → running → ready lifecycle", () => {
    const plane = new RunnerControlPlane();
    const job = plane.createJob({ userId: 1, projectId: "project-1" });
    expect(plane.queue(job.id).state).toBe("queued");
    expect(plane.start(job.id).state).toBe("starting");
    expect(plane.prepare(job.id).state).toBe("preparing");
    expect(plane.build(job.id).state).toBe("building");
    expect(plane.mark(job.id, "running").state).toBe("running");
    expect(plane.ready(job.id).state).toBe("ready");
    expect(plane.metrics().activeJobs).toBe(1);
  });

  it("rejects invalid transitions and enforces deny-by-default network policy", () => {
    const plane = new RunnerControlPlane();
    const job = plane.createJob({ userId: 1, projectId: "project-1" });
    expect(() => plane.ready(job.id)).toThrow("Invalid runner job transition");
    expect(plane.assertNetworkAllowed("internal.geminio")).toBe(false);
    expect(SAFE_DEFAULT_EXECUTION_POLICY.allowedNetworkHosts).toEqual([]);
  });

  it("enforces concurrent-job quotas without allowing an unbounded runner", () => {
    const plane = new RunnerControlPlane({ ...SAFE_DEFAULT_EXECUTION_POLICY, concurrentJobs: 1 });
    const first = plane.createJob({ userId: 1, projectId: "project-1" });
    plane.queue(first.id);
    plane.start(first.id);
    const second = plane.createJob({ userId: 1, projectId: "project-2" });
    plane.queue(second.id);
    expect(() => plane.start(second.id)).toThrow("concurrency quota exceeded");
  });

  it("supports cancellation and cleanup without deleting project state", () => {
    const plane = new RunnerControlPlane();
    const job = plane.createJob({ userId: 1, projectId: "project-1" });
    plane.queue(job.id);
    plane.start(job.id);
    expect(plane.cancel(job.id).state).toBe("cancel_requested");
    expect(plane.mark(job.id, "stopping").state).toBe("stopping");
    expect(plane.mark(job.id, "cancelled").state).toBe("cancelled");
    expect(plane.cleanup(job.id).state).toBe("cleaned");
    expect(plane.getLogs(job.id).some((log) => log.phase === "cancelled")).toBe(true);
  });

  it("supports retry and bounded timeout recovery", () => {
    const plane = new RunnerControlPlane();
    const job = plane.createJob({ userId: 1, projectId: "project-1", maxAttempts: 2 });
    plane.queue(job.id);
    plane.start(job.id);
    plane.prepare(job.id);
    plane.build(job.id);
    expect(plane.mark(job.id, "failed", "compile failed").state).toBe("failed");
    expect(plane.retry(job.id).state).toBe("retrying");
    expect(plane.mark(job.id, "preparing").state).toBe("preparing");
    expect(plane.mark(job.id, "building").state).toBe("building");
    expect(plane.timeout(job.id).state).toBe("timeout");
    expect(plane.mark(job.id, "forced_stop").state).toBe("forced_stop");
    expect(plane.cleanup(job.id).state).toBe("cleaned");
  });

  it("recovers an expired worker lease as a failure rather than corrupting the project", () => {
    const plane = new RunnerControlPlane({ ...SAFE_DEFAULT_EXECUTION_POLICY, timeoutMs: 1 });
    const job = plane.createJob({ userId: 1, projectId: "project-1" });
    plane.queue(job.id);
    plane.start(job.id);
    const recovered = plane.recoverExpiredLeases(Date.now() + 10_000);
    expect(recovered[0]?.state).toBe("failed");
    expect(recovered[0]?.lastError).toContain("lease expired");
  });

  it("issues scoped, short-lived runner credentials without exposing master secrets", () => {
    const plane = new RunnerControlPlane();
    const secret = plane.issueScopedSecret("project-read", 30_000);
    expect(secret.scope).toBe("project-read");
    expect(secret.exposedTo).toBe("isolated-runner-only");
    expect(secret.token).not.toContain("DATABASE_URL");
  });

  it("supports authenticated preview sessions with expiry, revocation, and cleanup", () => {
    const gateway = new PreviewGateway();
    const session = gateway.create({ userId: 7, workspaceId: "workspace-1", ttlMs: 1000 });
    expect(gateway.authorize(7, session.id).authState).toBe("authenticated");
    expect(() => gateway.authorize(8, session.id)).toThrow("Preview session not found");
    expect(() => gateway.authorize(7, session.id, Date.parse(session.expiresAt) + 1)).toThrow("expired");
    const revoked = gateway.revoke(7, session.id);
    expect(revoked.authState).toBe("revoked");
    expect(gateway.cleanup()).toBe(1);
  });

  it("keeps the state graph explicit for cancellation and timeout paths", () => {
    expect(canTransitionRunnerJob("running", "cancel_requested")).toBe(true);
    expect(canTransitionRunnerJob("cancel_requested", "stopping")).toBe(true);
    expect(canTransitionRunnerJob("timeout", "forced_stop")).toBe(true);
    expect(canTransitionRunnerJob("forced_stop", "cleaned")).toBe(true);
    expect(canTransitionRunnerJob("ready", "queued")).toBe(false);
  });
});
