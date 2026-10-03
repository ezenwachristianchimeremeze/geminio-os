import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppIcon, IconButton, ScreenHeader } from "@/components/super-app";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

type Flow = "sign-in" | "sign-up" | "recovery" | "mfa" | "link-account" | "onboarding";
type FlowState = "form" | "loading" | "success" | "error";

const content: Record<Flow, { title: string; eyebrow: string; description: string; primary: string; fields: string[] }> = {
  "sign-in": { title: "Sign in", eyebrow: "Welcome back", description: "Continue to your Geminio OS workspace with a secure account session.", primary: "Sign in securely", fields: ["Email", "Password"] },
  "sign-up": { title: "Create your account", eyebrow: "Get started", description: "Create a Geminio OS identity and personalize your workspace.", primary: "Create account", fields: ["Name", "Email", "Password"] },
  recovery: { title: "Recover access", eyebrow: "Account recovery", description: "Request a secure recovery link without exposing account details in the client.", primary: "Request recovery", fields: ["Email"] },
  mfa: { title: "Verify your identity", eyebrow: "Multi-factor authentication", description: "Enter the one-time verification code from your trusted authenticator.", primary: "Verify code", fields: ["Verification code"] },
  "link-account": { title: "Link an account", eyebrow: "Connected identity", description: "Review the provider, requested permissions, and unlink controls before connecting.", primary: "Review provider", fields: ["Provider or account email"] },
  onboarding: { title: "Personalize your workspace", eyebrow: "Welcome to Geminio OS", description: "Set your profile, interests, goals, notifications, and privacy preferences before entering your workspace.", primary: "Finish setup", fields: ["Display name", "Primary goal", "Interests", "Notification preference", "Privacy preference"] },
};

export default function AuthFlowScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ flow?: string }>();
  const rawFlow = typeof params.flow === "string" ? params.flow : "sign-in";
  const normalizedFlow = rawFlow === "onboarding-profile" ? "onboarding" : rawFlow;
  const flow = (normalizedFlow in content ? normalizedFlow : "sign-in") as Flow;
  const details = useMemo(() => content[flow], [flow]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<FlowState>("form");

  const submit = () => {
    if (details.fields.some((field) => !values[field]?.trim())) {
      setState("error");
      return;
    }
    setState("loading");
    setTimeout(() => setState("success"), 500);
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} className="p-0">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <IconButton icon="arrow-back" label="Back to authentication" onPress={() => router.back()} />
        <ScreenHeader eyebrow={details.eyebrow} title={details.title} subtitle={details.description} />
        <View style={[styles.brandCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.brandIcon, { backgroundColor: colors.primary }]}><AppIcon name="auto-awesome" color="#FFFFFF" size={22} /></View>
          <View style={styles.brandCopy}><Text style={[styles.brandTitle, { color: colors.foreground }]}>Secure by design</Text><Text style={[styles.brandText, { color: colors.muted }]}>Credentials are handled through the configured authentication provider. This screen never claims a live provider connection until it is configured.</Text></View>
        </View>
        {state === "success" ? (
          <View style={[styles.successCard, { backgroundColor: `${colors.success}14`, borderColor: colors.success }]}>
            <AppIcon name="check-circle" color={colors.success} size={28} />
            <Text style={[styles.successTitle, { color: colors.foreground }]}>{flow === "link-account" ? "Provider review ready" : flow === "onboarding" ? "Workspace ready" : "Request accepted"}</Text>
            <Text style={[styles.successText, { color: colors.muted }]}>{flow === "onboarding" ? "Your setup preferences are ready for the Geminio OS workspace. You can change them later from Profile and Settings." : "The sandbox contract completed safely. A production provider must confirm the next step before any account or session mutation occurs."}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace(flow === "onboarding" ? "/(tabs)" : "/auth-screen")} style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={styles.primaryText}>{flow === "onboarding" ? "Enter Geminio OS" : "Return to authentication"}</Text></Pressable>
          </View>
        ) : (
          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: state === "error" ? colors.error : colors.border }]}>
            {details.fields.map((field) => <View key={field} style={styles.field}><Text style={[styles.label, { color: colors.foreground }]}>{field}</Text><TextInput value={values[field] ?? ""} onChangeText={(value) => setValues((current) => ({ ...current, [field]: value }))} placeholder={field} placeholderTextColor={colors.muted} secureTextEntry={field.toLowerCase().includes("password")} keyboardType={field.toLowerCase().includes("email") ? "email-address" : "default"} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} returnKeyType="next" /></View>)}
            {state === "error" ? <Text style={[styles.errorText, { color: colors.error }]}>Complete each required field before continuing.</Text> : null}
            <Pressable accessibilityRole="button" onPress={submit} disabled={state === "loading"} style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={styles.primaryText}>{state === "loading" ? "Working securely…" : details.primary}</Text></Pressable>
            <Text style={[styles.helper, { color: colors.muted }]}>No external action is performed until the provider boundary, permissions, and confirmation requirements are satisfied.</Text>
          </View>
        )}
        <Pressable accessibilityRole="button" onPress={() => Alert.alert("Privacy", "Geminio OS will only retain the minimum data required by the configured identity provider and your selected workspace settings.")}><Text style={[styles.link, { color: colors.primary }]}>Review privacy and security controls</Text></Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 18, paddingBottom: 48, maxWidth: 640, width: "100%", alignSelf: "center" },
  brandCard: { borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: "row", gap: 12 },
  brandIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  brandCopy: { flex: 1, gap: 4 },
  brandTitle: { fontSize: 15, fontWeight: "800" },
  brandText: { fontSize: 12, lineHeight: 18 },
  formCard: { borderWidth: 1, borderRadius: 22, padding: 17, gap: 14 },
  field: { gap: 7 },
  label: { fontSize: 13, fontWeight: "800" },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 },
  primary: { minHeight: 50, borderRadius: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  helper: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  errorText: { fontSize: 13, fontWeight: "700" },
  successCard: { borderWidth: 1, borderRadius: 22, padding: 22, gap: 12, alignItems: "center" },
  successTitle: { fontSize: 19, fontWeight: "800" },
  successText: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  link: { textAlign: "center", fontSize: 13, fontWeight: "800", paddingVertical: 10 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
});
