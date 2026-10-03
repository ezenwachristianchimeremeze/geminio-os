import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppIcon, ScreenHeader } from "@/components/super-app";
import { useColors } from "@/hooks/use-colors";

export default function WalletScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} className="p-0">
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow="Workspace · Wallet"
          title="Wallet"
          subtitle="Connect a supported financial provider to view accounts and authorize transactions."
        />

        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View style={styles.iconCircle}>
            <AppIcon name="account-balance-wallet" color="#FFFFFF" size={24} />
          </View>
          <Text style={styles.heroTitle}>Your money stays under your control</Text>
          <Text style={styles.heroText}>
            Geminio OS does not invent balances or simulate financial success. Provider data appears only after a verified connection.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={[styles.statusIcon, { backgroundColor: `${colors.warning}22` }]}>
              <AppIcon name="link-off" color={colors.warning} size={22} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: colors.foreground }]}>No financial provider connected</Text>
              <Text style={[styles.body, { color: colors.muted }]}>Balance, transactions, cards, and transfers are unavailable until a supported provider authorizes access.</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review wallet provider connection"
            onPress={() => router.push("/blueprint/wallet-transfer")}
            style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary }, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Review connection boundary</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          {[
            ["Accounts", "Connect a provider to view accounts", "account-balance"],
            ["Transactions", "Provider data will appear here", "receipt-long"],
            ["Send & receive", "Explicit confirmation required", "swap-horiz"],
            ["Analytics", "Insights require verified history", "analytics"],
          ].map(([title, description, icon]) => (
            <View key={title} style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <AppIcon name={icon as never} color={colors.muted} size={20} />
              <Text style={[styles.tileTitle, { color: colors.foreground }]}>{title}</Text>
              <Text style={[styles.tileText, { color: colors.muted }]}>{description}</Text>
              <Text style={[styles.unavailable, { color: colors.warning }]}>Unavailable</Text>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Wallet product dashboard"
          onPress={() => router.push("/workspace/wallet")}
          style={({ pressed }) => [styles.secondary, { borderColor: colors.border }, pressed && styles.pressed]}
        >
          <Text style={[styles.secondaryText, { color: colors.foreground }]}>Open Wallet dashboard</Text>
          <AppIcon name="arrow-forward" color={colors.foreground} size={18} />
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 44, maxWidth: 760, width: "100%", alignSelf: "center" },
  hero: { borderRadius: 24, padding: 22, gap: 10 },
  iconCircle: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF26" },
  heroTitle: { color: "#FFFFFF", fontSize: 22, lineHeight: 28, fontWeight: "800" },
  heroText: { color: "#FFFFFFDD", fontSize: 13, lineHeight: 19 },
  card: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 18 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  statusIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 6 },
  title: { fontSize: 17, fontWeight: "800", lineHeight: 22 },
  body: { fontSize: 13, lineHeight: 19 },
  primary: { minHeight: 50, borderRadius: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { width: "48%", minHeight: 142, borderWidth: 1, borderRadius: 18, padding: 14, gap: 8 },
  tileTitle: { fontSize: 14, fontWeight: "800" },
  tileText: { flex: 1, fontSize: 12, lineHeight: 17 },
  unavailable: { fontSize: 11, fontWeight: "800" },
  secondary: { minHeight: 50, borderWidth: 1, borderRadius: 15, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  secondaryText: { fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
