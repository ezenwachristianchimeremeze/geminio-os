/** When should an AI Core run notify the user? Quick chat replies stay quiet; long, multi-step, failed or blocked work speaks up. */
export const NOTIFY = { minDurationMs: 30_000, minSteps: 2 } as const;
export type NotifyEvent = "completed" | "failed" | "approval_required" | "paused_expired";
export type RunFacts = { steps: number; durationMs: number; retryScheduled?: boolean; capabilityLabel?: string | null };
export type Notification = { title: string; message: string; type: "success" | "warning" | "error" | "info" };

export function notificationFor(event: NotifyEvent, f: RunFacts, detail?: string): Notification | null {
  const what = (f.capabilityLabel ?? "Your task").slice(0, 60);
  switch (event) {
    case "completed": return f.steps >= NOTIFY.minSteps || f.durationMs >= NOTIFY.minDurationMs ? { title: "Task finished", message: `${what} finished${f.steps >= 2 ? ` (${f.steps} steps)` : ""}. Open Home to see the result.`, type: "success" } : null;
    case "failed": return f.retryScheduled ? { title: "Task retry scheduled", message: "Geminio will retry the task automatically.", type: "warning" } : { title: "Task failed", message: (detail ?? "The task could not be completed.").slice(0, 200), type: "error" };
    case "approval_required": return { title: "Approval needed", message: `${what} is waiting for your approval before it can continue.`, type: "warning" };
    case "paused_expired": return { title: "Paused task cancelled", message: `${what} was paused for too long and was cancelled. You were not charged for unfinished steps.`, type: "info" };
  }
}
