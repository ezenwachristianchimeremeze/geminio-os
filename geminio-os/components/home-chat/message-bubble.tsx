import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { codeBlocks } from "@/lib/home-chat/markdown";
import { speechFor, type SpeechState } from "@/lib/home-chat/speech-machine";
import { MessageContent, SourceList } from "./message-content";

export type ChatMessage = { active?: boolean; variantOf?: string | null; id: string; role: "user" | "assistant"; content: string; feedback: "up" | "down" | null; status: string; sources: unknown; editedAt: Date | string | null; createdAt: Date | string };
type Source = { index: number; title: string; url: string; host: string };

function ActionButton({ label, onPress, children, active, disabled }: { label: string; onPress: () => void; children: string; active?: boolean; disabled?: boolean }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={onPress} hitSlop={4}
      style={({ pressed, focused }: any) => [styles.action, { backgroundColor: active ? c.surfaceMuted : "transparent", opacity: disabled ? 0.45 : pressed ? 0.7 : 1, borderColor: focused ? c.focus : "transparent", borderWidth: 2 }]}>
      <Text style={{ color: active ? c.primaryText : c.muted, fontSize: 14, fontWeight: "600" }}>{children}</Text>
    </Pressable>
  );
}

export function MessageBubble(p: {
  message: ChatMessage; isLastAssistant: boolean; speech: SpeechState; canPauseSpeech: boolean; busy: boolean;
  onCopy: (text: string, label?: string) => void; onSpeak: (id: string, text: string) => void; onPause: () => void; onResume: () => void; onStopSpeech: () => void;
  variants?: { index: number; total: number; prevId: string | null; nextId: string | null } | null; onSelectVariant?: (id: string) => void;
  onRunCode?: (lang: string, code: string) => void;
  onFeedback: (id: string, v: "up" | "down" | null) => void; onRetry: () => void; onMore: (m: ChatMessage) => void; onEdit: (id: string, text: string) => void;
}) {
  const c = useColors(); const m = p.message; const isUser = m.role === "user";
  const [editing, setEditing] = useState(false); const [text, setText] = useState(m.content);
  const sources = (Array.isArray(m.sources) ? m.sources : []) as Source[];
  const sp = speechFor(p.speech, m.id);
  return (
    <View style={[styles.row, { alignItems: isUser ? "flex-end" : "flex-start" }]}>
      <View accessible={false} style={[styles.bubble, isUser ? { backgroundColor: c.primary, maxWidth: "88%" } : { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, maxWidth: "100%", width: "100%" }]}
        accessibilityLabel={`${isUser ? "You" : "Geminio"} said`}>
        {editing ? (
          <View style={{ gap: 8, minWidth: 240 }}>
            <TextInput value={text} onChangeText={setText} multiline accessibilityLabel="Edit your message" style={{ color: c.primaryForeground, fontSize: 16, minHeight: 44 }} />
            <Text style={{ color: c.primaryForeground, fontSize: 12 }}>Saving replaces Geminio's later replies in this conversation.</Text>
            <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
              <Pressable accessibilityRole="button" style={styles.pill} onPress={() => { setEditing(false); setText(m.content); }}><Text style={{ color: c.primaryForeground }}>Cancel</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={!text.trim() || p.busy} style={[styles.pill, { backgroundColor: c.surface }]} onPress={() => { setEditing(false); p.onEdit(m.id, text.trim()); }}><Text style={{ color: c.foreground, fontWeight: "700" }}>Save & resend</Text></Pressable>
            </View>
          </View>
        ) : isUser ? (
          <Text selectable style={{ color: c.primaryForeground, fontSize: 16, lineHeight: 24 }}>{m.content}</Text>
        ) : (
          <>
            <MessageContent markdown={m.content} sources={sources} onCopyCode={(code) => p.onCopy(code, "Code copied")} onRunCode={p.onRunCode} />
            <SourceList sources={sources} />
            {m.status === "stopped" ? <Text style={{ color: c.muted, fontSize: 12, marginTop: 6 }}>Generation was stopped.</Text> : null}
          </>
        )}
      </View>
      {!editing && (
        <View style={styles.actions} accessibilityRole="toolbar" accessibilityLabel={isUser ? "Message actions" : "Response actions"}>
          {isUser ? (
            <>
              <ActionButton label="Copy message" onPress={() => p.onCopy(m.content)}>Copy</ActionButton>
              <ActionButton label="Edit message" onPress={() => setEditing(true)} disabled={p.busy}>Edit</ActionButton>
            </>
          ) : (
            <>
              {p.variants && p.variants.total > 1 ? (
                <View accessibilityRole="toolbar" accessibilityLabel={`Response ${p.variants.index} of ${p.variants.total}`} style={{ flexDirection: "row", alignItems: "center" }}>
                  <ActionButton label="Previous response" disabled={!p.variants.prevId} onPress={() => p.variants!.prevId && p.onSelectVariant?.(p.variants!.prevId)}>‹</ActionButton>
                  <Text style={{ color: c.muted, fontSize: 13 }}>{p.variants.index}/{p.variants.total}</Text>
                  <ActionButton label="Next response" disabled={!p.variants.nextId} onPress={() => p.variants!.nextId && p.onSelectVariant?.(p.variants!.nextId)}>›</ActionButton>
                </View>
              ) : null}
              <ActionButton label="Copy response" onPress={() => p.onCopy(m.content)}>Copy</ActionButton>
              {sp === "idle" || sp === "error" ? <ActionButton label="Read response aloud" onPress={() => p.onSpeak(m.id, m.content)}>Speak</ActionButton> : (
                <>
                  {p.canPauseSpeech ? (sp === "speaking" ? <ActionButton label="Pause speech" onPress={p.onPause}>Pause</ActionButton> : <ActionButton label="Resume speech" onPress={p.onResume}>Resume</ActionButton>) : null}
                  <ActionButton label="Stop speech" onPress={p.onStopSpeech}>Stop</ActionButton>
                </>
              )}
              <ActionButton label="Helpful" active={m.feedback === "up"} onPress={() => p.onFeedback(m.id, m.feedback === "up" ? null : "up")}>{m.feedback === "up" ? "👍 Helpful ✓" : "👍"}</ActionButton>
              <ActionButton label="Not helpful" active={m.feedback === "down"} onPress={() => p.onFeedback(m.id, m.feedback === "down" ? null : "down")}>{m.feedback === "down" ? "👎 Not helpful ✓" : "👎"}</ActionButton>
              {p.isLastAssistant ? <ActionButton label="Regenerate response" onPress={p.onRetry} disabled={p.busy}>Retry</ActionButton> : null}
              <ActionButton label="More actions" onPress={() => p.onMore(m)}>More</ActionButton>
            </>
          )}
        </View>
      )}
    </View>
  );
}

export const hasCode = (content: string) => codeBlocks(content).length > 0;
const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, marginVertical: 8, gap: 2 }, bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 2, marginTop: 2 }, action: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  pill: { paddingHorizontal: 12, minHeight: 44, borderRadius: 10, justifyContent: "center" },
});
