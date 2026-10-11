import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { MessageContent, SourceList } from "@/components/home-chat/message-content";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

/** Public, read-only view of a shared conversation (no sign-in needed; token is the capability). */
export default function SharedConversation() {
  const c = useColors(); const { token } = useLocalSearchParams<{ token: string }>();
  const q = trpc.homeChat.shared.useQuery({ token: String(token ?? "") }, { enabled: Boolean(token), retry: false });
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, maxWidth: 760, alignSelf: "center", width: "100%" }}>
        {q.isLoading ? <ActivityIndicator color={c.primaryText} /> : null}
        {q.error ? <Text accessibilityRole="alert" style={{ color: c.errorText, fontSize: 16 }}>This shared conversation is unavailable. The link may have been revoked or deleted.</Text> : null}
        {q.data ? (
          <>
            <Text accessibilityRole="header" style={{ color: c.foreground, fontSize: 22, fontWeight: "700" }}>{q.data.title}</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>Shared read-only snapshot from Geminio</Text>
            {q.data.messages.map((m) => (
              <View key={m.id} style={{ backgroundColor: m.role === "user" ? c.surfaceMuted : c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 }}>
                <Text style={{ color: c.muted, fontSize: 12, fontWeight: "700" }}>{m.role === "user" ? "User" : "Geminio"}</Text>
                <MessageContent markdown={m.content} sources={(Array.isArray(m.sources) ? m.sources : []) as never} onCopyCode={() => undefined} />
                <SourceList sources={(Array.isArray(m.sources) ? m.sources : []) as never} />
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
