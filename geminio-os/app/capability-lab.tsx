import { useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import {
  CapabilityBottomSheet,
  CapabilityFlashList,
  CapabilityMasonry,
  GradientButton,
  GradientSurface,
  GlassSurface,
  ParallaxHeader,
  SkeletonBlock,
} from "@/components/capability-foundations";
import { CapabilityDrawer, CapabilityStateBadge, CapabilityTransitionCard, CompletionBurst } from "@/components/mobile-capability-extensions";
import { useDeviceCapabilities } from "@/hooks/use-device-capabilities";
import { useColors } from "@/hooks/use-colors";

const samples = [
  { id: "virtualized", title: "Virtualized lists", detail: "FlashList-backed rendering for long product histories." },
  { id: "masonry", title: "Masonry surfaces", detail: "Two-column media layouts that remain readable on narrow screens." },
  { id: "offline", title: "Offline-safe actions", detail: "Queued changes stay visible until sync completes." },
  { id: "accessibility", title: "Accessible feedback", detail: "Target sizes, labels, press states, and reduced-motion support." },
];

export default function CapabilityLabScreen() {
  const colors = useColors();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [sheetVisible, setSheetVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [completed, setCompleted] = useState(false);
  const device = useDeviceCapabilities({ motion: true });
  const masonrySamples = useMemo(() => samples.slice(0, 4), []);

  const copyCapabilitySummary = async () => {
    const result = await device.copyText("Geminio OS capability summary: responsive UI, offline-safe actions, and platform-aware device adapters.");
    setCopied(result.state === "available");
  };

  return (
    <ScreenContainer className="px-4" edges={["top", "left", "right"]}>
      <Animated.ScrollView onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })} scrollEventThrottle={16} contentContainerStyle={styles.content}>
        <ParallaxHeader scrollY={scrollY} title="Capability Lab" />
        <Text style={[styles.subtitle, { color: colors.muted }]}>A living test surface for the mobile capability foundation.</Text>

        <GradientSurface style={styles.hero}>
          <Text style={styles.heroEyebrow}>GEMINIO OS</Text>
          <Text style={styles.heroTitle}>Built for every surface.</Text>
          <Text style={styles.heroBody}>Mobile-first interactions, responsive layouts, and provider-safe states share one foundation.</Text>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <GradientButton label="Open bottom sheet" onPress={() => setSheetVisible(true)} />
            <Pressable accessibilityRole="button" onPress={() => setDrawerVisible(true)} style={({ pressed }) => [styles.secondaryButton, { borderColor: "rgba(255,255,255,0.55)" }, pressed && styles.pressed]}><Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Open drawer</Text></Pressable>
          </View>
        </GradientSurface>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Device readiness</Text><CapabilityStateBadge label={device.motionState === "available" ? "Ready" : "Platform-aware"} tone={device.motionState === "available" ? "success" : "warning"} /></View>
        <GlassSurface style={styles.card}>
          <View style={styles.row}><Text style={[styles.label, { color: colors.muted }]}>Battery</Text><Text style={[styles.value, { color: colors.foreground }]}>{device.batteryLevel === null ? "Unavailable" : `${Math.round(device.batteryLevel * 100)}%`}</Text></View>
          <View style={styles.row}><Text style={[styles.label, { color: colors.muted }]}>Low power mode</Text><Text style={[styles.value, { color: colors.foreground }]}>{device.lowPowerMode === null ? "Unavailable" : device.lowPowerMode ? "On" : "Off"}</Text></View>
          <View style={styles.row}><Text style={[styles.label, { color: colors.muted }]}>Motion adapter</Text><Text style={[styles.value, { color: colors.foreground }]}>{device.motionState}</Text></View>
          <View style={styles.row}><Text style={[styles.label, { color: colors.muted }]}>Brightness adapter</Text><Text style={[styles.value, { color: colors.foreground }]}>{device.brightnessState}</Text></View>
              <CapabilityTransitionCard onPress={() => { setCompleted(true); setTimeout(() => setCompleted(false), 1400); }}><Pressable accessibilityRole="button" onPress={copyCapabilitySummary} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
            <Text style={[styles.secondaryButtonText, { color: colors.tint }]}>{copied ? "Copied capability summary" : "Copy capability summary"}</Text>
              </Pressable></CapabilityTransitionCard>
        </GlassSurface>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Loading and long-list behavior</Text>
        <GlassSurface style={styles.card}>
          <SkeletonBlock width="62%" height={18} />
          <SkeletonBlock width="88%" height={12} style={styles.skeletonGap} />
          <CapabilityFlashList data={samples} keyExtractor={(item) => item.id} renderItem={({ item }) => <View style={styles.listRow}><Text style={[styles.listTitle, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.listDetail, { color: colors.muted }]}>{item.detail}</Text></View>} />
        </GlassSurface>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Responsive masonry content</Text>
        <CapabilityMasonry data={masonrySamples} keyExtractor={(item) => item.id} renderItem={(item) => <GlassSurface style={styles.masonryCard}><Text style={[styles.listTitle, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.listDetail, { color: colors.muted }]}>{item.detail}</Text></GlassSurface>} />
      </Animated.ScrollView>
      <CompletionBurst visible={completed} label="Capability verified" />
      <CapabilityDrawer visible={drawerVisible} title="Product navigation" onClose={() => setDrawerVisible(false)}><Text style={[styles.sheetText, { color: colors.muted }]}>Drawer navigation keeps product-level tools reachable without crowding the global tab shell. This boundary is safe on web and native runtimes.</Text><GradientButton label="Close drawer" onPress={() => setDrawerVisible(false)} /></CapabilityDrawer>
      <CapabilityBottomSheet visible={sheetVisible} title="Capability details" onClose={() => setSheetVisible(false)}>
        <Text style={[styles.sheetText, { color: colors.muted }]}>This surface is intentionally standalone so device permissions, offline states, and platform fallbacks can be tested without hiding functionality inside a popup flow.</Text>
        <GradientButton label="Done" onPress={() => setSheetVisible(false)} />
      </CapabilityBottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 44 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  hero: { borderRadius: 26, padding: 22, gap: 12 },
  heroEyebrow: { color: "rgba(255,255,255,0.76)", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  heroTitle: { color: "#FFFFFF", fontSize: 28, lineHeight: 34, fontWeight: "800" },
  heroBody: { color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 21, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: 4 },
  card: { gap: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 28 },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: "700" },
  secondaryButton: { minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  secondaryButtonText: { fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  skeletonGap: { marginTop: 2 },
  listRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(148,163,184,0.24)" },
  listTitle: { fontSize: 15, fontWeight: "700" },
  listDetail: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  masonryCard: { minHeight: 120, marginBottom: 0 },
  sheetText: { fontSize: 15, lineHeight: 22, marginBottom: 18 },
});
