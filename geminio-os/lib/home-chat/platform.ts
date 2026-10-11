/**
 * Thin platform adapters for copy, text-to-speech and audio recording. Web uses browser APIs; native uses Expo modules
 * (imported lazily so web bundles don't load them). UNVERIFIED ON DEVICE/BROWSER: written without Expo or a browser
 * available in the build sandbox. Each adapter reports what the platform really supports instead of pretending.
 */
import { Platform } from "react-native";
import { chunkForSpeech } from "./markdown";

const isWeb = Platform.OS === "web";

// ---------- copy ----------
export async function copyText(text: string): Promise<boolean> {
  try {
    if (isWeb) {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
      return false;
    }
    const Clipboard = await import("expo-clipboard");
    await Clipboard.setStringAsync(text);
    return true;
  } catch { return false; }
}

// ---------- text to speech ----------
export type TtsHandlers = { onChunkDone: () => void; onError: (message: string) => void };
export type Tts = {
  /** Android's native engine (via expo-speech) cannot pause; the UI must hide Pause there. */
  readonly canPause: boolean;
  readonly available: boolean;
  speak(text: string, opts: { language?: string }, h: TtsHandlers): { chunks: number };
  pause(): void; resume(): void; stop(): void;
};

export function createTts(): Tts {
  if (isWeb) {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    let token = 0;
    return {
      canPause: true, available: Boolean(synth),
      speak(text, opts, h) {
        const chunks = chunkForSpeech(text, 2000);
        if (!synth) { h.onError("Speech playback isn't supported in this browser."); return { chunks: 0 }; }
        synth.cancel(); const mine = ++token;
        chunks.forEach((c) => {
          const u = new SpeechSynthesisUtterance(c);
          if (opts.language) u.lang = opts.language;
          u.onend = () => { if (mine === token) h.onChunkDone(); };
          u.onerror = (ev) => { if (mine === token && ev.error !== "canceled" && ev.error !== "interrupted") h.onError("Speech playback failed."); };
          synth.speak(u);
        });
        return { chunks: chunks.length };
      },
      pause() { synth?.pause(); }, resume() { synth?.resume(); }, stop() { token++; synth?.cancel(); },
    };
  }
  let Speech: typeof import("expo-speech") | null = null;
  let token = 0;
  return {
    canPause: Platform.OS === "ios", available: true,
    speak(text, opts, h) {
      const chunks = chunkForSpeech(text, 3000);
      const mine = ++token;
      void import("expo-speech").then((mod) => {
        Speech = mod; if (mine !== token) return;
        chunks.forEach((c) => mod.speak(c, { language: opts.language, onDone: () => { if (mine === token) h.onChunkDone(); }, onError: () => { if (mine === token) h.onError("Speech playback failed."); } }));
      }).catch(() => h.onError("Speech playback is unavailable on this device."));
      return { chunks: chunks.length };
    },
    pause() { if (Platform.OS === "ios") void Speech?.pause(); },
    resume() { if (Platform.OS === "ios") void Speech?.resume(); },
    stop() { token++; void Speech?.stop(); },
  };
}

// ---------- audio recording ----------
export type RecordingResult = { base64: string; mimeType: string; durationMs: number };
export type RecorderErrorKind = "permission_denied" | "mic_unavailable" | "unsupported" | "recording_failed";
export class RecorderError extends Error { constructor(readonly kind: RecorderErrorKind, message: string) { super(message); } }
export interface Recorder { readonly canPause: boolean; start(): Promise<void>; pause(): void; resume(): void; stop(): Promise<RecordingResult>; cancel(): void; }

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Could not read the recording."));
    r.onload = () => { const s = String(r.result); resolve(s.slice(s.indexOf(",") + 1)); };
    r.readAsDataURL(blob);
  });
}

export function isRecordingSupported(): boolean {
  if (isWeb) return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
  return true;
}

export function createRecorder(): Recorder {
  return isWeb ? createWebRecorder() : createNativeRecorder();
}

