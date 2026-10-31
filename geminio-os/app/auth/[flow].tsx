import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { BrandMark } from "@/components/brand-mark";
import { useColors } from "@/hooks/use-colors";

type Flow = "sign-in" | "sign-up" | "recovery" | "forgot-password" | "reset-password" | "verify-email" | "oauth" | "mfa" | "link-account" | "onboarding";
type Field = { key: string; label: string; placeholder: string; secure?: boolean; email?: boolean; keyboard?: "default" | "email-address" | "number-pad" };
const definitions: Record<Flow, { eyebrow: string; title: string; description: string; fields: Field[]; action: string }> = {
  "sign-in": { eyebrow: "WELCOME BACK", title: "Sign in", description: "Continue to your Geminio OS workspace.", fields: [{ key: "email", label: "Email address", placeholder: "you@example.com", email: true }, { key: "password", label: "Password", placeholder: "Enter your password", secure: true }], action: "Sign in securely" },
  "sign-up": { eyebrow: "CREATE YOUR ACCOUNT", title: "Join Geminio OS", description: "One account for your connected intelligent workspace.", fields: [{ key: "name", label: "Full name", placeholder: "Your full name" }, { key: "email", label: "Email address", placeholder: "you@example.com", email: true }, { key: "password", label: "Create password", placeholder: "At least 10 characters", secure: true }, { key: "confirmPassword", label: "Confirm password", placeholder: "Enter password again", secure: true }], action: "Create account" },
  recovery: { eyebrow: "ACCOUNT RECOVERY", title: "Forgot your password?", description: "Enter the email address associated with your account.", fields: [{ key: "email", label: "Email address", placeholder: "you@example.com", email: true }], action: "Send recovery link" },
  "forgot-password": { eyebrow: "ACCOUNT RECOVERY", title: "Forgot your password?", description: "Enter the email address associated with your account.", fields: [{ key: "email", label: "Email address", placeholder: "you@example.com", email: true }], action: "Send recovery link" },
  "reset-password": { eyebrow: "SECURE YOUR ACCOUNT", title: "Create a new password", description: "Choose a new password for your Geminio OS account.", fields: [{ key: "password", label: "New password", placeholder: "At least 8 characters", secure: true }, { key: "confirmPassword", label: "Confirm new password", placeholder: "Enter password again", secure: true }], action: "Update password" },
  "verify-email": { eyebrow: "VERIFY YOUR EMAIL", title: "Check your inbox", description: "Enter the verification code sent to your email address.", fields: [{ key: "code", label: "6-digit verification code", placeholder: "000000", keyboard: "number-pad" }], action: "Verify email" },
  oauth: { eyebrow: "SECURE PROVIDER SIGN-IN", title: "Continue with a provider", description: "Geminio OS will use only an OAuth provider configured by the platform administrator.", fields: [], action: "Continue" },
  mfa: { eyebrow: "ACCOUNT SECURITY", title: "Verify your identity", description: "Enter the one-time code from your configured authenticator.", fields: [{ key: "code", label: "Verification code", placeholder: "Enter code", keyboard: "number-pad" }], action: "Verify code" },
  "link-account": { eyebrow: "CONNECTED IDENTITY", title: "Link an account", description: "Provider linking becomes available when an approved identity provider is configured.", fields: [], action: "Review provider" },
  onboarding: { eyebrow: "PERSONALIZE YOUR WORKSPACE", title: "Set up your profile", description: "Your workspace preferences can be completed after secure account authentication.", fields: [{ key: "name", label: "Display name", placeholder: "How should we address you?" }], action: "Continue setup" },
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthFlowScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ flow?: string; token?: string; email?: string }>();
  const raw = typeof params.flow === "string" ? params.flow : "sign-in";
  const flow = (raw in definitions ? raw : "sign-in") as Flow;
  const details = useMemo(() => definitions[flow], [flow]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (typeof params.token === "string") setValues((v) => ({ ...v, token: params.token! })); }, [params.token]);

  const setValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const validate = () => {
    for (const field of details.fields) {
      const value = values[field.key]?.trim() ?? "";
      if (!value && !(flow === "verify-email" && field.key === "code")) return `${field.label} is required.`;
      if (field.email && !emailPattern.test(value)) return "Enter a valid email address.";
    }
    if (flow === "sign-up" || flow === "reset-password") {
      if ((values.password ?? "").length < 8) return "Use a password with at least 8 characters.";
      if (values.password !== values.confirmPassword) return "Your passwords do not match.";
    }
    if (flow === "sign-up" && !acceptedTerms) return "Please accept the Terms and Privacy Notice to continue.";
    if (flow === "verify-email" && !/^\d{6}$/.test(values.code ?? "")) return "Enter the 6-digit verification code.";
    return "";
  };

  const submit = async () => {
    const validation = validate();
    if (validation) { setError(validation); return; }
    const apiBase = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\\/$/, "");
    const request = async (path: string, body: Record<string, unknown>) => {
      const response = await fetch(apiBase + path, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || "The request could not be completed.");
      return data;
    };
    setBusy(true); setError("");
    try {
      if (flow === "sign-up") {
        const result = await request("/api/auth/register", { name: values.name, email: values.email, password: values.password, acceptedTerms });
        Alert.alert("Check your email", result.message || "If registration was accepted, check your inbox for a verification code.");
        router.replace({ pathname: "/auth/[flow]", params: { flow: "verify-email", email: values.email } });
      } else if (flow === "sign-in") {
        await request("/api/auth/sign-in", { email: values.email, password: values.password });
        router.replace("/(tabs)");
      } else if (flow === "verify-email") {
        await request("/api/auth/email/verify", { email: params.email, code: values.code });
        Alert.alert("Email verified", "Your account is now verified.");
        router.replace("/(tabs)");
      } else if (flow === "forgot-password" || flow === "recovery") {
        const result = await request("/api/auth/password/forgot", { email: values.email });
        Alert.alert("Check your inbox", result.message);
      } else if (flow === "reset-password") {
        await request("/api/auth/password/reset", { token: params.token || values.token, password: values.password });
        Alert.alert("Password updated", "Sign in with your new password.");
        router.replace({ pathname: "/auth/[flow]", params: { flow: "sign-in" } });
      } else {
        throw new Error("This identity provider flow is not configured yet.");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Authentication failed. Please try again."); }
    finally { setBusy(false); }
  };

  const titleColor = colors.foreground;
  const isRecovery = flow === "recovery" || flow === "forgot-password";

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} className="p-0">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, { color: colors.foreground }]}>←  Back</Text>
          </Pressable>

          <View style={styles.brand}><BrandMark size={54} showWordmark /></View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{details.eyebrow}</Text>
          <Text style={[styles.title, { color: titleColor }]}>{details.title}</Text>
          <Text style={[styles.description, { color: colors.muted }]}>{details.description}</Text>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {details.fields.map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={[styles.label, { color: colors.foreground }]}>{field.label}</Text>
                <View style={[styles.inputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <TextInput
                    value={values[field.key] ?? ""}
                    onChangeText={(value) => setValue(field.key, field.keyboard === "number-pad" ? value.replace(/\D/g, "").slice(0, 6) : value)}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.muted}
                    secureTextEntry={field.secure && !visiblePasswords[field.key]}
                    keyboardType={field.email ? "email-address" : field.keyboard ?? "default"}
                    autoCapitalize={field.email || field.secure || field.keyboard === "number-pad" ? "none" : "words"}
                    autoCorrect={false}
                    textContentType={field.key === "password" ? "newPassword" : field.email ? "emailAddress" : "none"}
                    style={[styles.input, { color: colors.foreground }]}
                    accessibilityLabel={field.label}
                  />
                  {field.secure ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={visiblePasswords[field.key] ? "Hide password" : "Show password"} onPress={() => setVisiblePasswords((current) => ({ ...current, [field.key]: !current[field.key] }))} style={styles.visibilityButton}>
                      <Text style={[styles.visibilityText, { color: colors.primary }]}>{visiblePasswords[field.key] ? "Hide" : "Show"}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}

            {flow === "sign-up" ? (
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: acceptedTerms }} onPress={() => setAcceptedTerms((value) => !value)} style={styles.consentRow}>
                <View style={[styles.checkbox, { borderColor: acceptedTerms ? colors.primary : colors.border, backgroundColor: acceptedTerms ? colors.primary : "transparent" }]}>
                  {acceptedTerms ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text style={[styles.consentText, { color: colors.muted }]}>I agree to the Terms of Service and Privacy Notice.</Text>
              </Pressable>
            ) : null}

            {error ? <View style={[styles.errorBox, { backgroundColor: colors.error + "14", borderColor: colors.error + "55" }]}><Text style={[styles.errorText, { color: colors.error }]}>{error}</Text></View> : null}

            <Pressable accessibilityRole="button" onPress={submit} disabled={busy} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, opacity: pressed || busy ? 0.78 : 1 }]}>
              <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>{busy ? "Please wait…" : details.action}</Text>
              <Text style={[styles.buttonArrow, { color: colors.primaryForeground }]}>→</Text>
            </Pressable>

            {flow === "sign-up" ? (
              <Pressable onPress={() => router.push({ pathname: "/auth/[flow]", params: { flow: "oauth" } })} style={[styles.providerButton, { borderColor: colors.border }]}>
                <Text style={[styles.providerText, { color: colors.foreground }]}>Continue with a configured provider</Text>
              </Pressable>
            ) : null}
            {flow === "oauth" ? <Text style={[styles.helper, { color: colors.muted }]}>OAuth initiation is not yet exposed by the current server. The callback and mobile code-exchange routes exist, but the authorization-start route must be configured before this button can launch a provider.</Text> : null}
          </View>

          {flow === "sign-in" ? (
            <Pressable onPress={() => router.push({ pathname: "/auth/[flow]", params: { flow: "forgot-password" } })} style={styles.linkButton}><Text style={[styles.linkText, { color: colors.primary }]}>Forgot password?</Text></Pressable>
          ) : null}
          {isRecovery ? (
            <Text style={[styles.helper, { color: colors.muted }]}>For privacy, a production recovery flow should return the same confirmation for registered and unregistered email addresses.</Text>
          ) : null}
          {flow === "sign-up" || flow === "sign-in" ? (
            <Pressable onPress={() => router.replace({ pathname: "/auth/[flow]", params: { flow: flow === "sign-up" ? "sign-in" : "sign-up" } })} style={styles.footerLink}>
              <Text style={[styles.footerText, { color: colors.muted }]}>{flow === "sign-up" ? "Already have an account? " : "New to Geminio OS? "}<Text style={{ color: colors.primary, fontWeight: "800" }}>{flow === "sign-up" ? "Sign in" : "Create an account"}</Text></Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => Alert.alert("Privacy and security", "Geminio OS must use verified server-side identity, secure session handling, and explicit consent. This screen does not store or transmit your password.")}>
            <Text style={[styles.privacy, { color: colors.muted }]}>Privacy & security</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 22, paddingBottom: 44, width: "100%", maxWidth: 560, alignSelf: "center" },
  backButton: { alignSelf: "flex-start", paddingVertical: 10, paddingRight: 18 },
  backText: { fontSize: 14, fontWeight: "700" },
  brand: { alignItems: "center", marginTop: 12, marginBottom: 30 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 9 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.8 },
  description: { fontSize: 14, lineHeight: 21, marginTop: 9, marginBottom: 24 },
  card: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 17 },
  field: { gap: 8 },
  label: { fontSize: 12, fontWeight: "800" },
  inputWrap: { minHeight: 54, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "center", paddingHorizontal: 13 },
  input: { flex: 1, minHeight: 52, fontSize: 14, paddingVertical: 10 },
  visibilityButton: { paddingHorizontal: 7, paddingVertical: 10 },
  visibilityText: { fontSize: 12, fontWeight: "800" },
  consentRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 20, height: 20, borderWidth: 1.5, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  checkmark: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  consentText: { flex: 1, fontSize: 12, lineHeight: 18 },
  errorBox: { borderWidth: 1, borderRadius: 12, padding: 12 },
  errorText: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
  primaryButton: { minHeight: 54, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, gap: 10, marginTop: 2 },
  primaryText: { fontSize: 14, fontWeight: "900" },
  buttonArrow: { fontSize: 19, fontWeight: "700" },
  providerButton: { minHeight: 50, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  providerText: { fontSize: 12, fontWeight: "800" },
  helper: { fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 3 },
  linkButton: { alignSelf: "flex-end", paddingVertical: 16 },
  linkText: { fontSize: 12, fontWeight: "800" },
  footerLink: { paddingVertical: 20, alignItems: "center" },
  footerText: { fontSize: 12 },
  privacy: { textAlign: "center", fontSize: 11, paddingVertical: 10 },
});
