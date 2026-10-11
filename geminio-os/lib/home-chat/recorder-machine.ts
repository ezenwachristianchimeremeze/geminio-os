/**
 * Voice-input state machine (pure). The UI drives it from real platform events; it never advances on its own.
 * Flow: idle -> requesting_permission -> recording <-> paused -> transcribing -> review (editable draft) | error.
 * A transcript is only ever a DRAFT in `review`; sending is a separate explicit user action.
 */
export type VoiceError = "permission_denied" | "mic_unavailable" | "unsupported" | "recording_failed" | "provider_unavailable" | "provider_failed" | "network" | "empty" | "too_short" | "too_long" | "invalid_audio";
export type VoiceState =
  | { s: "idle" } | { s: "requesting_permission" } | { s: "recording"; startedAt: number }
  | { s: "paused"; elapsedMs: number } | { s: "transcribing" }
  | { s: "review"; text: string; uncertain: boolean } | { s: "error"; error: VoiceError; message: string; retryable: boolean };
export type VoiceEvent =
  | { type: "PRESS_MIC" } | { type: "PERMISSION_GRANTED"; now: number } | { type: "PERMISSION_DENIED" } | { type: "MIC_UNAVAILABLE" } | { type: "UNSUPPORTED" }
  | { type: "PAUSE"; now: number } | { type: "RESUME"; now: number } | { type: "STOP" } | { type: "CANCEL" }
  | { type: "TRANSCRIPT"; text: string; uncertain: boolean } | { type: "FAILED"; error: VoiceError; message: string; retryable: boolean }
  | { type: "RECORDING_ERROR"; message: string } | { type: "DISMISS" };

export const MAX_RECORDING_MS = 5 * 60_000;
export const MIN_RECORDING_MS = 600;

export const initialVoice: VoiceState = { s: "idle" };

export function voiceReducer(state: VoiceState, e: VoiceEvent): VoiceState {
  switch (e.type) {
    case "PRESS_MIC": return state.s === "idle" || state.s === "error" || state.s === "review" ? { s: "requesting_permission" } : state;
    case "PERMISSION_GRANTED": return state.s === "requesting_permission" ? { s: "recording", startedAt: e.now } : state;
    case "PERMISSION_DENIED": return state.s === "requesting_permission" ? { s: "error", error: "permission_denied", message: "Microphone permission was denied. Enable it in your device or browser settings to use voice input.", retryable: true } : state;
    case "MIC_UNAVAILABLE": return state.s === "requesting_permission" || state.s === "recording" ? { s: "error", error: "mic_unavailable", message: "No microphone is available on this device.", retryable: true } : state;
    case "UNSUPPORTED": return { s: "error", error: "unsupported", message: "Voice recording isn't supported in this browser or device. You can type instead.", retryable: false };
    case "PAUSE": return state.s === "recording" ? { s: "paused", elapsedMs: e.now - state.startedAt } : state;
    case "RESUME": return state.s === "paused" ? { s: "recording", startedAt: e.now - state.elapsedMs } : state;
    case "STOP": return state.s === "recording" || state.s === "paused" ? { s: "transcribing" } : state;
    case "CANCEL": return state.s === "recording" || state.s === "paused" || state.s === "transcribing" || state.s === "requesting_permission" || state.s === "review" ? { s: "idle" } : state;
    case "TRANSCRIPT": return state.s === "transcribing" ? { s: "review", text: e.text, uncertain: e.uncertain } : state;
    case "FAILED": return state.s === "transcribing" ? { s: "error", error: e.error, message: e.message, retryable: e.retryable } : state;
    case "RECORDING_ERROR": return state.s === "recording" || state.s === "paused" || state.s === "requesting_permission" ? { s: "error", error: "recording_failed", message: e.message || "Recording failed.", retryable: true } : state;
    case "DISMISS": return state.s === "error" ? { s: "idle" } : state;
  }
}

export const elapsedMs = (state: VoiceState, now: number) => state.s === "recording" ? now - state.startedAt : state.s === "paused" ? state.elapsedMs : 0;
export const isTooShort = (ms: number) => ms < MIN_RECORDING_MS;
export const isTooLong = (ms: number) => ms >= MAX_RECORDING_MS;

/** Map a server transcription outcome (homeChat.transcribe) onto machine events. */
export function eventFromOutcome(o: { status: string; text?: string; uncertain?: boolean; reason?: string; retryable?: boolean; code?: string }): VoiceEvent {
  switch (o.status) {
    case "ok": return { type: "TRANSCRIPT", text: o.text ?? "", uncertain: Boolean(o.uncertain) };
    case "empty": return { type: "FAILED", error: "empty", message: o.reason ?? "No speech was detected.", retryable: true };
    case "unavailable": return { type: "FAILED", error: "provider_unavailable", message: o.reason ?? "Speech recognition is unavailable.", retryable: false };
    case "invalid": return { type: "FAILED", error: o.code === "TOO_SMALL" ? "too_short" : o.code === "TOO_LARGE" ? "too_long" : "invalid_audio", message: o.reason ?? "The recording could not be used.", retryable: true };
    default: return { type: "FAILED", error: "provider_failed", message: o.reason ?? "Speech recognition failed.", retryable: o.retryable ?? true };
  }
}
