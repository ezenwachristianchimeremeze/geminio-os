import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppIcon, IconButton, ScreenHeader } from "@/components/super-app";
import { useColors } from "@/hooks/use-colors";

type ScreenState = "ready" | "loading" | "empty" | "error" | "offline" | "success" | "confirm";
type BlueprintScreen =
  | "onboarding-profile"
  | "home-chat-detail"
  | "discover-detail"
  | "notification-detail"
  | "profile-security"
  | "media-editor"
  | "career-application"
  | "business-record"
  | "learning-course"
  | "guardian-scan"
  | "marketplace-item"
  | "wallet-transfer"
  | "credits-checkout";

type Definition = { title: string; eyebrow: string; description: string; fields: string[]; primary: string; accent: string };

const definitions: Record<BlueprintScreen, Definition> = {
  "onboarding-profile": { title: "Personalize your workspace", eyebrow: "Onboarding", description: "Complete your profile, preferences, goals, notification choices, and privacy controls.", fields: ["Display name", "Primary goal", "Interests", "Notification preference"], primary: "Save preferences", accent: "#5B5FEF" },
  "home-chat-detail": { title: "Conversation detail", eyebrow: "Home · AI Chat", description: "Continue a conversation, inspect context, attach a file, or retry a failed response.", fields: ["Message"], primary: "Send message", accent: "#5B5FEF" },
  "discover-detail": { title: "Discover detail", eyebrow: "Discover", description: "Review a recommended product or story, save it, share it, or open the related workspace.", fields: ["Notes"], primary: "Save to favorites", accent: "#8B5CF6" },
  "notification-detail": { title: "Notification detail", eyebrow: "Notifications", description: "Review the event, mark it read, and route to the originating product or task.", fields: [], primary: "Open related item", accent: "#F59E0B" },
  "profile-security": { title: "Security controls", eyebrow: "Profile · Security", description: "Manage MFA, sessions, connected accounts, privacy, and recovery boundaries.", fields: ["Confirmation phrase"], primary: "Review security", accent: "#10B981" },
  "media-editor": { title: "Media editor", eyebrow: "Media Studio", description: "Edit a media project, inspect processing progress, retry exports, or save a draft.", fields: ["Project title", "Edit instruction"], primary: "Save draft", accent: "#EC4899" },
  "career-application": { title: "Application detail", eyebrow: "Career Hub", description: "Review an opportunity, update application details, attach a resume, and track status.", fields: ["Application note"], primary: "Save application", accent: "#0EA5E9" },
  "business-record": { title: "Business record", eyebrow: "Business Hub", description: "Create or edit a CRM, inventory, sales, or marketing record with audit-friendly states.", fields: ["Record name", "Record note"], primary: "Save record", accent: "#14B8A6" },
  "learning-course": { title: "Course workspace", eyebrow: "Learning Hub", description: "Open a course, track progress, start a study plan, or review certificates and exam states.", fields: ["Study goal"], primary: "Start study plan", accent: "#F97316" },
  "guardian-scan": { title: "Security scan", eyebrow: "AI Guardian", description: "Run a security scan, review findings, resolve a threat, or retry when a provider is unavailable.", fields: [], primary: "Start scan", accent: "#EF4444" },
  "marketplace-item": { title: "Marketplace item", eyebrow: "Marketplace", description: "Review an item, creator, reviews, downloads, and the checkout provider boundary.", fields: ["Review"], primary: "Begin checkout", accent: "#D946EF" },
  "wallet-transfer": { title: "Wallet transfer", eyebrow: "Wallet", description: "Review send or receive details, recipient validation, confirmation, and provider authorization states.", fields: ["Recipient", "Amount", "Reference"], primary: "Review transfer", accent: "#16A34A" },
  "credits-checkout": { title: "Credits and plans", eyebrow: "Credits", description: "Compare plans, review entitlements, start a trial, and continue through a provider-safe purchase boundary.", fields: [], primary: "Review plan", accent: "#7C3AED" },
};

