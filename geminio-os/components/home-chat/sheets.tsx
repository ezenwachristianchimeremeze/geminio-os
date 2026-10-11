import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import type { ChatMessage } from "./message-bubble";

type ConvSummary = { id: string; title: string; pinned: boolean; status: "active" | "archived"; shared: boolean; lastMessageAt: Date | string };

function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable accessibilityLabel="Close" accessibilityRole="button" style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityLabel={title}>
        <View style={styles.sheetHead}><Text accessibilityRole="header" style={{ color: c.foreground, fontSize: 18, fontWeight: "700", flex: 1 }}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} onPress={onClose} style={styles.hit}><Text style={{ color: c.muted, fontSize: 18 }}>✕</Text></Pressable></View>
        {children}
      </View>
    </Modal>
  );
}
function Row({ label, onPress, danger, sub }: { label: string; onPress: () => void; danger?: boolean; sub?: string }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ focused }: any) => [styles.row, { borderColor: focused ? c.focus : "transparent" }]}>
      <Text style={{ color: danger ? c.errorText : c.foreground, fontSize: 16 }}>{label}</Text>{sub ? <Text style={{ color: c.muted, fontSize: 12 }}>{sub}</Text> : null}
    </Pressable>
  );
}

// ---------------- history ----------------
export function HistorySheet({ visible, onClose, currentId, onOpen, onNew, onMenu }: { visible: boolean; onClose: () => void; currentId: string | null; onOpen: (id: string) => void; onNew: (temporary: boolean) => void; onMenu: (c: ConvSummary) => void }) {
  const c = useColors(); const [q, setQ] = useState(""); const [archived, setArchived] = useState(false); const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  const list = trpc.homeChat.conversations.list.useQuery({ archived, query: dq || undefined, limit: 50 }, { enabled: visible });
  return (
    <Sheet visible={visible} onClose={onClose} title="Conversations">
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <Pressable accessibilityRole="button" style={[styles.primary, { backgroundColor: c.primary }]} onPress={() => { onNew(false); onClose(); }}><Text style={{ color: c.primaryForeground, fontWeight: "700" }}>＋ New chat</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="New temporary chat" style={[styles.primary, { backgroundColor: c.surfaceMuted }]} onPress={() => { onNew(true); onClose(); }}><Text style={{ color: c.foreground }}>Temporary</Text></Pressable>
      </View>
      <TextInput value={q} onChangeText={setQ} placeholder="Search conversations" placeholderTextColor={c.muted} accessibilityLabel="Search conversations" style={[styles.search, { color: c.foreground, borderColor: c.border, backgroundColor: c.background }]} />
      <View style={{ flexDirection: "row", gap: 8, marginVertical: 8 }}>
        {[false, true].map((a) => <Pressable key={String(a)} accessibilityRole="tab" accessibilityState={{ selected: archived === a }} onPress={() => setArchived(a)} style={[styles.tab, { backgroundColor: archived === a ? c.surfaceMuted : "transparent", borderColor: c.border }]}><Text style={{ color: archived === a ? c.primaryText : c.muted, fontWeight: "600" }}>{a ? "Archived" : "Recent"}</Text></Pressable>)}
      </View>
      <ScrollView style={{ maxHeight: 420 }}>
        {list.isLoading ? <ActivityIndicator color={c.primaryText} /> : null}
        {list.error ? <Text accessibilityRole="alert" style={{ color: c.errorText }}>Couldn't load conversations: {list.error.message}</Text> : null}
        {list.data && list.data.length === 0 ? <Text style={{ color: c.muted, padding: 12 }}>{dq ? "No conversations match your search." : archived ? "No archived conversations." : "No conversations yet. Say hello!"}</Text> : null}
        {(list.data ?? []).map((cv) => (
          <View key={cv.id} style={[styles.convRow, { backgroundColor: cv.id === currentId ? c.surfaceMuted : "transparent" }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Open conversation ${cv.title}`} style={{ flex: 1, minHeight: 44, justifyContent: "center" }} onPress={() => { onOpen(cv.id); onClose(); }}>
              <Text numberOfLines={1} style={{ color: c.foreground, fontSize: 16 }}>{cv.pinned ? "📌 " : ""}{cv.title}</Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>{new Date(cv.lastMessageAt).toLocaleString()}{cv.shared ? " · shared" : ""}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`More actions for ${cv.title}`} style={styles.hit} onPress={() => onMenu(cv as ConvSummary)}><Text style={{ color: c.muted, fontSize: 20 }}>⋯</Text></Pressable>
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}

// ---------------- conversation menu (rename / pin / archive / share / export / delete) ----------------
export function ConversationMenu({ target, onClose, onChanged, onDeleted, onNotice }: { target: ConvSummary | null; onClose: () => void; onChanged: () => void; onDeleted: (id: string) => void; onNotice: (m: string) => void }) {
  const c = useColors(); const utils = trpc.useUtils();
  const [mode, setMode] = useState<"menu" | "rename" | "delete" | "share">("menu"); const [title, setTitle] = useState(""); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [token, setToken] = useState<string | null>(null);
  useEffect(() => { setMode("menu"); setTitle(target?.title ?? ""); setErr(null); setToken(null); }, [target?.id]);
  const rename = trpc.homeChat.conversations.rename.useMutation(); const pin = trpc.homeChat.conversations.pin.useMutation(); const archive = trpc.homeChat.conversations.archive.useMutation();
  const del = trpc.homeChat.conversations.delete.useMutation(); const share = trpc.homeChat.conversations.share.useMutation(); const exp = trpc.homeChat.conversations.export.useMutation();
  if (!target) return null;
  const run = async (fn: () => Promise<unknown>, ok?: string, close = true) => { setBusy(true); setErr(null); try { await fn(); await utils.homeChat.conversations.invalidate(); onChanged(); if (ok) onNotice(ok); if (close) onClose(); } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); } };
  const shareUrl = (t: string) => `${Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : (process.env.EXPO_PUBLIC_API_BASE_URL ?? "")}/shared/${t}`;
  const doExport = (format: "markdown" | "json") => run(async () => {
    const r = await exp.mutateAsync({ id: target.id, format });
    if (Platform.OS === "web" && typeof document !== "undefined") { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([r.content], { type: r.mimeType })); a.download = r.filename; a.click(); URL.revokeObjectURL(a.href); onNotice(`Exported ${r.filename}`); }
    else { const { copyText } = await import("@/lib/home-chat/platform"); onNotice((await copyText(r.content)) ? `Export copied to clipboard (${r.filename})` : "Export is ready but this device can't copy it."); }
  });
  return (
    <Sheet visible onClose={onClose} title={target.title}>
      {err ? <Text accessibilityRole="alert" style={{ color: c.errorText, marginBottom: 8 }}>⚠ {err}</Text> : null}
      {mode === "menu" && (
        <>
          <Row label="Rename" onPress={() => setMode("rename")} />
          <Row label={target.pinned ? "Unpin" : "Pin to top"} onPress={() => run(() => pin.mutateAsync({ id: target.id, pinned: !target.pinned }))} />
          <Row label={target.status === "archived" ? "Unarchive" : "Archive"} onPress={() => run(() => archive.mutateAsync({ id: target.id, archived: target.status !== "archived" }), target.status === "archived" ? "Conversation restored" : "Conversation archived")} />
          <Row label="Share link…" sub="Anyone with the link can read a snapshot; you can revoke it" onPress={() => setMode("share")} />
          <Row label="Export as Markdown" onPress={() => doExport("markdown")} /><Row label="Export as JSON" onPress={() => doExport("json")} />
          <Row label="Delete…" danger onPress={() => setMode("delete")} />
        </>
      )}
      {mode === "rename" && (
        <View style={{ gap: 8 }}>
          <TextInput value={title} onChangeText={setTitle} maxLength={120} autoFocus accessibilityLabel="Conversation title" style={[styles.search, { color: c.foreground, borderColor: c.border, backgroundColor: c.background }]} />
          <Pressable accessibilityRole="button" disabled={busy || !title.trim()} style={[styles.primary, { backgroundColor: c.primary, opacity: busy || !title.trim() ? 0.5 : 1 }]} onPress={() => run(() => rename.mutateAsync({ id: target.id, title }), "Renamed")}><Text style={{ color: c.primaryForeground, fontWeight: "700" }}>Save</Text></Pressable>
        </View>
      )}
      {mode === "share" && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.muted }}>{token || target.shared ? "This conversation has a share link. Anyone with it can read the conversation as it is now plus later messages until you stop sharing." : "Create a read-only link. Only messages and sources are visible; your account details are not."}</Text>
          {token ? <Text selectable style={{ color: c.foreground }}>{shareUrl(token)}</Text> : null}
          <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary, { backgroundColor: c.primary }]} onPress={() => run(async () => { const r = await share.mutateAsync({ id: target.id, enabled: true }); setToken(r.token); const { copyText } = await import("@/lib/home-chat/platform"); onNotice((await copyText(shareUrl(r.token!))) ? "Link copied" : "Link created"); }, undefined, false)}><Text style={{ color: c.primaryForeground, fontWeight: "700" }}>{target.shared || token ? "Copy link" : "Create & copy link"}</Text></Pressable>
          {target.shared || token ? <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary, { backgroundColor: c.surfaceMuted }]} onPress={() => run(() => share.mutateAsync({ id: target.id, enabled: false }), "Sharing stopped; the link no longer works")}><Text style={{ color: c.errorText, fontWeight: "700" }}>Stop sharing</Text></Pressable> : null}
        </View>
      )}
      {mode === "delete" && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.foreground }}>Delete "{target.title}" permanently? All its messages are removed and any share link stops working. This can't be undone.</Text>
          <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary, { backgroundColor: c.error }]} onPress={() => run(async () => { await del.mutateAsync({ id: target.id }); onDeleted(target.id); }, "Conversation deleted")}><Text style={{ color: c.errorForeground, fontWeight: "700" }}>{busy ? "Deleting…" : "Delete permanently"}</Text></Pressable>
          <Pressable accessibilityRole="button" style={[styles.primary, { backgroundColor: c.surfaceMuted }]} onPress={() => setMode("menu")}><Text style={{ color: c.foreground }}>Keep it</Text></Pressable>
        </View>
      )}
    </Sheet>
  );
}

// ---------------- approval cards ----------------
export type ActionCard = { id: string; type: string; resourceLabel: string; summary: string; consequences: string[]; estimatedCredits: number; reversible: boolean; reversalNote: string; status: string; result: unknown; error: string | null; expiresAt: Date | string };
export function ActionCardView({ a, busy, onDecide }: { a: ActionCard; busy: boolean; onDecide: (id: string, d: "approve" | "reject" | "cancel") => void }) {
  const c = useColors(); const pending = a.status === "pending";
  const tone = a.status === "executed" ? c.successText : a.status === "failed" || a.status === "expired" ? c.errorText : c.muted;
  const label: Record<string, string> = { pending: "Waiting for your decision", executing: "Running…", executed: "Done", failed: "Failed", rejected: "Rejected", cancelled: "Cancelled", expired: "Expired" };
  return (
    <View accessibilityLabel={`Approval request: ${a.summary}`} style={{ borderWidth: 2, borderColor: pending ? c.warning : c.border, borderRadius: 14, padding: 12, gap: 6, backgroundColor: c.surface }}>
      <Text accessibilityRole="header" style={{ color: c.foreground, fontWeight: "700" }}>Approval needed</Text>
      <Text style={{ color: c.foreground }}>{a.summary}</Text>
      <Text style={{ color: c.muted, fontSize: 13 }}>Affects: {a.resourceLabel}</Text>
      {a.consequences.map((x) => <Text key={x} style={{ color: c.foreground, fontSize: 13 }}>• {x}</Text>)}
      <Text style={{ color: c.muted, fontSize: 13 }}>Estimated credits: {a.estimatedCredits}</Text>
      <Text style={{ color: c.muted, fontSize: 12 }}>{a.reversible ? "Reversible." : `Not reversible. ${a.reversalNote}`}</Text>
      <Text accessibilityLiveRegion="polite" style={{ color: tone, fontWeight: "700" }}>{label[a.status] ?? a.status}{a.error ? `: ${a.error}` : ""}</Text>
      {a.status === "executed" && a.result && typeof (a.result as { summary?: string }).summary === "string" ? <Text style={{ color: c.foreground, fontSize: 13 }}>{(a.result as { summary: string }).summary}</Text> : null}
      {pending ? (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Approve and run this action" disabled={busy} onPress={() => onDecide(a.id, "approve")} style={[styles.primary, { backgroundColor: c.primary, flex: 0, opacity: busy ? 0.5 : 1 }]}><Text style={{ color: c.primaryForeground, fontWeight: "700" }}>Approve</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Reject this action" disabled={busy} onPress={() => onDecide(a.id, "reject")} style={[styles.primary, { backgroundColor: c.surfaceMuted, flex: 0 }]}><Text style={{ color: c.foreground }}>Reject</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel this request" disabled={busy} onPress={() => onDecide(a.id, "cancel")} style={[styles.primary, { backgroundColor: c.surfaceMuted, flex: 0 }]}><Text style={{ color: c.foreground }}>Cancel</Text></Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function ActionsSheet({ visible, onClose, onNotice }: { visible: boolean; onClose: () => void; onNotice: (m: string) => void }) {
  const c = useColors(); const utils = trpc.useUtils();
  const types = trpc.homeChat.actions.types.useQuery(undefined, { enabled: visible });
  const list = trpc.homeChat.actions.list.useQuery(undefined, { enabled: visible, refetchInterval: visible ? 4000 : false });
  const spaces = trpc.liveBuilder.list.useQuery(undefined, { enabled: visible, retry: false });
  const propose = trpc.homeChat.actions.propose.useMutation(); const decide = trpc.homeChat.actions.decide.useMutation();
  const ws = (() => { const d = spaces.data as unknown as { data?: { id: string; name?: string; title?: string }[] } | undefined; return d?.data ?? []; })();
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); await utils.homeChat.actions.list.invalidate(); } catch (e) { onNotice(e instanceof Error ? e.message : "Action failed."); } };
  return (
    <Sheet visible={visible} onClose={onClose} title="Actions that need your approval">
      <ScrollView style={{ maxHeight: 520 }}>
        <Text style={{ color: c.muted, fontSize: 12, marginBottom: 6 }}>Geminio never changes or publishes anything without showing you exactly what will happen and waiting for Approve.</Text>
        {(types.data ?? []).map((t) => (
          <View key={t.type} style={{ marginBottom: 8 }}>
            <Text style={{ color: c.foreground, fontWeight: "700" }}>{t.label}</Text>
            {!t.available ? <Text style={{ color: c.muted, fontSize: 12 }}>Not available: {t.unavailableReason}</Text> : ws.length === 0 ? <Text style={{ color: c.muted, fontSize: 12 }}>No projects found.</Text> : ws.map((w) => <Pressable key={w.id} accessibilityRole="button" accessibilityLabel={`${t.label} for ${w.name ?? w.title ?? w.id}`} onPress={() => void run(() => propose.mutateAsync({ type: t.type, workspaceId: w.id }))} style={styles.row}><Text style={{ color: c.primaryText }}>{w.name ?? w.title ?? w.id}</Text></Pressable>)}
          </View>
        ))}
        {(list.data ?? []).map((a) => <View key={a.id} style={{ marginBottom: 10 }}><ActionCardView a={a as ActionCard} busy={decide.isPending} onDecide={(id, d) => void run(() => decide.mutateAsync({ id, decision: d }))} /></View>)}
        {list.data && list.data.length === 0 ? <Text style={{ color: c.muted }}>No requests yet.</Text> : null}
      </ScrollView>
    </Sheet>
  );
}

// ---------------- code run result ----------------
export function CodeRunSheet({ run, onClose }: { run: { language: string; code: string } | null; onClose: () => void }) {
  const c = useColors(); const mut = trpc.homeChat.runCode.useMutation(); const [started, setStarted] = useState<string | null>(null);
  useEffect(() => { if (run && started !== run.code + run.language) { setStarted(run.code + run.language); mut.mutate({ language: run.language, code: run.code }); } if (!run) setStarted(null); }, [run]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!run) return null;
  const d = mut.data as any;
  return (
    <Sheet visible onClose={onClose} title={`Run ${run.language}`}>
      <ScrollView style={{ maxHeight: 420 }}>
        <Text style={{ color: c.muted, fontSize: 12, marginBottom: 6 }}>Runs in an isolated sandbox with no network access, never on the app server. Costs credits only when the code actually runs.</Text>
        {mut.isPending ? <View style={{ flexDirection: "row", gap: 8 }}><ActivityIndicator color={c.primaryText} /><Text style={{ color: c.muted }}>Running…</Text></View> : null}
        {mut.error ? <Text accessibilityRole="alert" style={{ color: c.errorText }}>⚠ {mut.error.message}</Text> : null}
        {d && d.status !== "ok" ? <Text accessibilityRole="alert" style={{ color: c.errorText }}>⚠ {d.reason}{d.retryable ? " You can try again." : ""}</Text> : null}
        {d && d.status === "ok" ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: d.exitCode === 0 && !d.timedOut ? c.successText : c.errorText, fontWeight: "700" }}>{d.timedOut ? "Timed out" : d.exitCode === 0 ? "Finished" : `Exited with code ${d.exitCode}`} · {d.durationMs} ms{d.truncated ? " · output truncated" : ""}</Text>
            {d.stdout ? <><Text style={{ color: c.muted, fontSize: 12 }}>Output</Text><Text selectable style={{ color: c.foreground, fontFamily: "monospace", fontSize: 13 }}>{d.stdout}</Text></> : null}
            {d.stderr ? <><Text style={{ color: c.muted, fontSize: 12 }}>Errors</Text><Text selectable style={{ color: c.errorText, fontFamily: "monospace", fontSize: 13 }}>{d.stderr}</Text></> : null}
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

// ---------------- schedules ----------------
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function SchedulesSheet({ visible, onClose, onNotice }: { visible: boolean; onClose: () => void; onNotice: (m: string) => void }) {
  const c = useColors(); const utils = trpc.useUtils();
  const list = trpc.homeChat.schedules.list.useQuery(undefined, { enabled: visible });
  const create = trpc.homeChat.schedules.create.useMutation(); const setStatus = trpc.homeChat.schedules.setStatus.useMutation(); const del = trpc.homeChat.schedules.delete.useMutation();
  const [adding, setAdding] = useState(false); const [kind, setKind] = useState<"reminder" | "prompt">("reminder"); const [title, setTitle] = useState(""); const [prompt, setPrompt] = useState("");
  const [time, setTime] = useState("09:00"); const [rep, setRep] = useState<"once" | "daily" | "weekly">("daily"); const [days, setDays] = useState<number[]>([1]); const [date, setDate] = useState(""); const [err, setErr] = useState<string | null>(null);
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } })();
  const reset = () => { setAdding(false); setTitle(""); setPrompt(""); setErr(null); };
  const save = async () => {
    setErr(null);
    try {
      await create.mutateAsync({ kind, title, prompt: kind === "prompt" ? prompt : null, recurrence: rep === "weekly" ? { kind: "weekly", days } : { kind: rep }, timezone: tz, timeOfDay: time, onceDate: rep === "once" ? date : undefined });
      await utils.homeChat.schedules.list.invalidate(); onNotice("Schedule saved"); reset();
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save."); }
  };
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); await utils.homeChat.schedules.list.invalidate(); onNotice(ok); } catch (e) { onNotice(e instanceof Error ? e.message : "Action failed."); } };
  const input = [styles.search, { color: c.foreground, borderColor: c.border, backgroundColor: c.background }];
  return (
    <Sheet visible={visible} onClose={onClose} title="Reminders & schedules">
      <ScrollView style={{ maxHeight: 520 }}>
        {!adding ? <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={[styles.primary, { backgroundColor: c.primary, flex: 0, marginBottom: 8 }]}><Text style={{ color: c.primaryForeground, fontWeight: "700" }}>＋ New reminder or task</Text></Pressable> : (
          <View style={{ gap: 8, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>{(["reminder", "prompt"] as const).map((k) => <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: kind === k }} onPress={() => setKind(k)} style={[styles.tab, { backgroundColor: kind === k ? c.surfaceMuted : "transparent", borderColor: c.border }]}><Text style={{ color: kind === k ? c.primaryText : c.muted, fontWeight: "600" }}>{k === "reminder" ? "Reminder" : "AI task"}</Text></Pressable>)}</View>
            <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="Title" placeholderTextColor={c.muted} accessibilityLabel="Title" style={input} />
            {kind === "prompt" ? <TextInput value={prompt} onChangeText={setPrompt} multiline maxLength={2000} placeholder="What should Geminio do each time? (uses credits when it runs)" placeholderTextColor={c.muted} accessibilityLabel="Task prompt" style={[...input, { minHeight: 80 }]} /> : null}
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{(["once", "daily", "weekly"] as const).map((r) => <Pressable key={r} accessibilityRole="radio" accessibilityState={{ selected: rep === r }} onPress={() => setRep(r)} style={[styles.tab, { backgroundColor: rep === r ? c.surfaceMuted : "transparent", borderColor: c.border }]}><Text style={{ color: rep === r ? c.primaryText : c.muted }}>{r}</Text></Pressable>)}</View>
            {rep === "once" ? <TextInput value={date} onChangeText={setDate} maxLength={10} placeholder="Date YYYY-MM-DD" placeholderTextColor={c.muted} accessibilityLabel="Date" style={input} /> : null}
            {rep === "weekly" ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{DAYS.map((d, i) => { const on = days.includes(i); return <Pressable key={d} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setDays(kind === "prompt" ? [i] : on ? days.filter((x) => x !== i) : [...days, i])} style={[styles.tab, { backgroundColor: on ? c.surfaceMuted : "transparent", borderColor: c.border }]}><Text style={{ color: on ? c.primaryText : c.muted }}>{d}</Text></Pressable>; })}</View> : null}
            <TextInput value={time} onChangeText={setTime} maxLength={5} placeholder="HH:MM (24h)" placeholderTextColor={c.muted} accessibilityLabel="Time of day" style={input} />
            <Text style={{ color: c.muted, fontSize: 12 }}>Timezone: {tz}. AI tasks run at most once a day and are metered like any other request; if credits are short the run is skipped and you're notified.</Text>
            {err ? <Text accessibilityRole="alert" style={{ color: c.errorText }}>⚠ {err}</Text> : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable accessibilityRole="button" onPress={() => void save()} disabled={create.isPending} style={[styles.primary, { backgroundColor: c.primary }]}><Text style={{ color: c.primaryForeground, fontWeight: "700" }}>{create.isPending ? "Saving…" : "Save"}</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={reset} style={[styles.primary, { backgroundColor: c.surfaceMuted }]}><Text style={{ color: c.foreground }}>Cancel</Text></Pressable>
            </View>
          </View>
        )}
        {list.isLoading ? <ActivityIndicator color={c.primaryText} /> : null}
        {list.error ? <Text accessibilityRole="alert" style={{ color: c.errorText }}>Couldn't load schedules: {list.error.message}</Text> : null}
        {list.data && list.data.length === 0 && !adding ? <Text style={{ color: c.muted, padding: 8 }}>Nothing scheduled.</Text> : null}
        {(list.data ?? []).map((r) => (
          <View key={r.id} style={{ paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border }}>
            <Text style={{ color: c.foreground, fontSize: 15 }}>{r.kind === "reminder" ? "⏰" : "🤖"} {r.title}</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>{r.status === "active" && r.nextRunAt ? `Next: ${new Date(r.nextRunAt).toLocaleString()}` : r.status === "completed" ? "Finished" : "Paused"} · {r.timeOfDay} {r.timezone}</Text>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {r.status !== "completed" ? <Pressable accessibilityRole="button" accessibilityLabel={`${r.status === "active" ? "Pause" : "Resume"} ${r.title}`} onPress={() => void act(() => setStatus.mutateAsync({ id: r.id, status: r.status === "active" ? "paused" : "active" }), r.status === "active" ? "Paused" : "Resumed (missed runs are not replayed)")} style={styles.hit}><Text style={{ color: c.foreground }}>{r.status === "active" ? "Pause" : "Resume"}</Text></Pressable> : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${r.title}`} onPress={() => void act(() => del.mutateAsync({ id: r.id }), "Deleted")} style={styles.hit}><Text style={{ color: c.errorText }}>Delete</Text></Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}

// ---------------- task queue ----------------
export function TasksSheet({ visible, onClose, onOpenConversation, onNotice }: { visible: boolean; onClose: () => void; onOpenConversation: (id: string) => void; onNotice: (m: string) => void }) {
  const c = useColors(); const utils = trpc.useUtils();
  const list = trpc.homeChat.tasks.list.useQuery({ limit: 20 }, { enabled: visible, refetchInterval: visible ? 3000 : false });
  const pause = trpc.homeChat.tasks.pause.useMutation(); const resume = trpc.homeChat.tasks.resume.useMutation(); const stop = trpc.homeChat.stop.useMutation();
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); onNotice(ok); await utils.homeChat.tasks.list.invalidate(); } catch (e) { onNotice(e instanceof Error ? e.message : "Action failed."); } };
  const label: Record<string, string> = { accepted: "Queued", planning: "Planning", executing: "Running", waiting_for_approval: "Needs approval", paused: "Paused", verifying: "Validating", completed: "Completed", failed: "Failed", cancelled: "Cancelled" };
  return (
    <Sheet visible={visible} onClose={onClose} title="Tasks">
      <ScrollView style={{ maxHeight: 480 }}>
        {list.isLoading ? <ActivityIndicator color={c.primaryText} /> : null}
        {list.error ? <Text accessibilityRole="alert" style={{ color: c.errorText }}>Couldn't load tasks: {list.error.message}</Text> : null}
        {list.data && list.data.length === 0 ? <Text style={{ color: c.muted, padding: 12 }}>No tasks yet.</Text> : null}
        {(list.data ?? []).map((t) => (
          <View key={t.runId} style={[styles.convRow, { flexDirection: "column", alignItems: "stretch", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border }]}>
            <Text numberOfLines={1} style={{ color: c.foreground, fontSize: 15 }}>{t.title}</Text>
            <Text style={{ color: t.status === "failed" ? c.errorText : c.muted, fontSize: 12 }}>{label[t.status] ?? t.status}{t.stepsTotal > 1 ? ` · step ${Math.min(t.stepsCompleted + (t.currentStep ? 1 : 0), t.stepsTotal)} of ${t.stepsTotal}` : ""}{t.currentStep ? ` · ${t.currentStep}` : ""} · {new Date(t.updatedAt).toLocaleString()}</Text>
            {t.error ? <Text style={{ color: c.errorText, fontSize: 12 }}>⚠ {t.error}</Text> : null}
            <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
              {t.conversationId ? <Pressable accessibilityRole="button" accessibilityLabel={`Open conversation for ${t.title}`} onPress={() => { onOpenConversation(t.conversationId!); onClose(); }} style={styles.hit}><Text style={{ color: c.primaryText }}>Open</Text></Pressable> : null}
              {t.canPause ? <Pressable accessibilityRole="button" accessibilityLabel={`Pause ${t.title}`} onPress={() => void act(() => pause.mutateAsync({ runId: t.runId }), "Pause requested — the current step finishes first")} style={styles.hit}><Text style={{ color: c.foreground }}>Pause</Text></Pressable> : null}
              {t.canResume ? <Pressable accessibilityRole="button" accessibilityLabel={`Resume ${t.title}`} onPress={() => void act(() => resume.mutateAsync({ runId: t.runId }), "Resumed")} style={styles.hit}><Text style={{ color: c.primaryText, fontWeight: "700" }}>Resume</Text></Pressable> : null}
              {t.canCancel ? <Pressable accessibilityRole="button" accessibilityLabel={`Cancel ${t.title}`} onPress={() => void act(() => stop.mutateAsync({ runId: t.runId }), "Cancelled")} style={styles.hit}><Text style={{ color: c.errorText }}>Cancel</Text></Pressable> : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}

// ---------------- context controls ----------------
type CtxSel = { historyMode: "conversation" | "message_only"; conversationIds: string[]; workspaceId: string | null };
export function ContextSheet({ visible, onClose, value, onChange, currentId }: { visible: boolean; onClose: () => void; value: CtxSel; onChange: (v: CtxSel) => void; currentId: string | null }) {
  const c = useColors();
  const convs = trpc.homeChat.conversations.list.useQuery({ archived: false, limit: 30 }, { enabled: visible });
  const spaces = trpc.liveBuilder.list.useQuery(undefined, { enabled: visible, retry: false });
  const toggleConv = (id: string) => onChange({ ...value, conversationIds: value.conversationIds.includes(id) ? value.conversationIds.filter((x) => x !== id) : value.conversationIds.length >= 3 ? value.conversationIds : [...value.conversationIds, id] });
  const workspaces = ((spaces.data as unknown as { data?: { id: string; name?: string; title?: string }[] } | { id: string; name?: string; title?: string }[] | undefined) ?? []);
  const wsList = Array.isArray(workspaces) ? workspaces : workspaces.data ?? [];
  return (
    <Sheet visible={visible} onClose={onClose} title="What Geminio can see">
      <Text style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>Geminio only uses what you choose here. Shared items are treated as reference data, never as instructions. Secret files are never sent.</Text>
      <ScrollView style={{ maxHeight: 460 }}>
        <Text style={{ color: c.foreground, fontWeight: "700", marginBottom: 4 }}>This conversation</Text>
        {(["conversation", "message_only"] as const).map((m) => <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: value.historyMode === m }} onPress={() => onChange({ ...value, historyMode: m })} style={styles.row}><Text style={{ color: value.historyMode === m ? c.primaryText : c.foreground }}>{value.historyMode === m ? "◉" : "○"} {m === "conversation" ? "Use earlier messages in this chat" : "Current message only (no earlier messages)"}</Text></Pressable>)}
        <Text style={{ color: c.foreground, fontWeight: "700", marginTop: 12, marginBottom: 4 }}>Other conversations (up to 3)</Text>
        {(convs.data ?? []).filter((x) => x.id !== currentId).map((x) => { const on = value.conversationIds.includes(x.id); return <Pressable key={x.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggleConv(x.id)} style={styles.row}><Text numberOfLines={1} style={{ color: on ? c.primaryText : c.foreground }}>{on ? "☑" : "☐"} {x.title}</Text></Pressable>; })}
        {convs.data && convs.data.filter((x) => x.id !== currentId).length === 0 ? <Text style={{ color: c.muted }}>No other conversations.</Text> : null}
        <Text style={{ color: c.foreground, fontWeight: "700", marginTop: 12, marginBottom: 4 }}>Project files</Text>
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: value.workspaceId === null }} onPress={() => onChange({ ...value, workspaceId: null })} style={styles.row}><Text style={{ color: value.workspaceId === null ? c.primaryText : c.foreground }}>{value.workspaceId === null ? "◉" : "○"} None</Text></Pressable>
        {wsList.map((w) => <Pressable key={w.id} accessibilityRole="radio" accessibilityState={{ selected: value.workspaceId === w.id }} onPress={() => onChange({ ...value, workspaceId: w.id })} style={styles.row}><Text numberOfLines={1} style={{ color: value.workspaceId === w.id ? c.primaryText : c.foreground }}>{value.workspaceId === w.id ? "◉" : "○"} {w.name ?? w.title ?? w.id}</Text></Pressable>)}
        {spaces.error ? <Text style={{ color: c.muted, fontSize: 12 }}>Projects aren't available right now.</Text> : null}
      </ScrollView>
      <Pressable accessibilityRole="button" onPress={() => { onChange({ historyMode: "conversation", conversationIds: [], workspaceId: null }); }} style={[styles.primary, { backgroundColor: c.surfaceMuted, marginTop: 10, flex: 0 }]}><Text style={{ color: c.foreground }}>Reset to default</Text></Pressable>
    </Sheet>
  );
}

// ---------------- personalization ----------------
export function PersonalizationSheet({ visible, onClose, onNotice }: { visible: boolean; onClose: () => void; onNotice: (m: string) => void }) {
  const c = useColors(); const q = trpc.homeChat.preferences.get.useQuery(undefined, { enabled: visible }); const save = trpc.homeChat.preferences.set.useMutation();
  const [instr, setInstr] = useState(""); const [style, setStyle] = useState<"concise" | "balanced" | "detailed">("balanced"); const [lang, setLang] = useState(""); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (q.data) { setInstr(q.data.customInstructions); setStyle(q.data.responseStyle); setLang(q.data.language ?? ""); } }, [q.data]);
  const submit = async () => { setErr(null); try { await save.mutateAsync({ customInstructions: instr, responseStyle: style, language: lang.trim() || null, aiLevel: q.data?.aiLevel ?? "standard" }); onNotice("Preferences saved"); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save."); } };
  return (
    <Sheet visible={visible} onClose={onClose} title="Personalization">
      {q.isLoading ? <ActivityIndicator color={c.primaryText} /> : null}
      {q.error ? <Text accessibilityRole="alert" style={{ color: c.errorText }}>Couldn't load preferences: {q.error.message}</Text> : null}
      {err ? <Text accessibilityRole="alert" style={{ color: c.errorText }}>⚠ {err}</Text> : null}
      <Text style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>Custom instructions (shape tone and format; they can't change safety rules)</Text>
      <TextInput value={instr} onChangeText={setInstr} multiline maxLength={1500} accessibilityLabel="Custom instructions" placeholder="e.g. I'm a TypeScript developer. Prefer short answers." placeholderTextColor={c.muted} style={[styles.search, { color: c.foreground, borderColor: c.border, backgroundColor: c.background, minHeight: 100 }]} />
      <View style={{ flexDirection: "row", gap: 8, marginVertical: 10 }}>
        {(["concise", "balanced", "detailed"] as const).map((st) => <Pressable key={st} accessibilityRole="radio" accessibilityState={{ selected: style === st }} onPress={() => setStyle(st)} style={[styles.tab, { backgroundColor: style === st ? c.surfaceMuted : "transparent", borderColor: c.border }]}><Text style={{ color: style === st ? c.primaryText : c.muted, fontWeight: "600" }}>{st}</Text></Pressable>)}
      </View>
      <TextInput value={lang} onChangeText={setLang} maxLength={16} autoCapitalize="none" accessibilityLabel="Preferred reply language code" placeholder="Reply language code, e.g. fr or es (optional)" placeholderTextColor={c.muted} style={[styles.search, { color: c.foreground, borderColor: c.border, backgroundColor: c.background }]} />
      <Pressable accessibilityRole="button" disabled={save.isPending} onPress={submit} style={[styles.primary, { backgroundColor: c.primary, marginTop: 12, flex: 0 }]}><Text style={{ color: c.primaryForeground, fontWeight: "700" }}>{save.isPending ? "Saving…" : "Save"}</Text></Pressable>
    </Sheet>
  );
}

// ---------------- per-message "More" ----------------
export function MoreSheet({ message, onClose, onPrompt, onReport, onNotice }: { message: ChatMessage | null; onClose: () => void; onPrompt: (text: string) => void; onReport: (id: string, note: string) => void; onNotice: (m: string) => void }) {
  const c = useColors(); const [mode, setMode] = useState<"menu" | "translate" | "report" | "file">("menu"); const [val, setVal] = useState(""); const [busy, setBusy] = useState(false); const gen = trpc.homeChat.generateFile.useMutation();
  useEffect(() => { setMode("menu"); setVal(""); }, [message?.id]);
  if (!message) return null;
  const quote = (t: string) => `"""\n${t.slice(0, 6000)}\n"""`;
  return (
    <Sheet visible onClose={onClose} title="More actions">
      {mode === "menu" && (
        <>
          <Row label="Explain this" onPress={() => { onPrompt(`Explain this in simple terms:\n${quote(message.content)}`); onClose(); }} />
          <Row label="Summarize" onPress={() => { onPrompt(`Summarize this briefly:\n${quote(message.content)}`); onClose(); }} />
          <Row label="Translate…" onPress={() => setMode("translate")} />
          <Row label="Save as file…" onPress={() => setMode("file")} />
          <Row label="Report a problem…" onPress={() => setMode("report")} />
        </>
      )}
      {mode === "file" && (
        <View style={{ gap: 4 }}>
          {([["pdf", "PDF document (.pdf)"], ["docx", "Word document (.docx)"], ["xlsx", "Excel workbook from tables (.xlsx)"], ["md", "Markdown (.md)"], ["txt", "Plain text (.txt)"], ["csv", "CSV from the first table (.csv)"]] as const).map(([f, l]) => (
            <Row key={f} label={busy ? "Creating…" : l} onPress={async () => { if (busy) return; setBusy(true); try { const r = await gen.mutateAsync({ messageId: message.id, format: f }); onNotice(`Created ${r.filename} (${r.sizeBytes} bytes)`); void Linking.openURL(r.url); onClose(); } catch (e) { onNotice(e instanceof Error ? e.message : "Couldn't create the file."); } finally { setBusy(false); } }} />
          ))}
          <Text style={{ color: c.muted, fontSize: 12 }}>The file is stored, read back and checked before it is offered to you.</Text>
        </View>
      )}
      {mode === "translate" && (<View style={{ gap: 8 }}><TextInput value={val} onChangeText={setVal} placeholder="Translate into… (e.g. French)" placeholderTextColor={c.muted} autoFocus accessibilityLabel="Target language" maxLength={40} style={[styles.search, { color: c.foreground, borderColor: c.border, backgroundColor: c.background }]} />
        <Pressable accessibilityRole="button" disabled={!val.trim()} style={[styles.primary, { backgroundColor: c.primary, opacity: val.trim() ? 1 : 0.5 }]} onPress={() => { onPrompt(`Translate this into ${val.trim()}, keeping formatting:\n${quote(message.content)}`); onClose(); }}><Text style={{ color: c.primaryForeground, fontWeight: "700" }}>Translate</Text></Pressable></View>)}
      {mode === "report" && (<View style={{ gap: 8 }}><TextInput value={val} onChangeText={setVal} placeholder="What was wrong with this response?" placeholderTextColor={c.muted} multiline autoFocus maxLength={500} accessibilityLabel="Describe the problem" style={[styles.search, { color: c.foreground, borderColor: c.border, backgroundColor: c.background, minHeight: 80 }]} />
        <Pressable accessibilityRole="button" disabled={!val.trim()} style={[styles.primary, { backgroundColor: c.primary, opacity: val.trim() ? 1 : 0.5 }]} onPress={() => { onReport(message.id, val.trim()); onClose(); }}><Text style={{ color: c.primaryForeground, fontWeight: "700" }}>Submit report</Text></Pressable>
        <Text style={{ color: c.muted, fontSize: 12 }}>Saved as "not helpful" feedback with your note on this response.</Text></View>)}
    </Sheet>
  );
}
const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }, sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16, paddingBottom: 28, width: "100%", maxWidth: 640, alignSelf: "center", maxHeight: "85%" },
  sheetHead: { flexDirection: "row", alignItems: "center", marginBottom: 8 }, hit: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  row: { minHeight: 48, justifyContent: "center", borderWidth: 2, borderRadius: 10, paddingHorizontal: 8 }, primary: { minHeight: 44, borderRadius: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", flex: 1 },
  search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 44, fontSize: 16 }, tab: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, minHeight: 36, justifyContent: "center" },
  convRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingLeft: 10 },
});
