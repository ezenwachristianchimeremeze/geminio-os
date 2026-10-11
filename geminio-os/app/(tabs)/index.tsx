import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";

import { Composer } from "@/components/home-chat/composer";
import { MessageContent } from "@/components/home-chat/message-content";
import { MessageBubble, type ChatMessage } from "@/components/home-chat/message-bubble";
import { ConversationMenu, HistorySheet, MoreSheet, PersonalizationSheet, ContextSheet, TasksSheet, SchedulesSheet, CodeRunSheet, ActionsSheet } from "@/components/home-chat/sheets";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useHomeChat } from "@/lib/home-chat/use-home-chat";

function PlanPreviewCard({ h, c }: { h: ReturnType<typeof useHomeChat>; c: ReturnType<typeof useColors> }) {
  const p = h.preview!; const def = h.planTypes.find((t) => t.id === p.type);
  if (!p.data.ok) {
    return (
      <View accessibilityRole="alert" accessibilityLabel="Plan problem" style={[styles.progress, { borderColor: c.error, backgroundColor: c.surface, gap: 6 }]}>
        <Text style={{ color: c.errorText, fontWeight: "700" }}>That plan isn't allowed</Text>
        {p.data.problems.map((x) => <Text key={x} style={{ color: c.errorText, fontSize: 13 }}>• {x}</Text>)}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={() => h.editPlan([])} style={[styles.approve, { backgroundColor: c.surfaceMuted }]}><Text style={{ color: c.foreground }}>Reset to default</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={h.cancelPreview} style={[styles.approve, { backgroundColor: c.surfaceMuted }]}><Text style={{ color: c.foreground }}>Cancel</Text></Pressable>
        </View>
      </View>
    );
  }
  const d = p.data; const roles = d.steps.map((x) => x.role);
  const move = (i: number, dir: -1 | 1) => { const r = [...roles]; const j = i + dir; if (j < 0 || j >= r.length) return; [r[i], r[j]] = [r[j], r[i]]; h.editPlan(r); };
  const addable = (def?.allowedRoles ?? []).filter((r) => !roles.includes(r.id) && !r.final);
  return (
    <View accessibilityLabel="Plan preview" style={[styles.progress, { borderColor: c.primary, backgroundColor: c.surface, gap: 6 }]}>
      <Text accessibilityRole="header" style={{ color: c.foreground, fontWeight: "700" }}>I understood your request as:</Text>
      <Text style={{ color: c.foreground }}>{d.understood}</Text>
      <Text style={{ color: c.muted, fontSize: 13 }}>Planned steps ({def?.label ?? d.planType})</Text>
      {d.steps.map((st, i) => {
        const isFinal = i === d.steps.length - 1;
        return (
          <View key={st.role} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ color: c.foreground, fontSize: 14, flex: 1 }}>{i + 1}. {st.title}</Text>
            {!isFinal ? <Pressable accessibilityRole="button" accessibilityLabel={`Move ${st.title} up`} disabled={i === 0} onPress={() => move(i, -1)} style={styles.mini}><Text style={{ color: c.muted }}>↑</Text></Pressable> : null}
            {!isFinal ? <Pressable accessibilityRole="button" accessibilityLabel={`Move ${st.title} down`} disabled={i >= d.steps.length - 2} onPress={() => move(i, 1)} style={styles.mini}><Text style={{ color: c.muted }}>↓</Text></Pressable> : null}
            {!isFinal ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove step ${st.title}`} onPress={() => h.editPlan(roles.filter((r) => r !== st.role))} style={styles.mini}><Text style={{ color: c.errorText }}>✕</Text></Pressable> : null}
          </View>
        );
      })}
      {addable.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {addable.map((r) => <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`Add step ${r.title}`} onPress={() => h.editPlan([...roles.slice(0, -1), r.id, roles[roles.length - 1]])} style={[styles.approve, { backgroundColor: c.surfaceMuted }]}><Text style={{ color: c.foreground, fontSize: 13 }}>＋ {r.title}</Text></Pressable>)}
        </View>
      ) : null}
      {d.usesWebSearch ? <Text style={{ color: c.muted, fontSize: 13 }}>Includes a web search.</Text> : null}
      <Text style={{ color: d.canAfford === false ? c.errorText : c.foreground, fontWeight: "700" }}>Estimated credits: {d.estimatedCredits}{d.available !== null ? ` (you have ${d.available})` : ""}</Text>
      {d.canAfford === false ? <Text accessibilityRole="alert" style={{ color: c.errorText, fontSize: 13 }}>Not enough credits for this plan. Nothing will run.</Text> : <Text style={{ color: c.muted, fontSize: 12 }}>You are charged only for steps that complete. The server re-checks this plan before it runs.</Text>}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Approve and run" disabled={d.canAfford === false} onPress={() => void h.approvePreview()} style={[styles.approve, { backgroundColor: c.primary, opacity: d.canAfford === false ? 0.45 : 1 }]}><Text style={{ color: c.primaryForeground, fontWeight: "700" }}>Approve & Run</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel plan" onPress={h.cancelPreview} style={[styles.approve, { backgroundColor: c.surfaceMuted }]}><Text style={{ color: c.foreground }}>Cancel</Text></Pressable>
      </View>
    </View>
  );
}

const SUGGESTIONS = ["Plan my day", "What's in today's technology news?", "Explain this TypeScript error", "Help me improve my CV"];
type ConvSummary = { id: string; title: string; pinned: boolean; status: "active" | "archived"; shared: boolean; lastMessageAt: Date | string };

export default function HomeScreen() {
  const c = useColors();
  const h = useHomeChat();
  const listRef = useRef<FlatList>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [convMenu, setConvMenu] = useState<ConvSummary | null>(null);
  const [more, setMore] = useState<ChatMessage | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [schedOpen, setSchedOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [codeRun, setCodeRun] = useState<{ language: string; code: string } | null>(null);
  const spokenRef = useRef<string | null>(null);
  const messages = h.messages as unknown as ChatMessage[];

  // Voice conversation: speak each NEW completed reply once. Text is always kept in the transcript.
  useEffect(() => {
    if (!voiceMode || h.turn.s !== "done" || !h.lastAssistantId) return;
    if (spokenRef.current === h.lastAssistantId) return;
    const m = messages.find((x) => x.id === h.lastAssistantId);
    if (m) { spokenRef.current = m.id; h.speak(m.id, m.content); }
  }, [voiceMode, h.turn.s, h.lastAssistantId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (h.notice) { const t = setTimeout(h.clearNotice, 3500); return () => clearTimeout(t); } }, [h.notice]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50); return () => clearTimeout(t); }, [messages.length, h.pendingUser, h.status]);

  const title = h.conversation?.title ?? (h.temporary ? "Temporary chat" : "New chat");
  const empty = messages.length === 0 && !h.pendingUser && !h.loadingConversation;
  const lowCredits = h.turn.s === "failed" && h.turn.code === "INSUFFICIENT_CREDITS";

  const sendSuggestion = (t: string) => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); void h.requestSend(t); };
  const data = useMemo(() => messages, [messages]);

  const header = (
    <View style={[styles.top, { borderBottomColor: c.border }]}>
      <View style={[styles.logo, { backgroundColor: c.primary }]} accessibilityElementsHidden><Text style={{ color: c.primaryForeground, fontWeight: "800" }}>G</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Conversation: ${title}. Open history and search`} onPress={() => setHistoryOpen(true)} style={styles.titleBtn}>
        <Text numberOfLines={1} style={{ color: c.foreground, fontSize: 17, fontWeight: "700" }}>{title}</Text>
        {h.temporary || h.conversation?.temporary ? <Text style={{ color: c.warningText, fontSize: 11 }}>Temporary — deleted after {h.config?.temporaryRetentionHours ?? 24}h, not in history</Text> : h.balance ? <Text style={{ color: c.muted, fontSize: 11 }}>{h.balance.available.toFixed(h.balance.available % 1 ? 2 : 0)} credits available</Text> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Search and browse conversations" onPress={() => setHistoryOpen(true)} style={styles.hit}><Text style={{ color: c.foreground, fontSize: 18 }}>🔍</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="More options" accessibilityState={{ expanded: menuOpen }} onPress={() => setMenuOpen((v) => !v)} style={styles.hit}><Text style={{ color: c.foreground, fontSize: 22 }}>⋯</Text></Pressable>
      {menuOpen ? (
        <View style={[styles.menu, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityRole="menu">
          {[
            { l: "New chat", a: () => h.startNew() },
            { l: "New temporary chat", a: () => h.startNew({ temporary: true }) },
            { l: "Tasks…", a: () => setTasksOpen(true) },
            { l: "Actions needing approval…", a: () => setActionsOpen(true) },
            { l: "Reminders & schedules…", a: () => setSchedOpen(true) },
            { l: h.contextSel.historyMode !== "conversation" || h.contextSel.conversationIds.length || h.contextSel.workspaceId ? "Context controls… (custom)" : "Context controls…", a: () => setCtxOpen(true) },
            { l: "Personalization…", a: () => setPrefsOpen(true) },
            { l: voiceMode ? "Voice conversation: on" : "Voice conversation: off", a: () => { setVoiceMode((v) => !v); h.stopSpeech(); } },
            ...(h.conversationId && h.conversation ? [{ l: "Conversation actions…", a: () => setConvMenu({ id: h.conversation!.id, title: h.conversation!.title, pinned: h.conversation!.pinned, status: h.conversation!.status, shared: h.conversation!.shared, lastMessageAt: h.conversation!.lastMessageAt }) }] : []),
          ].map((it) => (
            <Pressable key={it.l} accessibilityRole="menuitem" style={styles.menuItem} onPress={() => { setMenuOpen(false); it.a(); }}><Text style={{ color: c.foreground, fontSize: 15 }}>{it.l}</Text></Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flex: 1, width: "100%", maxWidth: 860, alignSelf: "center" }}>
          {h.conversationError ? <View accessibilityRole="alert" style={[styles.banner, { borderColor: c.error }]}><Text style={{ color: c.errorText }}>⚠ Couldn't load this conversation: {h.conversationError}</Text></View> : null}
          {h.notice ? <View accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: c.foreground }]}><Text style={{ color: c.background, fontSize: 13 }}>{h.notice}</Text></View> : null}
          {h.loadingConversation ? <ActivityIndicator style={{ marginTop: 24 }} color={c.primaryText} /> : null}

          {empty ? (
            <View style={styles.empty}>
              <Text accessibilityRole="header" style={{ color: c.foreground, fontSize: 26, fontWeight: "800", textAlign: "center" }}>What can I help you with?</Text>
              <Text style={{ color: c.muted, textAlign: "center", fontSize: 15 }}>Ask anything, attach a file, or use your voice. I'll route it to the right Geminio tool.</Text>
              <View style={styles.chips}>{SUGGESTIONS.map((s) => <Pressable key={s} accessibilityRole="button" onPress={() => sendSuggestion(s)} style={[styles.chip, { borderColor: c.border, backgroundColor: c.surface }]}><Text style={{ color: c.foreground }}>{s}</Text></Pressable>)}</View>
            </View>
          ) : (
            <FlatList
              ref={listRef} data={data} keyExtractor={(m) => m.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item }) => (
                <MessageBubble
                  message={item} variants={h.variantsFor(item.id)} onSelectVariant={(id) => void h.selectVariant(id)} isLastAssistant={item.id === h.lastAssistantId} speech={h.speech} canPauseSpeech={h.canPauseSpeech} busy={h.busy}
                  onCopy={(t, l) => void h.copy(t, l)} onSpeak={(id, t) => h.speak(id, t)} onPause={h.pauseSpeech} onResume={h.resumeSpeech} onStopSpeech={h.stopSpeech}
                  onFeedback={(id, v) => void h.setFeedback(id, v)} onRetry={() => void h.retryLast()} onMore={setMore} onRunCode={(language, code) => setCodeRun({ language, code })} onEdit={(id, t) => void h.editMessage(id, t)}
                />
              )}
              ListFooterComponent={
                <View style={{ paddingHorizontal: 16, gap: 8 }}>
                  {h.preview ? <PlanPreviewCard h={h} c={c} /> : null}
                  {h.previewing ? <ActivityIndicator color={c.primaryText} /> : null}
                  {h.pendingUser && !messages.some((m) => m.role === "user" && m.content === h.pendingUser && h.turn.s !== "sending") ? (
                    <View style={{ alignItems: "flex-end" }}><View style={[styles.pending, { backgroundColor: c.primary }]}><Text style={{ color: c.primaryForeground, fontSize: 16 }}>{h.pendingUser}</Text></View></View>
                  ) : null}
                  {h.lastContext ? <View accessibilityLabel="Context used" style={[styles.banner, { borderColor: c.border, backgroundColor: c.surface, marginHorizontal: 0 }]}><Text style={{ color: c.muted, fontSize: 12 }}>Used shared context: {[...h.lastContext.conversations.map((x) => `“${x.title}”`), ...(h.lastContext.workspaceFiles.length ? [`${h.lastContext.workspaceFiles.length} project file(s)`] : [])].join(", ")}{h.lastContext.secretFilesExcluded ? ` · ${h.lastContext.secretFilesExcluded} secret file(s) excluded` : ""}{h.lastContext.omittedFiles ? ` · ${h.lastContext.omittedFiles} omitted (size limit)` : ""}</Text></View> : null}
                  {h.streamingText ? (
                    <View accessibilityLiveRegion="polite" accessibilityLabel="Geminio is replying" style={[styles.pending, { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, maxWidth: "100%", width: "100%" }]}>
                      <MessageContent markdown={h.streamingText} onCopyCode={(code) => void h.copy(code, "Code copied")} />
                      <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>Generating… (updates every moment; stop any time)</Text>
                    </View>
                  ) : null}
                  {h.searchReport.attempted && h.searchReport.status !== "ok" ? <View accessibilityRole="alert" style={[styles.banner, { borderColor: c.warning, backgroundColor: c.surface }]}><Text style={{ color: c.warningText, fontSize: 13 }}>🌐 Web search {h.searchReport.status === "unavailable" ? "isn't available" : "failed"}: {h.searchReport.reason}. This answer isn't based on live web results.</Text></View> : null}
                  {h.turn.s === "running" && h.turn.steps.length > 0 ? (
                    <View accessibilityLabel="Task progress" style={[styles.progress, { borderColor: c.border, backgroundColor: c.surface }]}>
                      {h.turn.steps.map((s) => <Text key={s.key} style={{ color: s.state === "active" ? c.primaryText : s.state === "failed" ? c.errorText : c.muted, fontSize: 13 }}>{s.state === "done" ? "✓" : s.state === "active" ? "●" : "✕"} {s.label}</Text>)}
                    </View>
                  ) : null}
                  {h.turn.s === "failed" ? (
                    <View accessibilityRole="alert" style={[styles.banner, { borderColor: c.error, backgroundColor: c.surface }]}>
                      <Text style={{ color: c.errorText, fontSize: 14 }}>⚠ {h.turn.message}</Text>
                      {lowCredits ? <Text style={{ color: c.muted, fontSize: 12 }}>Nothing was run and nothing was charged. Add credits to continue.</Text> : null}
                      {h.turn.retryable && h.conversationId ? <Pressable accessibilityRole="button" onPress={() => void h.retryLast()} style={styles.retry}><Text style={{ color: c.primaryText, fontWeight: "700" }}>Retry</Text></Pressable> : null}
                    </View>
                  ) : null}
                  {h.turn.s === "done" && h.moduleHint ? (
                    <View style={[styles.banner, { borderColor: c.border, backgroundColor: c.surface }]}>
                      <Pressable accessibilityRole="button" accessibilityLabel={h.moduleHint.label} onPress={() => router.push(h.moduleHint!.route as never)} style={styles.retry}><Text style={{ color: c.primaryText, fontWeight: "700" }}>{h.moduleHint.label} →</Text></Pressable>
                      {h.moduleHint.note ? <Text style={{ color: c.muted, fontSize: 12 }}>{h.moduleHint.note}</Text> : null}
                    </View>
                  ) : null}
                </View>
              }
            />
          )}
        </View>
        <View style={{ width: "100%", maxWidth: 860, alignSelf: "center" }}>
          <Composer
            draft={h.draft} setDraft={h.setDraft} busy={h.busy} sending={h.turn.s === "sending"} status={h.status}
            onSend={() => void h.requestSend()} onStop={() => void h.stopGeneration()} stopDisabled={h.turn.s !== "running" && h.turn.s !== "paused"}
            paused={h.turn.s === "paused"} canPause={h.turn.s === "running" && h.stepsTotal > 1} onPause={() => void h.pauseRun()} onResume={() => void h.resumeRun()}
            voice={h.voice} voiceElapsedMs={h.voiceElapsedMs} micAvailable={h.micAvailable} micSupported={h.micSupported}
            onMic={() => void h.startRecording()} onPauseRec={h.pauseRecording} onResumeRec={h.resumeRecording} onStopRec={() => void h.stopRecording()} onCancelRec={h.cancelRecording}
            onAcceptTranscript={() => { const t = h.voice.s === "review" ? h.voice.text : ""; h.acceptTranscript(); if (voiceMode && t && h.voice.s === "review" && !h.voice.uncertain) void h.sendMessage(t); }} onDismissVoice={h.dismissVoiceError}
            attachments={h.attachments} uploading={h.uploading} onAttachImage={() => void h.attach("image")} onAttachDoc={() => void h.attach("document")} onRemoveAttachment={h.removeAttachment}
            webMode={h.webMode} webSearchAvailable={h.config?.webSearch ?? false} onToggleWeb={() => h.setWebMode(h.webMode === "auto" ? "on" : h.webMode === "on" ? "off" : "auto")}
            planLabel={h.planType ? (h.planTypes.find((t) => t.id === h.planType)?.label ?? h.planType) : null}
            onCyclePlan={() => { const ids = [null, ...h.planTypes.map((t) => t.id)]; h.setPlanType(ids[(ids.indexOf(h.planType) + 1) % ids.length]); }}
          />
        </View>
      </KeyboardAvoidingView>

      <HistorySheet visible={historyOpen} onClose={() => setHistoryOpen(false)} currentId={h.conversationId} onOpen={h.openConversation} onNew={(t) => h.startNew({ temporary: t })} onMenu={(cv) => { setHistoryOpen(false); setConvMenu(cv); }} />
      <ConversationMenu target={convMenu} onClose={() => setConvMenu(null)} onChanged={() => void h.refreshHistory()} onDeleted={(id) => { if (id === h.conversationId) h.startNew(); }} onNotice={h.setNotice} />
      <ActionsSheet visible={actionsOpen} onClose={() => setActionsOpen(false)} onNotice={h.setNotice} />
      <CodeRunSheet run={codeRun} onClose={() => setCodeRun(null)} />
      <SchedulesSheet visible={schedOpen} onClose={() => setSchedOpen(false)} onNotice={h.setNotice} />
      <TasksSheet visible={tasksOpen} onClose={() => setTasksOpen(false)} onOpenConversation={h.openConversation} onNotice={h.setNotice} />
      <ContextSheet visible={ctxOpen} onClose={() => setCtxOpen(false)} value={h.contextSel} onChange={h.setContextSel} currentId={h.conversationId} />
      <PersonalizationSheet visible={prefsOpen} onClose={() => setPrefsOpen(false)} onNotice={h.setNotice} />
      <MoreSheet message={more} onClose={() => setMore(null)} onPrompt={(t) => void h.sendMessage(t)} onReport={(id, note) => void h.setFeedback(id, "down", note)} onNotice={h.setNotice} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, zIndex: 10 },
  logo: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }, titleBtn: { flex: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: 6 },
  hit: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  menu: { position: "absolute", top: 54, right: 8, width: 240, borderWidth: 1, borderRadius: 12, padding: 4, zIndex: 30 }, menuItem: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }, chip: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, justifyContent: "center" },
  banner: { borderWidth: 1, borderRadius: 12, padding: 10, marginHorizontal: 16, marginTop: 8, gap: 4 }, toast: { position: "absolute", top: 8, alignSelf: "center", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, zIndex: 20 },
  pending: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, maxWidth: "88%" }, progress: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 2 }, retry: { minHeight: 44, justifyContent: "center" }, mini: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }, approve: { minHeight: 44, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" },
});
