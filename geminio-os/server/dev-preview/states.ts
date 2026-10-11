/**
 * Dev-preview state model. Reuses the Live Builder runner-job vocabulary
 * (server/live-builder/control-plane.ts) instead of inventing a second one.
 */
import type { RunnerJobState } from "../live-builder/control-plane";

export const PREVIEW_STATES = ["stopped", "starting", "installing", "building", "running", "ready", "failed"] as const;
export type PreviewState = (typeof PREVIEW_STATES)[number];

export function toPreviewState(job: RunnerJobState | null): PreviewState {
  switch (job) {
    case "created":
    case "queued":
    case "starting":
    case "retrying":
      return "starting";
    case "preparing":
      return "installing";
    case "building":
      return "building";
    case "running":
      return "running";
    case "ready":
      return "ready";
    case "failed":
    case "timeout":
      return "failed";
    default:
      return "stopped"; // null, stopping, completed, cancelled, forced_stop, cleaned, cancel_requested
  }
}

export type FailureKind =
  | "dependency_registry_blocked"
  | "dependency_install_failed"
  | "build_failed"
  | "port_in_use"
  | "database_unavailable"
  | "process_exited"
  | "timeout"
  | "unknown";

export type Diagnosis = { kind: FailureKind; title: string; hint: string };

/** Secrets must never reach the UI/log: redact env-style assignments, bearer tokens and URL credentials. */
export function redact(text: string): string {
  return text
    .replace(/(\b[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|DATABASE_URL)[A-Z0-9_]*\s*[=:]\s*)\S+/g, "$1[redacted]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, "$1[redacted]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[redacted]@");
}

/**
 * Classify a failed phase from the real process output. Only reports what the
 * output actually says; falls back to "unknown" rather than guessing a cause.
 */
export function diagnoseFailure(phase: "install" | "build" | "run", output: string, exitCode: number | null): Diagnosis {
  const text = output;
  if (phase === "install") {
    if (/x-deny-reason|host_not_allowed|ERR_PNPM_FETCH_(?:403|401)|\b403\b.*(?:registry|npm)|registry.*\b403\b|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ERR_PNPM_META_FETCH_FAIL|getaddrinfo/i.test(text)) {
      return { kind: "dependency_registry_blocked", title: "Dependency installation blocked", hint: "The package registry is unreachable from this environment. Allow registry access (or provide a populated node_modules/pnpm store) and restart the preview." };
    }
    if (/ERR_PNPM_OUTDATED_LOCKFILE|lockfile/i.test(text)) {
      return { kind: "dependency_install_failed", title: "Lockfile out of date", hint: "pnpm-lock.yaml does not match package.json. Run `pnpm install` without --frozen-lockfile locally and commit the lockfile." };
    }
    return { kind: "dependency_install_failed", title: "Dependency installation failed", hint: `pnpm install exited with code ${exitCode ?? "unknown"}. See the output below.` };
  }
  if (phase === "build") {
    return { kind: "build_failed", title: "Build failed", hint: `pnpm build exited with code ${exitCode ?? "unknown"}. See the output below.` };
  }
  if (/EADDRINUSE|address already in use/i.test(text)) {
    return { kind: "port_in_use", title: "Port already in use", hint: "Another process is using the preview port. Stop it or set EXPO_PORT/PORT to a free port." };
  }
  if (/DATABASE_URL|ECONNREFUSED.*3306|ER_ACCESS_DENIED|ER_BAD_DB_ERROR|Access denied for user/i.test(text)) {
    return { kind: "database_unavailable", title: "Database unavailable", hint: "The server could not reach MySQL. Check DATABASE_URL and that the database is running." };
  }
  return { kind: exitCode !== null ? "process_exited" : "unknown", title: "Preview process stopped", hint: exitCode !== null ? `The dev server exited with code ${exitCode}.` : "The dev server stopped unexpectedly." };
}

export type OutputSignal =
  | { type: "server_listening"; port: number }
  | { type: "web_bundled" }
  | { type: "bundle_error"; message: string }
  | { type: "metro_ready"; url: string };

/**
 * Parse one line of dev-server output into a signal. The server line comes from
 * server/_core/index.ts ("[api] server listening on port N"). The Metro/Expo
 * patterns are best-effort and NOT verified against real Expo output in this
 * environment; the HTTP readiness probe is the ground truth for "ready".
 */
export function parseOutputLine(line: string): OutputSignal | null {
  const listening = /\[api\] server listening on port (\d{2,5})/.exec(line);
  if (listening) return { type: "server_listening", port: Number(listening[1]) };
  if (/Web Bundled\b/.test(line)) return { type: "web_bundled" };
  if (/(?:Web|Android|iOS) Bundling failed|SyntaxError|Unable to resolve module/.test(line)) return { type: "bundle_error", message: line.trim().slice(0, 300) };
  const metro = /Waiting on (https?:\/\/[^\s]+)/.exec(line);
  if (metro) return { type: "metro_ready", url: metro[1] };
  return null;
}

/** Keep the last N lines of output, bounded in bytes, with secrets redacted. */
export class OutputBuffer {
  private lines: string[] = [];
  constructor(private readonly maxLines = 200, private readonly maxLineLength = 500) {}
  push(chunk: string): string[] {
    const fresh = chunk.split(/\r?\n/).filter((l) => l.length > 0).map((l) => redact(l).slice(0, this.maxLineLength));
    this.lines.push(...fresh);
    if (this.lines.length > this.maxLines) this.lines.splice(0, this.lines.length - this.maxLines);
    return fresh;
  }
  tail(n = 40): string[] { return this.lines.slice(-n); }
  text(): string { return this.lines.join("\n"); }
  clear() { this.lines = []; }
}
