import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { VoiceState } from "@/lib/home-chat/recorder-machine";

type Att = { id: string; name: string; kind: string; sizeBytes: number };
const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

function Btn({ label, onPress, children, disabled, tone = "plain" }: { label: string; onPress: () => void; children: React.ReactNode; disabled?: boolean; tone?: "plain" | "primary" | "danger" }) {
  const c = useColors();
  const bg = tone === "primary" ? c.primary : tone === "danger" ? c.error : c.surfaceMuted;
  const fg = tone === "primary" ? c.primaryForeground : tone === "danger" ? c.errorForeground : c.foreground;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress}
      style={({ pressed, focused }: any) => [styles.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1, borderWidth: 2, borderColor: focused ? c.focus : "transparent" }]}>
      <Text style={{ color: fg, fontSize: 18, fontWeight: "700" }}>{children}</Text>
    </Pressable>
  );
}

export function Composer(p: {
  draft: string; setDraft: (v: string) => void; busy: boolean; sending: boolean; status: string | null;
  onSend: () => void; onStop: () => void; stopDisabled: boolean;
  paused: boolean; canPause: boolean; onPause: () => void; onResume: () => void;
  voice: VoiceState; voiceElapsedMs: number; micAvailable: boolean; micSupported: boolean;
  onMic: () => void; onPauseRec: () => void; onResumeRec: () => void; onStopRec: () => void; onCancelRec: () => void; onAcceptTranscript: () => void; onDismissVoice: () => void;
  attachments: Att[]; uploading: boolean; onAttachImage: () => void; onAttachDoc: () => void; onRemoveAttachment: (id: string) => void;
  webMode: "auto" | "on" | "off"; webSearchAvailable: boolean; onToggleWeb: () => void;
  planLabel: string | null; onCyclePlan: () => void;
}) {
  const c = useColors(); const [attachOpen, setAttachOpen] = useState(false); const [h, setH] = useState(44);
  const canSend = p.draft.trim().length > 0 && !p.busy && !p.uploading && p.voice.s !== "recording" && p.voice.s !== "paused" && p.voice.s !== "transcribing";
  const recording = p.voice.s === "recording" || p.voice.s === "paused";
  return (
    <View style={[styles.wrap, { backgroundColor: c.background, borderTopColor: c.border }]}>
      {p.status ? <View accessibilityLiveRegion="polite" style={styles.status}>{<ActivityIndicator size="small" color={c.primaryText} />}<Text style={{ color: c.muted, fontSize: 13 }}>{p.status}</Text></View> : null}

      {p.voice.s === "error" ? (
        <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: c.surfaceMuted, borderColor: c.error }]}>
          <Text style={{ color: c.errorText, flex: 1, fontSize: 14 }}>⚠ {p.voice.message}</Text>
          {p.voice.retryable ? <Pressable accessibilityRole="button" onPress={p.onMic} style={styles.link}><Text style={{ color: c.primaryText, fontWeight: "700" }}>Try again</Text></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss voice error" onPress={p.onDismissVoice} style={styles.link}><Text style={{ color: c.muted }}>Dismiss</Text></Pressable>
        </View>
      ) : null}

      {p.voice.s === "review" ? (
        <View style={[styles.banner, { backgroundColor: c.surfaceMuted, borderColor: c.border, flexDirection: "column", alignItems: "stretch" }]}>
          <Text style={{ color: c.muted, fontSize: 12 }}>{p.voice.uncertain ? "⚠ Low confidence — please check the transcript before sending." : "Transcript — review, then add it to your message"}</Text>
          <Text selectable style={{ color: c.foreground, fontSize: 16 }}>{p.voice.text}</Text>
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
            <Pressable accessibilityRole="button" onPress={p.onCancelRec} style={styles.link}><Text style={{ color: c.muted }}>Discard</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Add transcript to message box for editing" onPress={p.onAcceptTranscript} style={[styles.link, { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 14 }]}><Text style={{ color: c.primaryForeground, fontWeight: "700" }}>Edit & send</Text></Pressable>
          </View>
        </View>
      ) : null}

      {p.attachments.length > 0 || p.uploading ? (
        <View style={styles.chips}>
          {p.attachments.map((a) => (
            <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={`Remove attachment ${a.name}`} onPress={() => p.onRemoveAttachment(a.id)} style={[styles.chip, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
              <Text numberOfLines={1} style={{ color: c.foreground, fontSize: 13, maxWidth: 180 }}>{a.kind === "image" ? "🖼" : "📄"} {a.name}  ✕</Text>
            </Pressable>
          ))}
          {p.uploading ? <View style={[styles.chip, { borderColor: c.border }]}><ActivityIndicator size="small" color={c.primaryText} /><Text style={{ color: c.muted, fontSize: 13 }}> Uploading…</Text></View> : null}
        </View>
      ) : null}

      {recording ? (
        <View style={styles.row} accessibilityLabel="Recording controls">
          <Text accessibilityLiveRegion="polite" style={{ color: p.voice.s === "paused" ? c.muted : c.errorText, fontWeight: "700", flex: 1 }}>{p.voice.s === "paused" ? "⏸ Paused" : "● Recording"} {fmt(p.voiceElapsedMs)}</Text>
          <Btn label="Cancel recording" onPress={p.onCancelRec}>✕</Btn>
          {p.voice.s === "recording" ? <Btn label="Pause recording" onPress={p.onPauseRec}>⏸</Btn> : <Btn label="Resume recording" onPress={p.onResumeRec}>●</Btn>}
          <Btn label="Stop and transcribe" tone="primary" onPress={p.onStopRec}>Done</Btn>
        </View>
      ) : p.voice.s === "transcribing" ? (
        <View style={styles.row}><ActivityIndicator color={c.primaryText} /><Text style={{ color: c.muted }}> Transcribing your recording…</Text><View style={{ flex: 1 }} /><Btn label="Cancel transcription" onPress={p.onCancelRec}>✕</Btn></View>
      ) : (
        <View style={styles.row}>
          <View>
            <Btn label="Attach a file" onPress={() => setAttachOpen((v) => !v)} disabled={p.busy}>＋</Btn>
            {attachOpen ? (
              <View style={[styles.menu, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Pressable accessibilityRole="menuitem" style={styles.menuItem} onPress={() => { setAttachOpen(false); p.onAttachImage(); }}><Text style={{ color: c.foreground }}>🖼 Photo or screenshot</Text></Pressable>
                <Pressable accessibilityRole="menuitem" style={styles.menuItem} onPress={() => { setAttachOpen(false); p.onAttachDoc(); }}><Text style={{ color: c.foreground }}>📄 PDF, text or code file</Text></Pressable>
              </View>
            ) : null}
          </View>
          <TextInput
            value={p.draft} onChangeText={p.setDraft} multiline placeholder="Message Geminio…" placeholderTextColor={c.muted}
            accessibilityLabel="Message Geminio" editable={!p.busy}
            onContentSizeChange={(e) => setH(Math.min(160, Math.max(44, e.nativeEvent.contentSize.height + 4)))}
            onKeyPress={(e: any) => { if (Platform.OS === "web" && e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey && canSend) { e.preventDefault?.(); p.onSend(); } }}
            style={[styles.input, { height: h, color: c.foreground, backgroundColor: c.surface, borderColor: c.border }]}
          />
          {p.busy && p.paused ? <Btn label="Resume task" tone="primary" onPress={p.onResume}>▶</Btn> : null}
          {p.busy && p.canPause && !p.paused ? <Btn label="Pause after the current step" onPress={p.onPause}>⏸</Btn> : null}
          {p.busy ? (
            <Btn label="Stop generating" tone="danger" onPress={p.onStop} disabled={p.stopDisabled}>■</Btn>
          ) : p.draft.trim() ? (
            <Btn label="Send message" tone="primary" onPress={p.onSend} disabled={!canSend}>↑</Btn>
          ) : (
            <Btn label={p.micAvailable ? "Start voice input" : p.micSupported ? "Voice input unavailable: speech recognition is not configured" : "Voice input is not supported on this device"} onPress={p.onMic} disabled={!p.micSupported}>🎤</Btn>
          )}
        </View>
      )}
      <View style={styles.meta}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Mode: ${p.planLabel ?? "Standard"}. Tap to change. Plan modes run several steps and show the plan and cost first.`} onPress={p.onCyclePlan} style={styles.link}>
          <Text style={{ color: p.planLabel ? c.primaryText : c.muted, fontSize: 12 }}>🧠 Mode: {p.planLabel ?? "Standard"}</Text>
        </Pressable>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: p.webMode !== "off" }} accessibilityLabel={`Web search: ${p.webMode}`} onPress={p.onToggleWeb} style={styles.link}>
          <Text style={{ color: p.webSearchAvailable ? c.primaryText : c.muted, fontSize: 12 }}>🌐 Web: {p.webMode === "auto" ? "auto" : p.webMode === "on" ? "always" : "off"}{p.webSearchAvailable ? "" : " (not configured)"}</Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, gap: 6 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 }, btn: { minWidth: 44, minHeight: 44, borderRadius: 22, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingTop: Platform.OS === "web" ? 10 : 10, paddingBottom: 10, fontSize: 16, maxWidth: 820 },
  status: { flexDirection: "row", gap: 8, alignItems: "center", paddingHorizontal: 4 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 }, link: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, chip: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, minHeight: 36 },
  menu: { position: "absolute", bottom: 52, left: 0, width: 240, borderWidth: 1, borderRadius: 12, padding: 4, zIndex: 20 }, menuItem: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  meta: { flexDirection: "row", justifyContent: "flex-end" },
});
