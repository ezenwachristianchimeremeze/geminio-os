import { useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { AppIcon, IconButton, ScreenHeader } from "@/components/super-app";
import { useColors } from "@/hooks/use-colors";
import { useMemory } from "@/lib/memory-context";
import { useThemeContext } from "@/lib/theme-provider";

export default function ProfileSettingsScreen() {
  const colors = useColors();
  const { colorScheme, setColorScheme } = useThemeContext();
  const { exportMemories, clearMemories } = useMemory();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [productEmails, setProductEmails] = useState(true);
  const [memory, setMemory] = useState(true);

  const handleExport = async () => {
    try {
      const payload = await exportMemories();
      await Share.share({
        title: "Geminio OS data export",
        message: payload,
      });
    } catch {
      Alert.alert("Export unavailable", "Geminio could not prepare your local memory export. Please try again.");
    }
  };

  const handleClearMemory = () => {
    Alert.alert(
      "Clear local memory?",
      "This removes conversations and saved context stored on this device. It does not delete server-side account data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear memory",
          style: "destructive",
          onPress: () => {
            void clearMemories().then(() => Alert.alert("Memory cleared", "Local Geminio memory has been removed from this device."));
          },
        },
      ],
    );
  };

  const showPrivacy = () => {
    Alert.alert(
      "Privacy at Geminio OS",
      "Geminio keeps provider credentials on the server boundary, stores local memory on this device, and requires explicit authorization for sensitive actions. You can export or clear local memory at any time.",
    );
  };

  const showAbout = () => {
    Alert.alert("About Geminio OS", "Geminio OS 1.0.0\nAn AI-first workspace for conversations, creation, and productive work.");
  };

  return (
    <ScreenContainer className="p-0" edges={["top", "left", "right", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topRow}><IconButton icon="arrow-back" label="Go back" onPress={() => router.back()} /><Text style={[styles.topLabel, { color: colors.muted }]}>Profile</Text><View style={styles.topSpacer} /></View>
        <ScreenHeader eyebrow="Account controls" title="Settings" subtitle="Tune your Geminio experience and privacy preferences." />

        <Text style={[styles.groupTitle, { color: colors.muted }]}>Experience</Text>
        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <SettingRow icon="dark-mode" title="Dark mode" description="Use a darker palette across the app." trailing={<Switch value={colorScheme === "dark"} onValueChange={(value) => setColorScheme(value ? "dark" : "light")} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFFFFF" />} />
          <SettingRow icon="animation" title="Reduce motion" description="Use simpler transitions throughout Geminio." trailing={<Switch value={reduceMotion} onValueChange={setReduceMotion} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFFFFF" />} />
          <SettingRow icon="notifications-none" title="Product updates" description="Receive occasional news about new capabilities." trailing={<Switch value={productEmails} onValueChange={setProductEmails} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFFFFF" />} />
        </View>

        <Text style={[styles.groupTitle, { color: colors.muted }]}>Memory & privacy</Text>
        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <SettingRow icon="psychology" title="Personalized memory" description="Use your saved context to make answers more useful." trailing={<Switch value={memory} onValueChange={setMemory} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFFFFF" />} />
          <SettingRow icon="download" title="Export my data" description="Share your conversations and project history as JSON." onPress={() => void handleExport()} />
          <SettingRow icon="delete-outline" title="Clear local memory" description="Remove saved context from this device." onPress={handleClearMemory} danger />
        </View>

        <Text style={[styles.groupTitle, { color: colors.muted }]}>About</Text>
        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <SettingRow icon="description" title="Privacy policy" description="How Geminio handles your information." onPress={showPrivacy} />
          <SettingRow icon="info-outline" title="About Geminio OS" description="Version 1.0.0" onPress={showAbout} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function SettingRow({ icon, title, description, trailing, onPress, danger }: { icon: "dark-mode" | "animation" | "notifications-none" | "psychology" | "download" | "delete-outline" | "description" | "info-outline"; title: string; description: string; trailing?: React.ReactNode; onPress?: () => void; danger?: boolean }) {
  const colors = useColors();
  const content = <><View style={[styles.icon, { backgroundColor: danger ? `${colors.error}14` : `${colors.primary}12` }]}><AppIcon name={icon} color={danger ? colors.error : colors.primary} size={19} /></View><View style={styles.copy}><Text style={[styles.title, { color: danger ? colors.error : colors.foreground }]}>{title}</Text><Text style={[styles.description, { color: colors.muted }]}>{description}</Text></View>{trailing ?? <AppIcon name="chevron-right" color={colors.muted} size={19} />}</>;
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 42 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  topLabel: { fontSize: 12, fontWeight: "800" },
  topSpacer: { width: 42 },
  groupTitle: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7, marginTop: 24, marginBottom: 8 },
  group: { borderWidth: 1, borderRadius: 20, overflow: "hidden" },
  row: { minHeight: 76, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  icon: { width: 37, height: 37, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: "800" },
  description: { fontSize: 12, lineHeight: 16 },
  pressed: { opacity: 0.7 },
});
