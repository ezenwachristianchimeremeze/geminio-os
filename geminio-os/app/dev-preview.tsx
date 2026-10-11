import React, { createElement, useMemo, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

/**
 * Dev Preview: the real Geminio OS dev server, real build progress (derived from
 * BLUEPRINT_IMPLEMENTATION_MATRIX.md) and the real activity log. Nothing here is
 * simulated: every value comes from trpc.devPreview.* on the server.
 */

const STATE_LABEL: Record<string, string> = {
  stopped: "○ Stopped",
  starting: "◐ Starting",
  installing: "◐ Installing dependencies",
  building: "◐ Building",
  running: "● Running",
  ready: "✓ Ready",
  failed: "✕ Failed",
};

function Bar({ percent, label, tone }: { percent: number; label: string; tone: "primary" | "success" }) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${label} ${percent} percent`} accessibilityValue={{ min: 0, max: 100, now: percent }} className="flex-row items-center gap-2">
      <Text className="text-xs text-muted w-24">{label}</Text>
      <View className="flex-1 h-2 rounded-full bg-border overflow-hidden">
        <View className={tone === "success" ? "h-2 bg-success" : "h-2 bg-primary"} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </View>
      <Text className="text-xs text-foreground w-10 text-right">{percent}%</Text>
    </View>
  );
}

function Action({ label, onPress, disabled, busy, tone = "secondary" }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; tone?: "primary" | "secondary" | "danger" }) {
  const cls = tone === "primary" ? "bg-primary border-primary" : tone === "danger" ? "bg-surface border-error" : "bg-surface border-border";
  const text = tone === "primary" ? "text-primaryForeground" : "text-foreground";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [{ opacity: pressed || disabled || busy ? 0.55 : 1 }]} className={`min-h-[44px] min-w-[44px] px-4 rounded-xl border items-center justify-center ${cls}`}>
      <Text className={`text-sm font-semibold ${text}`}>{busy ? `${label}…` : label}</Text>
    </Pressable>
  );
}

function time(ts: string) {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleTimeString();
}

export default function DevPreviewScreen() {
  const utils = trpc.useUtils();
  const { width } = useWindowDimensions();
  const wide = width >= 1024;
  const { isAuthenticated, loading: authLoading } = useAuth();
  const enabled = isAuthenticated && !authLoading;
  const [actionError, setActionError] = useState<string | null>(null);

  const statusQuery = trpc.devPreview.status.useQuery(undefined, { enabled, retry: false, refetchInterval: 2000 });
  const progressQuery = trpc.devPreview.progress.useQuery(undefined, { enabled, retry: false, refetchInterval: 15_000 });
  const activityQuery = trpc.devPreview.activity.useQuery({ limit: 40 }, { enabled, retry: false, refetchInterval: 3000 });
  const start = trpc.devPreview.start.useMutation();
  const restart = trpc.devPreview.restart.useMutation();
  const stop = trpc.devPreview.stop.useMutation();
  const refresh = trpc.devPreview.refresh.useMutation();

  const status = statusQuery.data;
  const progress = progressQuery.data;
  const entries = activityQuery.data?.entries ?? [];
  const busy = start.isPending || restart.isPending || stop.isPending || refresh.isPending;
  const state = status?.state ?? "stopped";

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      await Promise.all([utils.devPreview.status.invalidate(), utils.devPreview.activity.invalidate()]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The preview action failed.");
    }
  };

  const mixedContent = useMemo(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !status?.previewUrl) return false;
    return window.location.protocol === "https:" && status.previewUrl.startsWith("http:");
  }, [status?.previewUrl]);

  if (authLoading) return <ScreenContainer className="p-6 items-center justify-center"><Text className="text-foreground text-base">Checking your Geminio OS session…</Text></ScreenContainer>;
  if (!isAuthenticated) return <ScreenContainer className="p-6 items-center justify-center"><Text className="text-foreground text-base">Sign in to use the development preview.</Text></ScreenContainer>;
  if (statusQuery.error) {
    const forbidden = /admin|forbidden|permission/i.test(statusQuery.error.message);
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <View className="max-w-md w-full rounded-2xl border border-border bg-surface p-5 gap-2">
          <Text className="text-lg font-semibold text-foreground">{forbidden ? "Administrator access required" : "Preview status is unavailable"}</Text>
          <Text className="text-sm text-muted">{statusQuery.error.message}</Text>
          <Action label="Retry" onPress={() => void statusQuery.refetch()} />
        </View>
      </ScreenContainer>
    );
  }

  const canStart = Boolean(status?.enabled) && (state === "stopped" || state === "failed");
  const active = state !== "stopped" && state !== "failed";
  const frameHeight = wide ? 640 : 460;

  const previewPane = (
    <View className="gap-3">
      <View className="rounded-2xl border border-border bg-surface p-4 gap-3">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <View accessible accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={`Preview status: ${STATE_LABEL[state] ?? state}`}>
            <Text className="text-xs text-muted">Status</Text>
            <Text className="text-lg font-semibold text-foreground">{STATE_LABEL[state] ?? state}</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Action label="Start" tone="primary" onPress={() => void run(() => start.mutateAsync())} disabled={!canStart} busy={start.isPending} />
            <Action label="Restart" onPress={() => void run(() => restart.mutateAsync())} disabled={!status?.enabled || state === "stopped"} busy={restart.isPending} />
            <Action label="Refresh" onPress={() => void run(() => refresh.mutateAsync())} disabled={state !== "running" && state !== "ready"} busy={refresh.isPending} />
            <Action label="Stop" tone="danger" onPress={() => void run(() => stop.mutateAsync())} disabled={!active} busy={stop.isPending} />
          </View>
        </View>
        <View className="gap-1">
          <Text className="text-xs text-muted">Version: {status?.version.packageVersion ?? "unknown"}{status?.version.gitCommit ? ` · ${status.version.gitCommit}${status.version.gitDirty ? " (uncommitted changes)" : ""}` : " · no git metadata"}</Text>
          <Text className="text-xs text-muted">Preview URL: {status?.previewUrl ?? "not available"} · API port: {status?.apiPort ?? "—"} · Metro port: {status?.metroPort ?? "—"}</Text>
          <Text className="text-xs text-muted">Reload revision {status?.revision ?? 0}{status?.lastRebuildAt ? ` · last rebuild ${time(status.lastRebuildAt)}` : " · no rebuild observed yet"} · Runner job {status?.runnerState ?? "none"}</Text>
        </View>
        {actionError && <Text accessibilityRole="alert" className="text-sm text-errorText">{actionError}</Text>}
      </View>

      {status && !status.enabled && (
        <View className="rounded-2xl border border-warning bg-surface p-4 gap-1" accessibilityRole="alert">
          <Text className="text-base font-semibold text-foreground">Preview is disabled</Text>
          <Text className="text-sm text-muted">{status.disabledReason}</Text>
        </View>
      )}

      {status?.error && (
        <View className="rounded-2xl border border-error bg-surface p-4 gap-2" accessibilityRole="alert">
          <Text className="text-base font-semibold text-foreground">✕ {status.error.title}</Text>
          <Text className="text-sm text-muted">{status.error.hint}</Text>
          <Text className="text-xs text-muted">Phase: {status.error.phase}{status.error.exitCode !== null ? ` · exit code ${status.error.exitCode}` : ""}</Text>
        </View>
      )}

      {status && status.warnings.length > 0 && !status.error && (
        <View className="rounded-2xl border border-warning bg-surface p-4 gap-1" accessibilityRole="alert">
          {status.warnings.map((w) => <Text key={w} className="text-sm text-foreground">! {w}{w === "Database unavailable" && status.dependencies.databaseDetail ? ` — ${status.dependencies.databaseDetail}` : ""}</Text>)}
        </View>
      )}

      <View className="rounded-2xl border border-border bg-surface overflow-hidden" style={{ minHeight: frameHeight }}>
        {status?.previewUrl && Platform.OS === "web" && !mixedContent ? (
          createElement("iframe", { key: `${status.jobId}-${status.revision}`, src: status.previewUrl, title: "Geminio OS live preview", style: { width: "100%", height: frameHeight, border: 0, background: "#fff" }, sandbox: "allow-scripts allow-same-origin allow-forms allow-popups allow-modals" })
        ) : status?.previewUrl ? (
          <View className="p-5 gap-3 items-start">
            <Text className="text-sm text-foreground">{mixedContent ? "This page is served over HTTPS, so the browser blocks embedding the HTTP preview." : "Embedding is available on web. Open the preview in your browser instead."}</Text>
            <Text className="text-xs text-muted">If the URL uses localhost it only works on the machine running the dev server; set GEMINIO_DEV_PREVIEW_PUBLIC_URL for remote access.</Text>
            <Action label="Open preview in browser" tone="primary" onPress={() => void Linking.openURL(status.previewUrl!)} />
          </View>
        ) : (
          <View className="p-6 items-center justify-center gap-2" style={{ minHeight: frameHeight }}>
            <Text className="text-base font-semibold text-foreground">{state === "stopped" ? "No preview is running" : state === "failed" ? "Preview failed to start" : "Preparing the preview…"}</Text>
            <Text className="text-sm text-muted text-center">{state === "stopped" ? (status?.enabled ? "Press Start to install dependencies if needed, build, and run the Geminio OS dev server." : "Enable the development preview to start it.") : state === "failed" ? "See the error above and the output below. Fix the cause, then press Restart." : `Current step: ${STATE_LABEL[state] ?? state}. The preview appears here once the dev server is running.`}</Text>
          </View>
        )}
      </View>

      {status && status.outputTail.length > 0 && (
        <View className="rounded-2xl border border-border bg-surface p-3 gap-1">
          <Text className="text-xs font-semibold text-foreground">Process output (secrets redacted)</Text>
          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
            {status.outputTail.map((line, i) => <Text key={`${i}-${line.slice(0, 12)}`} className="text-xs text-muted" style={{ fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) }}>{line}</Text>)}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const progressPane = (
    <View className="gap-3">
      <View className="rounded-2xl border border-border bg-surface p-4 gap-3">
        <Text className="text-base font-semibold text-foreground">Build Progress</Text>
        {progressQuery.isLoading && <Text className="text-sm text-muted">Reading BLUEPRINT_IMPLEMENTATION_MATRIX.md…</Text>}
        {progress && !progress.available && <Text className="text-sm text-errorText">{progress.reason}</Text>}
        {progress && progress.available && (
          <>
            <Text className="text-xs text-muted">Derived from {progress.rows} matrix rows. “Implemented” = repository-side code exists but is not runtime-verified; “Verified” = confirmed by a real run.</Text>
            <View className="gap-1">
              <Text className="text-sm font-semibold text-foreground">Overall</Text>
              <Bar percent={progress.overall.builtPercent} label="Implemented" tone="primary" />
              <Bar percent={progress.overall.verifiedPercent} label="Verified" tone="success" />
              <Text className="text-xs text-muted">{progress.overall.counts.missing} missing · {progress.overall.counts.in_progress} in progress ({progress.overall.broken} broken) · {progress.overall.counts.implemented} implemented · {progress.overall.counts.verified} verified · {progress.overall.counts.blocked} blocked</Text>
            </View>
            {progress.problems.length > 0 && <Text accessibilityRole="alert" className="text-xs text-errorText">Matrix integrity problems: {progress.problems.join("; ")}</Text>}
            {progress.areas.map((a) => (
              <View key={a.area} className="gap-1 pt-2 border-t border-border">
                <Text className="text-sm font-semibold text-foreground">{a.area}</Text>
                <Bar percent={a.builtPercent} label="Implemented" tone="primary" />
                <Bar percent={a.verifiedPercent} label="Verified" tone="success" />
                <Text className="text-xs text-muted">{a.counts.missing} missing · {a.counts.in_progress} in progress{a.broken ? ` (${a.broken} broken)` : ""} · {a.counts.implemented} implemented · {a.counts.verified} verified · {a.counts.blocked} blocked</Text>
              </View>
            ))}
          </>
        )}
      </View>

      <View className="rounded-2xl border border-border bg-surface p-4 gap-2">
        <Text className="text-base font-semibold text-foreground">Activity</Text>
        {activityQuery.isLoading && <Text className="text-sm text-muted">Loading activity…</Text>}
        {!activityQuery.isLoading && entries.length === 0 && <Text className="text-sm text-muted">No activity recorded yet. Entries appear when the preview supervisor runs a step or the agent records one with `pnpm dev:activity "message"`.</Text>}
        {entries.map((e, i) => (
          <View key={`${e.ts}-${i}`} className="gap-0.5">
            <Text className={`text-sm ${e.level === "error" ? "text-errorText" : e.level === "warning" ? "text-warningText" : "text-foreground"}`}>{i === 0 ? "Now: " : ""}{e.level === "error" ? "✕ " : e.level === "warning" ? "! " : ""}{e.message}</Text>
            <Text className="text-xs text-muted">{time(e.ts)} · {e.source}</Text>
            {e.detail ? <Text className="text-xs text-muted" style={{ fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) }}>{e.detail}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ padding: wide ? 32 : 16 }}>
        <View className="mx-auto w-full" style={{ maxWidth: 1400 }}>
          <Text className="text-2xl font-semibold text-foreground mb-3">Development Preview</Text>
          {wide ? (
            <View className="flex-row gap-6">
              <View style={{ flex: 3 }}>{previewPane}</View>
              <View style={{ flex: 2 }}>{progressPane}</View>
            </View>
          ) : (
            <View className="gap-4">{previewPane}{progressPane}</View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
