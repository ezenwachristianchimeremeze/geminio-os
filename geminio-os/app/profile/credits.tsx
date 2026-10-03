import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { AppIcon, IconButton, ScreenHeader, SectionTitle } from "@/components/super-app";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const PLANS = [
  { name: "Free", description: "Explore conversations and the core workspace.", accent: "#64748B" },
  { name: "Pro", description: "More AI capacity, builder workflows, and priority execution.", accent: "#635BFF" },
  { name: "Business", description: "Shared workspaces, governance, and higher automation limits.", accent: "#0E9F6E" },
] as const;

export default function CreditsScreen() {
  const colors = useColors();
  const ledgerQuery = trpc.credits.ledger.useQuery(undefined, { retry: false });
  const entitlementQuery = trpc.credits.entitlements.useQuery(undefined, { retry: false });
  const ledger = ledgerQuery.data?.data ?? [];
  const entitlements = entitlementQuery.data?.data ?? [];
  const latestBalance = ledger[0] ? Number(ledger[0].balanceAfter) : null;
  const accountUnavailable = Boolean(ledgerQuery.error || entitlementQuery.error);

  const handlePlanPress = (plan: string) => {
    Alert.alert(
      `${plan} plan`,
      accountUnavailable
        ? "Connect or sign in to your Geminio account to view live plan eligibility and continue to checkout. No purchase was created."
        : "Checkout is provider-controlled. Geminio will show the final price and receipt status before any purchase is confirmed.",
    );
  };

  return (
    <ScreenContainer className="p-0" edges={["top", "left", "right", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <IconButton icon="arrow-back" label="Go back" onPress={() => router.back()} />
          <Text style={[styles.topLabel, { color: colors.muted }]}>Billing</Text>
          <View style={styles.topSpacer} />
        </View>
        <ScreenHeader eyebrow="Usage & access" title="Credits & plans" subtitle="See usage, entitlements, and plan access with provider-safe checkout." />

        <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}> 
          <View style={styles.balanceIcon}><AppIcon name="bolt" color={colors.primary} size={20} /></View>
          <Text style={styles.balanceLabel}>Available credits</Text>
          <Text style={styles.balanceValue}>
            {ledgerQuery.isLoading ? "Loading…" : latestBalance === null ? "Not connected" : latestBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.balanceHint}>{accountUnavailable ? "Sign in to sync usage across devices." : "Usage is metered by capability and recorded in the ledger."}</Text>
        </View>

        <SectionTitle title="Plans" />
        <View style={styles.planList}>
          {PLANS.map((plan) => (
            <Pressable key={plan.name} accessibilityRole="button" accessibilityLabel={`View ${plan.name} plan`} onPress={() => handlePlanPress(plan.name)} style={({ pressed }) => [styles.planCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
              <View style={[styles.planIcon, { backgroundColor: `${plan.accent}18` }]}><AppIcon name="auto-awesome" color={plan.accent} size={18} /></View>
              <View style={styles.planCopy}><Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text><Text style={[styles.planDescription, { color: colors.muted }]}>{plan.description}</Text></View>
              <AppIcon name="chevron-right" color={colors.muted} size={18} />
            </Pressable>
          ))}
        </View>

        <SectionTitle title="Current entitlements" />
        {entitlements.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppIcon name={accountUnavailable ? "lock-outline" : "receipt-long"} color={colors.muted} size={24} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{accountUnavailable ? "Account connection required" : "No active entitlements"}</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>{accountUnavailable ? "Sign in to load plans and receipts from the secure account boundary." : "Choose a plan to unlock additional capabilities. Geminio will confirm eligibility before checkout."}</Text>
          </View>
        ) : (
          <View style={[styles.entitlementCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {entitlements.map((item) => (
              <View key={item.id} style={styles.entitlementRow}>
                <View style={[styles.statusDot, { backgroundColor: item.status === "active" || item.status === "trial" ? colors.success : colors.warning }]} />
                <View style={styles.planCopy}><Text style={[styles.planName, { color: colors.foreground }]}>{item.productId}</Text><Text style={[styles.planDescription, { color: colors.muted }]}>{item.status} · {item.source}</Text></View>
              </View>
            ))}
          </View>
        )}

        <SectionTitle title="Recent credit activity" />
        {ledger.length === 0 ? (
          <Text style={[styles.mutedNote, { color: colors.muted }]}>No credit movements are available yet.</Text>
        ) : (
          <View style={[styles.entitlementCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {ledger.slice(0, 5).map((entry) => (
              <View key={entry.id} style={styles.entitlementRow}><AppIcon name={Number(entry.amount) >= 0 ? "add-circle-outline" : "remove-circle-outline"} color={Number(entry.amount) >= 0 ? colors.success : colors.warning} size={20} /><View style={styles.planCopy}><Text style={[styles.planName, { color: colors.foreground }]}>{entry.kind}</Text><Text style={[styles.planDescription, { color: colors.muted }]}>{entry.capability ?? "Account adjustment"}</Text></View><Text style={[styles.amount, { color: Number(entry.amount) >= 0 ? colors.success : colors.error }]}>{Number(entry.amount) >= 0 ? "+" : ""}{Number(entry.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text></View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 44, maxWidth: 760, width: "100%", alignSelf: "center" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  topLabel: { fontSize: 12, fontWeight: "800" },
  topSpacer: { width: 42 },
  balanceCard: { borderRadius: 24, padding: 20, marginTop: 18, minHeight: 170 },
  balanceIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  balanceLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "700" },
  balanceValue: { color: "#FFFFFF", fontSize: 30, fontWeight: "900", marginTop: 5 },
  balanceHint: { color: "rgba(255,255,255,0.78)", fontSize: 12, lineHeight: 17, marginTop: 8 },
  planList: { gap: 10 },
  planCard: { minHeight: 76, borderRadius: 19, borderWidth: 1, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  planIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  planCopy: { flex: 1, gap: 3 },
  planName: { fontSize: 14, fontWeight: "800", textTransform: "capitalize" },
  planDescription: { fontSize: 12, lineHeight: 16 },
  entitlementCard: { borderWidth: 1, borderRadius: 19, overflow: "hidden" },
  entitlementRow: { minHeight: 65, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(128,128,128,0.2)" },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  amount: { fontSize: 13, fontWeight: "900" },
  emptyCard: { minHeight: 150, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 20 },
  emptyTitle: { fontSize: 15, fontWeight: "800" },
  emptyText: { fontSize: 12, lineHeight: 17, textAlign: "center" },
  mutedNote: { fontSize: 13, paddingVertical: 8 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
