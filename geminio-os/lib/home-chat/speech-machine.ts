/** Text-to-speech state (pure). Driven by real engine callbacks; one message speaks at a time. */
export type SpeechState = { s: "idle" } | { s: "speaking"; messageId: string; chunk: number; total: number } | { s: "paused"; messageId: string; chunk: number; total: number } | { s: "error"; messageId: string; message: string };
export type SpeechEvent =
  | { type: "PLAY"; messageId: string; total: number } | { type: "CHUNK_DONE" } | { type: "PAUSE" } | { type: "RESUME" } | { type: "STOP" }
  | { type: "ERROR"; message: string } | { type: "DISMISS" };
export const initialSpeech: SpeechState = { s: "idle" };
export function speechReducer(st: SpeechState, e: SpeechEvent): SpeechState {
  switch (e.type) {
    case "PLAY": return e.total > 0 ? { s: "speaking", messageId: e.messageId, chunk: 0, total: e.total } : { s: "error", messageId: e.messageId, message: "There is nothing to read aloud in this message." };
    case "CHUNK_DONE": return st.s === "speaking" ? (st.chunk + 1 >= st.total ? { s: "idle" } : { ...st, chunk: st.chunk + 1 }) : st;
    case "PAUSE": return st.s === "speaking" ? { ...st, s: "paused" } : st;
    case "RESUME": return st.s === "paused" ? { ...st, s: "speaking" } : st;
    case "STOP": return st.s === "speaking" || st.s === "paused" ? { s: "idle" } : st;
    case "ERROR": return { s: "error", messageId: st.s === "idle" ? "" : (st as { messageId: string }).messageId, message: e.message };
    case "DISMISS": return st.s === "error" ? { s: "idle" } : st;
  }
}
export const speechFor = (st: SpeechState, messageId: string): "idle" | "speaking" | "paused" | "error" => (st.s !== "idle" && (st as { messageId: string }).messageId === messageId ? st.s : "idle");
