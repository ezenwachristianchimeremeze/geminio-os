import { useEffect, useRef } from "react";
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

export function CapabilityStateBadge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" }) {
  const colors = useColors();
  const color = tone === "success" ? colors.success : tone === "warning" ? colors.warning : colors.muted;
  return <View accessible accessibilityRole="text" style={[styles.badge, { borderColor: color + "55", backgroundColor: color + "18" }]}><Text style={[styles.badgeText, { color }]}>{label}</Text></View>;
}

export function CapabilityDrawer({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const colors = useColors();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}><Pressable accessibilityRole="button" accessibilityLabel="Close drawer" style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.drawer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.drawerHeader}><Text style={[styles.drawerTitle, { color: colors.foreground }]}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close drawer" onPress={onClose} style={styles.close}><Text style={{ color: colors.muted, fontSize: 20 }}>×</Text></Pressable></View>
        {children}
      </View>
    </View>
  </Modal>;
}

export function CapabilityTransitionCard({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const run = (toValue: number) => Animated.timing(scale, { toValue, duration: 140, useNativeDriver: true }).start();
  return <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={onPress} onPressIn={() => run(0.98)} onPressOut={() => run(1)}><Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View></Pressable>;
}

export function CompletionBurst({ visible, label = "Completed" }: { visible: boolean; label?: string }) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (!visible) return; opacity.setValue(0); Animated.sequence([Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }), Animated.delay(900), Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true })]).start(); }, [opacity, visible]);
  if (!visible) return null;
  return <Animated.View pointerEvents="none" style={[styles.burst, { opacity, backgroundColor: colors.success + "18", borderColor: colors.success + "55" }]}><Text style={[styles.burstText, { color: colors.success }]}>{Platform.OS === "web" ? "✓" : "✦"} {label}</Text></Animated.View>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.34)", justifyContent: "flex-end" },
  drawer: { width: "min(420px, 100%)" as unknown as number, minHeight: 260, maxHeight: "82%" as unknown as number, borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 16 },
  drawerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  drawerTitle: { fontSize: 20, fontWeight: "800" },
  close: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  badge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 12, fontWeight: "800" },
  burst: { position: "absolute", top: 22, right: 16, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  burstText: { fontWeight: "800", fontSize: 13 },
});