export default function BlueprintScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ screen?: string }>();
  const screenParam = typeof params.screen === "string" ? params.screen : "home-chat-detail";
  const screen = screenParam as BlueprintScreen;
  const definition = useMemo(() => {
    if (screenParam in definitions) return definitions[screenParam as BlueprintScreen];
    return dynamicDefinition(screenParam);
  }, [screenParam]);
  const [state, setState] = useState<ScreenState>("ready");
  const [values, setValues] = useState<Record<string, string>>({});

  const primaryAction = () => {
    if (definition.fields.some((field) => !values[field]?.trim())) {
      setState("error");
      return;
    }
    setState("loading");
    setTimeout(() => setState(screen === "wallet-transfer" || screen === "credits-checkout" || screen === "marketplace-item" ? "confirm" : "success"), 450);
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} className="p-0">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <IconButton icon="arrow-back" label="Go back" onPress={() => router.back()} />
        <ScreenHeader eyebrow={definition.eyebrow} title={definition.title} subtitle={definition.description} />
        <View style={[styles.hero, { backgroundColor: definition.accent }]}>
          <View style={styles.heroIcon}><AppIcon name="auto-awesome" color="#FFFFFF" size={22} /></View>
          <Text style={styles.heroTitle}>Geminio OS workflow</Text>
          <Text style={styles.heroText}>Every action stays reviewable. External mutations require a configured provider and explicit confirmation.</Text>
        </View>
        {state === "success" ? <StateCard colors={colors} icon="check-circle" title="Saved successfully" text="The sandbox workflow completed and the next screen is ready." action="Continue" onPress={() => router.back()} /> : state === "confirm" ? <StateCard colors={colors} icon="help-outline" title="Confirmation required" text="Review the details and confirm with the configured provider before any purchase or financial mutation occurs." action="Confirm boundary" onPress={() => setState("success")} /> : state === "loading" ? <StateCard colors={colors} icon="sync" title="Processing securely" text="Validating inputs and preparing the provider-safe workflow." action="Preview offline state" onPress={() => setState("offline")} /> : state === "offline" ? <StateCard colors={colors} icon="cloud-off" title="You are offline" text="Your input is preserved locally. Retry when connectivity returns." action="Retry" onPress={() => setState("ready")} /> : state === "empty" ? <StateCard colors={colors} icon="inbox" title="Nothing here yet" text="Create the first item to continue this workflow." action="Start creating" onPress={() => setState("ready")} /> : <View style={[styles.card, { backgroundColor: colors.surface, borderColor: state === "error" ? colors.error : colors.border }]}>
          {definition.fields.length ? definition.fields.map((field) => <View key={field} style={styles.field}><Text style={[styles.label, { color: colors.foreground }]}>{field}</Text><TextInput value={values[field] ?? ""} onChangeText={(value) => setValues((current) => ({ ...current, [field]: value }))} placeholder={field} placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} returnKeyType="next" /></View>) : <Text style={[styles.body, { color: colors.muted }]}>This screen is ready for provider-backed content and displays a truthful empty state until data is available.</Text>}
          {state === "error" ? <Text style={[styles.error, { color: colors.error }]}>Complete the required fields before continuing.</Text> : null}
          <Pressable accessibilityRole="button" onPress={primaryAction} style={({ pressed }) => [styles.primary, { backgroundColor: definition.accent }, pressed && styles.pressed]}><Text style={styles.primaryText}>{definition.primary}</Text></Pressable>
          <View style={styles.secondaryRow}><Pressable accessibilityRole="button" onPress={() => setState("empty")} style={[styles.secondary, { borderColor: colors.border }]}><Text style={[styles.secondaryText, { color: colors.foreground }]}>Preview empty</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setState("offline")} style={[styles.secondary, { borderColor: colors.border }]}><Text style={[styles.secondaryText, { color: colors.foreground }]}>Preview offline</Text></Pressable></View>
        </View>}
      </ScrollView>
    </ScreenContainer>
  );
}

function dynamicDefinition(screen: string): Definition {
  const [area, ...parts] = screen.split("-");
  const title = parts.length ? parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") : "Workflow";
  const areaName = area ? area.charAt(0).toUpperCase() + area.slice(1) : "Geminio OS";
  return {
    title,
    eyebrow: `${areaName} · Workflow`,
    description: "Review this dedicated workflow, provide the required details, and continue through explicit loading, confirmation, success, offline, and retry states.",
    fields: ["Notes"],
    primary: "Continue workflow",
    accent: "#5B5FEF",
  };
}

function StateCard({ colors, icon, title, text, action, onPress }: { colors: ReturnType<typeof useColors>; icon: string; title: string; text: string; action: string; onPress: () => void }) {
  return <View style={[styles.stateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><AppIcon name={icon as never} color={colors.primary} size={28} /><Text style={[styles.stateTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.body, { color: colors.muted }]}>{text}</Text><Pressable accessibilityRole="button" onPress={onPress} style={[styles.primary, { backgroundColor: colors.primary }]}><Text style={styles.primaryText}>{action}</Text></Pressable></View>;
}

const styles = StyleSheet.create({ content: { padding: 20, gap: 18, paddingBottom: 48, maxWidth: 760, width: "100%", alignSelf: "center" }, hero: { borderRadius: 24, padding: 20, gap: 8 }, heroIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF25" }, heroTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" }, heroText: { color: "#FFFFFFDD", fontSize: 13, lineHeight: 19 }, card: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 14 }, field: { gap: 7 }, label: { fontSize: 13, fontWeight: "800" }, input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 }, primary: { minHeight: 50, borderRadius: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }, primaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 }, secondaryRow: { flexDirection: "row", gap: 10 }, secondary: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" }, secondaryText: { fontSize: 12, fontWeight: "800" }, stateCard: { borderWidth: 1, borderRadius: 22, padding: 22, gap: 12, alignItems: "center" }, stateTitle: { fontSize: 19, fontWeight: "800" }, body: { fontSize: 13, lineHeight: 19, textAlign: "center" }, error: { fontSize: 13, fontWeight: "700" }, pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] } });
