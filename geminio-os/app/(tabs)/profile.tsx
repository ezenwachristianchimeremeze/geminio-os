import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { AppIcon, IconButton, ScreenHeader } from "@/components/super-app";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";

interface SettingRowProps { icon: "dark-mode" | "notifications-none" | "fingerprint" | "language" | "help-outline" | "feedback" | "logout" | "account-balance-wallet"; title: string; subtitle: string; trailing?: React.ReactNode; onPress?: () => void; danger?: boolean; }

export default function ProfileScreen() {
  const colors = useColors();
  const { logout } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  return (
    <ScreenContainer className="p-0" edges={["top", "left", "right", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ScreenHeader eyebrow="Your account" title="Profile" subtitle="Make Geminio work the way you do." action={<IconButton icon="settings" label="Open profile settings" onPress={() => router.push("/profile/settings")} />} />

        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={styles.avatarText}>G</Text></View>
          <View style={styles.profileCopy}><Text style={[styles.profileName, { color: colors.foreground }]}>Geminio member</Text><Text style={[styles.profileEmail, { color: colors.muted }]}>Your private AI workspace</Text><View style={styles.planPill}><AppIcon name="auto-awesome" color={colors.primary} size={13} /><Text style={[styles.planText, { color: colors.primary }]}>Personal plan</Text></View></View>
          <AppIcon name="chevron-right" color={colors.muted} size={20} />
        </View>

        <Text style={[styles.groupTitle, { color: colors.muted }]}>Preferences</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow icon="dark-mode" title="Appearance" subtitle="Light, dark, and system themes" trailing={<Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFFFFF" />} />
          <SettingRow icon="notifications-none" title="Notifications" subtitle="Product updates and workspace activity" trailing={<Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFFFFF" />} />
          <SettingRow icon="language" title="Language & region" subtitle="English · GMT+1" onPress={() => router.push("/profile/settings")} />
        </View>

        <Text style={[styles.groupTitle, { color: colors.muted }]}>Usage & billing</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow icon="account-balance-wallet" title="Credits & plans" subtitle="Usage ledger, entitlements, and provider-controlled checkout" onPress={() => router.push("/profile/credits")} />
        </View>

        <Text style={[styles.groupTitle, { color: colors.muted }]}>Privacy & security</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow icon="fingerprint" title="Security center" subtitle="Passcode, biometrics, and connected devices" onPress={() => router.push({ pathname: "/workspace/[product]", params: { product: "security-guardian" } })} />
          <SettingRow icon="feedback" title="Data & memory" subtitle="Manage what Geminio remembers" onPress={() => router.push("/profile/settings")} />
        </View>

        <Text style={[styles.groupTitle, { color: colors.muted }]}>Support</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow icon="help-outline" title="Help center" subtitle="Guides and answers" onPress={() => router.push({ pathname: "/workspace/[product]", params: { product: "personal-assistant" } })} />
          <SettingRow icon="feedback" title="Send feedback" subtitle="Help us improve Geminio" onPress={() => router.push("/profile/settings")} />
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={() => void logout()} style={({ pressed }) => [styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
          <AppIcon name="logout" color={colors.error} size={19} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Log out</Text>
        </Pressable>
        <Text style={[styles.versionText, { color: colors.muted }]}>Geminio OS · v1.0.0</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function SettingRow({ icon, title, subtitle, trailing, onPress, danger }: SettingRowProps) {
  const colors = useColors();
  const content = <><View style={[styles.settingIcon, { backgroundColor: danger ? `${colors.error}14` : `${colors.primary}12` }]}><AppIcon name={icon} color={danger ? colors.error : colors.primary} size={19} /></View><View style={styles.settingCopy}><Text style={[styles.settingTitle, { color: danger ? colors.error : colors.foreground }]}>{title}</Text><Text style={[styles.settingSubtitle, { color: colors.muted }]}>{subtitle}</Text></View>{trailing ?? <AppIcon name="chevron-right" color={colors.muted} size={19} />}</>;
  if (!onPress) return <View style={styles.settingRow}>{content}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 17, paddingBottom: 40 },
  profileCard: { minHeight: 104, borderRadius: 22, borderWidth: 1, padding: 15, flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20 },
  avatar: { width: 56, height: 56, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  profileCopy: { flex: 1, gap: 3 },
  profileName: { fontSize: 16, fontWeight: "800" },
  profileEmail: { fontSize: 12 },
  planPill: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  planText: { fontSize: 11, fontWeight: "800" },
  groupTitle: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7, marginTop: 22, marginBottom: 8 },
  settingsGroup: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  settingRow: { minHeight: 72, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  settingIcon: { width: 37, height: 37, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { fontSize: 14, fontWeight: "800" },
  settingSubtitle: { fontSize: 12, lineHeight: 16 },
  logoutButton: { minHeight: 52, borderRadius: 17, borderWidth: 1, marginTop: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  logoutText: { fontSize: 14, fontWeight: "800" },
  versionText: { textAlign: "center", fontSize: 11, marginTop: 13 },
  pressed: { opacity: 0.7 },
});