function createWebRecorder(): Recorder {
  let stream: MediaStream | null = null; let rec: MediaRecorder | null = null; let chunks: Blob[] = []; let startedAt = 0; let accumulated = 0; let resumedAt = 0;
  const release = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };
  return {
    canPause: true,
    async start() {
      if (!isRecordingSupported()) throw new RecorderError("unsupported", "Voice recording isn't supported in this browser.");
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) {
        const name = (e as { name?: string }).name;
        if (name === "NotAllowedError" || name === "SecurityError") throw new RecorderError("permission_denied", "Microphone permission was denied.");
        if (name === "NotFoundError" || name === "OverconstrainedError") throw new RecorderError("mic_unavailable", "No microphone was found.");
        if (name === "NotSupportedError") throw new RecorderError("unsupported", "This browser can't record audio in this context (is the page served over HTTPS?).");
        if (name === "NotReadableError" || name === "AbortError") throw new RecorderError("mic_unavailable", "The microphone is busy or blocked by another application.");
        throw new RecorderError("recording_failed", "The microphone could not be opened.");
      }
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported?.(m));
      rec = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      chunks = []; rec.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
      rec.start(250); startedAt = Date.now(); resumedAt = startedAt; accumulated = 0;
    },
    pause() { if (rec?.state === "recording") { rec.pause(); accumulated += Date.now() - resumedAt; } },
    resume() { if (rec?.state === "paused") { rec.resume(); resumedAt = Date.now(); } },
    stop() {
      return new Promise<RecordingResult>((resolve, reject) => {
        if (!rec) return reject(new RecorderError("recording_failed", "Nothing is recording."));
        const r = rec; const mime = r.mimeType || "audio/webm";
        if (r.state === "recording") accumulated += Date.now() - resumedAt;
        r.onstop = async () => { release(); try { resolve({ base64: await blobToBase64(new Blob(chunks, { type: mime })), mimeType: mime, durationMs: accumulated }); } catch (e) { reject(new RecorderError("recording_failed", e instanceof Error ? e.message : "Recording failed.")); } };
        r.onerror = () => { release(); reject(new RecorderError("recording_failed", "Recording failed.")); };
        if (r.state !== "inactive") r.stop(); else r.onstop?.(new Event("stop"));
      });
    },
    cancel() { try { if (rec && rec.state !== "inactive") { rec.onstop = null; rec.stop(); } } catch { /* already stopped */ } chunks = []; release(); rec = null; },
  };
}

function createNativeRecorder(): Recorder {
  // expo-audio's imperative recorder. Signatures follow the expo-audio docs for SDK 54; not run on a device here.
  let recorder: any = null; let startedAt = 0; let accumulated = 0; let resumedAt = 0;
  return {
    canPause: true,
    async start() {
      let mod: any;
      try { mod = await import("expo-audio"); } catch { throw new RecorderError("unsupported", "Audio recording is unavailable on this build."); }
      const perm = await mod.AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) throw new RecorderError("permission_denied", "Microphone permission was denied.");
      try {
        await mod.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        recorder = new mod.AudioModule.AudioRecorder(mod.RecordingPresets.HIGH_QUALITY);
        await recorder.prepareToRecordAsync();
        recorder.record(); startedAt = Date.now(); resumedAt = startedAt; accumulated = 0;
      } catch { throw new RecorderError("mic_unavailable", "The microphone could not be started."); }
    },
    pause() { if (recorder) { recorder.pause(); accumulated += Date.now() - resumedAt; } },
    resume() { if (recorder) { recorder.record(); resumedAt = Date.now(); } },
    async stop() {
      if (!recorder) throw new RecorderError("recording_failed", "Nothing is recording.");
      const r = recorder; recorder = null; accumulated += Date.now() - resumedAt;
      try {
        await r.stop(); const uri: string | null = r.uri;
        if (!uri) throw new Error("no file");
        const blob = await (await fetch(uri)).blob();
        const mimeType = blob.type && blob.type.startsWith("audio/") ? blob.type : "audio/mp4";
        return { base64: await blobToBase64(blob), mimeType, durationMs: accumulated };
      } catch { throw new RecorderError("recording_failed", "The recording could not be saved."); }
    },
    cancel() { try { void recorder?.stop(); } catch { /* ignore */ } recorder = null; },
  };
}
