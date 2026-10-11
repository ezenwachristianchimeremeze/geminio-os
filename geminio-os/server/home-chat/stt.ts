/**
 * Speech-to-text boundary. The UI records audio and uploads it here; a provider turns it into text.
 *  - SttProvider is provider-agnostic. WhisperHttpProvider speaks the OpenAI-compatible
 *    /v1/audio/transcriptions protocol (configurable base URL, key and model).
 *  - With no configured provider, transcribe() returns a truthful "unavailable" outcome. Nothing is ever invented.
 *  - The transcript is a DRAFT for the user to review; it is never auto-sent.
 */
export const STT_LIMITS = { maxBytes: 12 * 1024 * 1024, minBytes: 800, timeoutMs: 45_000 } as const;
export const STT_MIME_ALLOWLIST = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/3gpp", "audio/flac"] as const;

export type SttSegment = { noSpeechProb?: number; avgLogprob?: number };
export type SttResult = { text: string; language: string | null; durationSec: number | null; segments: SttSegment[] };
export interface SttProvider { readonly name: string; transcribe(audio: Uint8Array, mimeType: string, opts: { language?: string | null; signal?: AbortSignal }): Promise<SttResult>; }

export type SttOutcome =
  | { status: "ok"; text: string; language: string | null; durationSec: number | null; provider: string; uncertain: boolean }
  | { status: "unavailable"; reason: string }
  | { status: "invalid"; code: "TOO_LARGE" | "TOO_SMALL" | "UNSUPPORTED_FORMAT" | "BAD_ENCODING"; reason: string }
  | { status: "empty"; reason: string }
  | { status: "failed"; reason: string; retryable: boolean };

const baseMime = (m: string) => m.split(";")[0].trim().toLowerCase();
const EXT: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/m4a": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/3gpp": "3gp", "audio/flac": "flac" };

export class WhisperHttpProvider implements SttProvider {
  readonly name: string;
  constructor(private cfg: { baseUrl: string; apiKey: string; model: string; name?: string }, private fetchImpl: typeof fetch = fetch) { this.name = cfg.name ?? "whisper-http"; }
  async transcribe(audio: Uint8Array, mimeType: string, opts: { language?: string | null; signal?: AbortSignal }): Promise<SttResult> {
    const mime = baseMime(mimeType);
    const form = new FormData();
    form.append("file", new Blob([audio as BlobPart], { type: mime }), `audio.${EXT[mime] ?? "webm"}`);
    form.append("model", this.cfg.model);
    form.append("response_format", "verbose_json");
    if (opts.language) form.append("language", opts.language.split("-")[0]);
    const base = this.cfg.baseUrl.endsWith("/") ? this.cfg.baseUrl : `${this.cfg.baseUrl}/`;
    const res = await this.fetchImpl(new URL("v1/audio/transcriptions", base).toString(), { method: "POST", headers: { authorization: `Bearer ${this.cfg.apiKey}`, "Accept-Encoding": "identity" }, body: form, signal: opts.signal });
    if (!res.ok) throw Object.assign(new Error(`Transcription provider returned HTTP ${res.status}`), { status: res.status });
    const json = (await res.json()) as { text?: unknown; language?: unknown; duration?: unknown; segments?: { no_speech_prob?: number; avg_logprob?: number }[] };
    if (typeof json.text !== "string") throw new Error("Transcription provider returned an invalid response.");
    return { text: json.text, language: typeof json.language === "string" ? json.language : null, durationSec: typeof json.duration === "number" ? json.duration : null, segments: (json.segments ?? []).map((s) => ({ noSpeechProb: s.no_speech_prob, avgLogprob: s.avg_logprob })) };
  }
}

/** STT_API_URL/STT_API_KEY win; the platform's BUILT_IN_FORGE_* pair is the fallback. No key -> null (unavailable). */
export function resolveSttProvider(env: Record<string, string | undefined>, fetchImpl?: typeof fetch): SttProvider | null {
  const baseUrl = env.STT_API_URL || env.BUILT_IN_FORGE_API_URL;
  const apiKey = env.STT_API_KEY || env.BUILT_IN_FORGE_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return new WhisperHttpProvider({ baseUrl, apiKey, model: env.STT_MODEL || "whisper-1" }, fetchImpl);
}

export function decodeAudio(base64: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) return null;
  return new Uint8Array(Buffer.from(base64, "base64"));
}

/** Heuristic only used to WARN the user to review carefully; the transcript is never auto-sent either way. */
export function isUncertain(segments: SttSegment[]): boolean {
  const withProb = segments.filter((s) => typeof s.noSpeechProb === "number");
  if (withProb.length && withProb.reduce((a, s) => a + (s.noSpeechProb as number), 0) / withProb.length > 0.5) return true;
  const withLp = segments.filter((s) => typeof s.avgLogprob === "number");
  return withLp.length > 0 && withLp.reduce((a, s) => a + (s.avgLogprob as number), 0) / withLp.length < -1;
}

export async function transcribe(provider: SttProvider | null, input: { audioBase64: string; mimeType: string; language?: string | null }): Promise<SttOutcome> {
  if (!provider) return { status: "unavailable", reason: "Speech recognition is not configured on this server (no STT provider key). You can type your message instead." };
  const mime = baseMime(input.mimeType);
  if (!(STT_MIME_ALLOWLIST as readonly string[]).includes(mime)) return { status: "invalid", code: "UNSUPPORTED_FORMAT", reason: `Audio format ${mime || "unknown"} is not supported.` };
  const audio = decodeAudio(input.audioBase64);
  if (!audio) return { status: "invalid", code: "BAD_ENCODING", reason: "The audio upload was corrupted. Please record again." };
  if (audio.length > STT_LIMITS.maxBytes) return { status: "invalid", code: "TOO_LARGE", reason: `Recording is too long (limit ${Math.round(STT_LIMITS.maxBytes / 1024 / 1024)} MB). Record a shorter message.` };
  if (audio.length < STT_LIMITS.minBytes) return { status: "invalid", code: "TOO_SMALL", reason: "The recording was too short to transcribe." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STT_LIMITS.timeoutMs);
  try {
    const r = await provider.transcribe(audio, mime, { language: input.language ?? null, signal: controller.signal });
    const text = r.text.replace(/\s+/g, " ").trim();
    if (!text) return { status: "empty", reason: "No speech was detected. Try again closer to the microphone." };
    return { status: "ok", text: text.slice(0, 20_000), language: r.language, durationSec: r.durationSec, provider: provider.name, uncertain: isUncertain(r.segments) };
  } catch (e) {
    const status = (e as { status?: number }).status;
    const aborted = e instanceof Error && e.name === "AbortError";
    const retryable = aborted || status === undefined || status === 429 || status >= 500;
    const reason = aborted ? "Speech recognition timed out." : status === 401 || status === 403 ? "Speech recognition credentials were rejected by the provider." : status === 429 ? "Speech recognition is rate limited. Try again shortly." : status && status >= 500 ? "The speech recognition provider is having problems. Try again shortly." : "Speech recognition failed (network or provider error).";
    return { status: "failed", reason, retryable };
  } finally { clearTimeout(timer); }
}
