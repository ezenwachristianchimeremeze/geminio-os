import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { AppIcon, IconButton, SearchPill } from "@/components/super-app";
import { useColors } from "@/hooks/use-colors";
import { useMemory } from "@/lib/memory-context";
import { trpc } from "@/lib/trpc";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  isTyping?: boolean;
  action?: { label: string; route: string } | null;
}

type ActiveRun = {
  runId: string;
  taskId: string | null;
  status: "accepted" | "planning" | "executing" | "waiting_for_approval" | "verifying" | "completed" | "failed" | "cancelled";
};

const INITIAL_MESSAGE: Message = {
  id: "welcome",
  text: "Hello! I’m Geminio. What would you like to work on today?",
  isUser: false,
  timestamp: Date.now(),
};

const SUGGESTIONS = ["Plan my day", "Review my project", "Help me learn", "Create something new"];

export default function HomeScreen() {
  const colors = useColors();
  const { memories, addMemory, searchMemories } = useMemory();
  const chatMutation = trpc.chat.sendMessage.useMutation();
  const cancelRunMutation = trpc.aiCore.cancel.useMutation();
  const flatListRef = useRef<FlatList<Message>>(null);
  const inputRef = useRef<TextInput>(null);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const runQuery = trpc.aiCore.getRun.useQuery(
    { runId: activeRun?.runId ?? "run_unavailable" },
    {
      enabled: Boolean(activeRun?.runId),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "completed" || status === "failed" || status === "cancelled" ? false : 1500;
      },
    },
  );
  const runStatus = runQuery.data?.status ?? activeRun?.status ?? null;
  const canCancelRun = runStatus === "accepted" || runStatus === "planning" || runStatus === "executing" || runStatus === "waiting_for_approval" || runStatus === "verifying";

  const recentConversations = useMemo(
    () => memories.filter((memory) => memory.type === "conversation").slice(0, 4),
    [memories],
  );
  const searchResults = useMemo(() => (searchQuery.trim() ? searchMemories(searchQuery).slice(0, 5) : []), [searchMemories, searchQuery]);

  const handleNewChat = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMessages([{ ...INITIAL_MESSAGE, id: `welcome-${Date.now()}`, timestamp: Date.now() }]);
    setInputText("");
    setIsSearchOpen(false);
    setActiveRun(null);
    setConversationId(null);
  };

  const handleCancelRun = async () => {
    if (!activeRun || cancelRunMutation.isPending) return;
    try {
      const cancelled = await cancelRunMutation.mutateAsync({ runId: activeRun.runId });
      setActiveRun((current) => current ? { ...current, status: cancelled.status } : current);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // The existing assistant response remains available if a task control request fails.
    }
  };

  const handleSend = async (value?: string) => {
    const messageText = (value ?? inputText).trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = { id: `user-${Date.now()}`, text: messageText, isUser: true, timestamp: Date.now() };
    const history = messages.filter((message) => !message.isTyping).map((message) => ({
      role: message.isUser ? ("user" as const) : ("assistant" as const),
      content: message.text,
    }));
    setMessages((previous) => [...previous, userMessage, { id: `typing-${Date.now()}`, text: "", isUser: false, isTyping: true, timestamp: Date.now() }]);
    setInputText("");
    setIsLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    await addMemory({ type: "conversation", content: messageText, tags: ["chat", "user"] });
    try {
      const response = await chatMutation.mutateAsync({ message: messageText, conversationId, conversationHistory: history });
      const responseText = response.success && typeof response.response === "string" ? response.response : "I wasn’t able to complete that request. Please try again.";
      if (response.conversationId) {
        setConversationId(response.conversationId);
      }
      if (response.runId) {
        setActiveRun({ runId: response.runId, taskId: response.taskId, status: response.status });
      }
      setMessages((previous) => [
        ...previous.filter((message) => !message.isTyping),
        { id: `assistant-${Date.now()}`, text: responseText, isUser: false, timestamp: Date.now(), action: response.destination ?? null },
      ]);
      await addMemory({ type: "conversation", content: responseText, tags: ["chat", "assistant"] });
    } catch {
      setMessages((previous) => [
        ...previous.filter((message) => !message.isTyping),
        { id: `error-${Date.now()}`, text: "I’m having trouble connecting right now. Please try again in a moment.", isUser: false, timestamp: Date.now(), action: null },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoice = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRecording((previous) => !previous);
    if (!isRecording) {
      setInputText("Tell Geminio what you need…");
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageRow, item.isUser ? styles.userMessageRow : styles.assistantMessageRow]}>
      {!item.isUser ? (
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <AppIcon name="auto-awesome" size={15} color="#FFFFFF" />
        </View>
      ) : null}
      <View style={[styles.messageBubble, item.isUser ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
        {item.isTyping ? <ActivityIndicator size="small" color={colors.muted} /> : <>
          <Text style={[styles.messageText, { color: item.isUser ? "#FFFFFF" : colors.foreground }]}>{item.text}</Text>
          {!item.isUser && item.action ? <Pressable accessibilityRole="button" accessibilityLabel={item.action.label} onPress={() => router.push(item.action!.route as never)} style={({ pressed }) => [styles.messageAction, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={styles.messageActionText}>{item.action.label}</Text><AppIcon name="arrow-forward" size={15} color="#FFFFFF" /></Pressable> : null}
        </>}
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-0" edges={["top", "left", "right", "bottom"]}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
              <AppIcon name="auto-awesome" color="#FFFFFF" size={18} />
            </View>
            <View>
              <Text style={[styles.brandName, { color: colors.foreground }]}>Geminio</Text>
              <Text style={[styles.brandStatus, { color: colors.muted }]}>AI workspace</Text>
            </View>
          </View>
          <View style={styles.topActions}>
            <IconButton icon="search" label="Search conversations" onPress={() => setIsSearchOpen((previous) => !previous)} />
            <IconButton icon="add" label="Start a new chat" onPress={handleNewChat} />
          </View>
        </View>

        {isSearchOpen ? (
          <View style={styles.searchArea}>
            <SearchPill placeholder="Search your conversations" />
            <TextInput
              autoFocus
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by topic or phrase"
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]}
            />
            {searchResults.length > 0 ? (
              <View style={[styles.searchResults, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {searchResults.map((result) => (
                  <Pressable key={result.id} accessibilityRole="button" onPress={() => setInputText(result.content)} style={({ pressed }) => [styles.searchResult, pressed && styles.pressed]}>
                    <AppIcon name="history" size={17} color={colors.muted} />
                    <Text numberOfLines={1} style={[styles.searchResultText, { color: colors.foreground }]}>{result.content}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messageList}
          ListHeaderComponent={
            <View style={styles.contextHeader}>
              <Text style={[styles.contextEyebrow, { color: colors.primary }]}>Your intelligent companion</Text>
              <Text style={[styles.contextTitle, { color: colors.foreground }]}>What can I help you make progress on?</Text>
              <Text style={[styles.contextDescription, { color: colors.muted }]}>Ask anything, talk through an idea, or let Geminio turn a thought into a plan.</Text>
              <View style={styles.suggestionWrap}>
                {SUGGESTIONS.map((suggestion) => (
                  <Pressable key={suggestion} accessibilityRole="button" onPress={() => void handleSend(suggestion)} style={({ pressed }) => [styles.suggestionChip, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
                    <AppIcon name="auto-awesome" size={14} color={colors.primary} />
                    <Text style={[styles.suggestionText, { color: colors.foreground }]}>{suggestion}</Text>
                  </Pressable>
                ))}
              </View>
              {recentConversations.length > 0 ? (
                <View style={styles.recentBlock}>
                  <View style={styles.recentHeader}>
                    <Text style={[styles.recentTitle, { color: colors.foreground }]}>Recent chats</Text>
                    <Text style={[styles.recentMeta, { color: colors.muted }]}>{recentConversations.length} saved</Text>
                  </View>
                  {recentConversations.map((conversation) => (
                    <Pressable key={conversation.id} accessibilityRole="button" onPress={() => setInputText(conversation.content)} style={({ pressed }) => [styles.recentRow, { borderBottomColor: colors.border }, pressed && styles.pressed]}>
                      <View style={[styles.recentIcon, { backgroundColor: colors.surface }]}><AppIcon name="chat-bubble-outline" color={colors.muted} size={16} /></View>
                      <Text numberOfLines={1} style={[styles.recentText, { color: colors.foreground }]}>{conversation.content}</Text>
                      <AppIcon name="chevron-right" color={colors.muted} size={17} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          }
        />

        <View style={[styles.composerArea, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {activeRun && runStatus ? (
            <View style={[styles.runStatus, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <View style={styles.runStatusCopy}>
                <AppIcon name={runStatus === "failed" ? "error-outline" : runStatus === "completed" ? "check-circle-outline" : runStatus === "waiting_for_approval" ? "pending-actions" : "sync"} color={runStatus === "failed" ? colors.error : runStatus === "completed" ? colors.success : colors.primary} size={16} />
                <Text numberOfLines={1} style={[styles.runStatusText, { color: colors.foreground }]}>
                  {runStatus === "waiting_for_approval" ? "Task is waiting for approval" : `AI task ${runStatus.replaceAll("_", " ")}`}
                </Text>
              </View>
              {canCancelRun ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Cancel AI task" onPress={() => void handleCancelRun()} style={({ pressed }) => [styles.runCancel, pressed && styles.pressed]}>
                  <Text style={[styles.runCancelText, { color: colors.error }]}>{cancelRunMutation.isPending ? "Cancelling…" : "Cancel"}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: isRecording ? colors.primary : colors.border }]}>
            <TextInput
              ref={inputRef}
              value={inputText}
              onChangeText={setInputText}
              placeholder={isRecording ? "Listening…" : "Message Geminio"}
              placeholderTextColor={colors.muted}
              editable={!isLoading}
              multiline
              maxLength={1200}
              returnKeyType="send"
              onSubmitEditing={() => void handleSend()}
              style={[styles.composerInput, { color: colors.foreground }]}
            />
            <Pressable accessibilityRole="button" accessibilityLabel={isRecording ? "Stop voice chat" : "Start voice chat"} onPress={handleVoice} style={({ pressed }) => [styles.composerIcon, pressed && styles.pressed]}>
              <AppIcon name={isRecording ? "stop" : "mic-none"} color={isRecording ? colors.primary : colors.muted} size={21} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!inputText.trim() || isLoading} onPress={() => void handleSend()} style={({ pressed }) => [styles.sendButton, { backgroundColor: inputText.trim() && !isLoading ? colors.primary : colors.border }, pressed && styles.pressed]}>
              {isLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <AppIcon name="arrow-upward" color="#FFFFFF" size={20} />}
            </Pressable>
          </View>
          <Text style={[styles.composerHint, { color: colors.muted }]}>Geminio can make mistakes. Check important information.</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  brandName: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  brandStatus: { fontSize: 11, marginTop: 1 },
  topActions: { flexDirection: "row", gap: 8 },
  searchArea: { paddingHorizontal: 18, gap: 9, paddingBottom: 3 },
  searchInput: { minHeight: 45, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
  searchResults: { borderWidth: 1, borderRadius: 15, overflow: "hidden" },
  searchResult: { minHeight: 42, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  searchResultText: { flex: 1, fontSize: 13 },
  messageList: { paddingHorizontal: 18, paddingBottom: 12 },
  contextHeader: { paddingTop: 8, paddingBottom: 20 },
  contextEyebrow: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 },
  contextTitle: { fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.7, maxWidth: 420 },
  contextDescription: { fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: 460 },
  suggestionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  suggestionChip: { minHeight: 35, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6 },
  suggestionText: { fontSize: 12, fontWeight: "700" },
  recentBlock: { marginTop: 20 },
  recentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 },
  recentTitle: { fontSize: 15, fontWeight: "800" },
  recentMeta: { fontSize: 12 },
  recentRow: { minHeight: 47, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 9 },
  recentIcon: { width: 29, height: 29, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  recentText: { flex: 1, fontSize: 13, fontWeight: "600" },
  messageRow: { flexDirection: "row", marginBottom: 13, gap: 8, alignItems: "flex-end" },
  userMessageRow: { justifyContent: "flex-end" },
  assistantMessageRow: { justifyContent: "flex-start" },
  avatar: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  messageBubble: { maxWidth: "82%", minHeight: 42, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 },
  messageText: { fontSize: 15, lineHeight: 21 },
  messageAction: { minHeight: 32, borderRadius: 11, paddingHorizontal: 10, marginTop: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "flex-start" },
  messageActionText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  composerArea: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 6 },
  runStatus: { minHeight: 36, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  runStatusCopy: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7 },
  runStatusText: { flex: 1, fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  runCancel: { minHeight: 28, paddingHorizontal: 4, justifyContent: "center" },
  runCancelText: { fontSize: 11, fontWeight: "800" },
  composer: { minHeight: 52, borderWidth: 1, borderRadius: 19, paddingLeft: 14, paddingRight: 6, flexDirection: "row", alignItems: "flex-end", gap: 7 },
  composerInput: { flex: 1, maxHeight: 110, minHeight: 40, fontSize: 15, paddingTop: 10, paddingBottom: 9 },
  composerIcon: { width: 35, height: 40, alignItems: "center", justifyContent: "center" },
  sendButton: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  composerHint: { textAlign: "center", fontSize: 10 },
  pressed: { opacity: 0.7 },
});
