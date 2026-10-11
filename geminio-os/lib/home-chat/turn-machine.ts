/**
 * One chat turn's lifecycle (pure). Every transition is caused by a REAL event: the send mutation resolving,
 * a poll returning a run view, the user pressing stop. Labels never imply work that is not happening.
 */
export type SearchReport = { attempted: false } | { attempted: true; status: "ok" | "unavailable" | "failed"; sources?: number; reason?: string };
export type TurnState =
  | { s: "idle" }
  | { s: "sending"; predictedSearch: boolean }               // awaiting the server's accept (it may be searching)
  | { s: "running"; runId: string; search: SearchReport; steps: { key: string; label: string; state: string }[] }
  | { s: "stopping"; runId: string }
  | { s: "paused"; runId: string }
  | { s: "done"; runId: string } | { s: "stopped"; runId: string }
  | { s: "failed"; runId: string | null; message: string; retryable: boolean; code?: "INSUFFICIENT_CREDITS" | "UNAUTHENTICATED" | "OTHER" };
export type TurnEvent =
  | { type: "SEND"; predictedSearch: boolean } | { type: "ACCEPTED"; runId: string; search: SearchReport }
  | { type: "SEND_FAILED"; message: string; code?: "INSUFFICIENT_CREDITS" | "UNAUTHENTICATED" | "OTHER" }
  | { type: "POLL"; status: string; steps: { key: string; label: string; state: string }[]; error: { message: string; retryable: boolean } | null }
  | { type: "STOP" } | { type: "STOPPED" } | { type: "RESET" } | { type: "RESUMED" };

export const TERMINAL = new Set(["completed", "failed", "cancelled"]);
export function turnReducer(st: TurnState, e: TurnEvent): TurnState {
  switch (e.type) {
    case "SEND": return st.s === "sending" || st.s === "running" || st.s === "stopping" || st.s === "paused" ? st : { s: "sending", predictedSearch: e.predictedSearch };
    case "ACCEPTED": return st.s === "sending" ? { s: "running", runId: e.runId, search: e.search, steps: [] } : st;
    case "SEND_FAILED": return st.s === "sending" ? { s: "failed", runId: null, message: e.message, retryable: e.code !== "INSUFFICIENT_CREDITS", code: e.code ?? "OTHER" } : st;
    case "POLL": {
      if (st.s !== "running" && st.s !== "stopping" && st.s !== "paused") return st;
      const runId = st.runId;
      if (e.status === "paused") return st.s === "running" ? { s: "paused", runId } : st;
      if (st.s === "paused" && (e.status === "accepted" || e.status === "executing" || e.status === "planning")) return { s: "running", runId, search: { attempted: false }, steps: e.steps };
      if (e.status === "completed") return { s: "done", runId };
      if (e.status === "cancelled") return { s: "stopped", runId };
      if (e.status === "failed") return { s: "failed", runId, message: e.error?.message ?? "The request failed.", retryable: e.error?.retryable ?? false };
      return st.s === "running" ? { ...st, steps: e.steps } : st;
    }
    case "STOP": return st.s === "running" || st.s === "paused" ? { s: "stopping", runId: st.runId } : st;
    case "RESUMED": return st.s === "paused" ? { s: "running", runId: st.runId, search: { attempted: false }, steps: [] } : st;
    case "STOPPED": return st.s === "stopping" ? { s: "stopped", runId: st.runId } : st;
    case "RESET": return { s: "idle" };
  }
}
export const isBusy = (st: TurnState) => st.s === "sending" || st.s === "running" || st.s === "stopping" || st.s === "paused";
/** Only claims searching while the request that may search is genuinely in flight. */
export function statusLabel(st: TurnState): string | null {
  switch (st.s) {
    case "sending": return st.predictedSearch ? "Checking the web and preparing a reply…" : "Sending…";
    case "running": { const active = [...st.steps].reverse().find((x) => x.state === "active"); return active ? `${active.label}…` : "Working…"; }
    case "stopping": return "Stopping…";
    case "paused": return "Paused — resume or stop";
    default: return null;
  }
}
