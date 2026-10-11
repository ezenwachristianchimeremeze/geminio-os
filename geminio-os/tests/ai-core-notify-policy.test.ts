import { describe, expect, it } from "vitest";
import { notificationFor } from "../server/ai-core/notify-policy";

describe("notification policy", () => {
  it("stays quiet for short single-step replies, speaks for multi-step or long runs", () => {
    expect(notificationFor("completed", { steps: 1, durationMs: 4000 })).toBeNull();
    expect(notificationFor("completed", { steps: 3, durationMs: 4000 })).toMatchObject({ type: "success", message: expect.stringContaining("3 steps") });
    expect(notificationFor("completed", { steps: 1, durationMs: 45_000 })).not.toBeNull();
  });
  it("failures always notify, with bounded text; retries are labelled as such", () => {
    expect(notificationFor("failed", { steps: 1, durationMs: 1 }, "x".repeat(500))!.message).toHaveLength(200);
    expect(notificationFor("failed", { steps: 1, durationMs: 1, retryScheduled: true })).toMatchObject({ title: "Task retry scheduled", type: "warning" });
  });
  it("approval-required and paused-expiry notify", () => {
    expect(notificationFor("approval_required", { steps: 2, durationMs: 1 })!.title).toBe("Approval needed");
    expect(notificationFor("paused_expired", { steps: 2, durationMs: 1 })!.message).toContain("not charged");
  });
});
