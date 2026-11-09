import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandMark } from "@/components/brand-mark";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#080D1B" />
      <LinearGradient colors={["#101A36", "#080D1B", "#080D1B"]} locations={[0, 0.52, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} bounces={false}>
          <View style={styles.topline}>
            <View style={styles.brandMini}>
              <BrandMark size={25} />
              <Text style={styles.brandMiniText}>GEMINIO OS</Text>
            </View>
            <View style={styles.versionPill}>
              <View style={styles.statusDot} />
              <Text style={styles.versionText}>AI WORKSPACE</Text>
            </View>
          </View>

          <View style={styles.hero}>
            <View style={styles.logoHalo}>
              <View style={styles.logoInner}><BrandMark size={116} /></View>
            </View>
            <Text style={styles.eyebrow}>A NEW WAY TO WORK</Text>
            <Text style={styles.title}>Your intelligence,{"\n"}<Text style={styles.titleAccent}>in motion.</Text></Text>
            <Text style={styles.description}>
              Bring your ideas, projects and everyday work into one intelligent workspace. Think clearly, create confidently and move from intention to action.
            </Text>
          </View>

          <View style={styles.featureList}>
            <Feature title="One connected workspace" detail="Move between your tools without losing context." />
            <Feature title="AI that helps you build" detail="Plan, create and improve with guided assistance." />
            <Feature title="You stay in control" detail="Review important actions and manage your privacy." />
          </View>

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Create your Geminio OS account" onPress={() => router.push({ pathname: "/auth/[flow]", params: { flow: "sign-up" } })} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>Get started</Text>
              <Text style={styles.arrow}>→</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/auth/[flow]", params: { flow: "sign-in" } })} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>I already have an account</Text>
            </Pressable>
            <Text style={styles.legal}>Review your account and privacy choices before using connected features.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Feature({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}><View style={styles.featureCheck} /></View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDetail}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080D1B" },
  safe: { flex: 1 },
  content: { flexGrow: 1, width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandMini: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandMiniText: { color: "#E2E8F0", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  versionPill: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "rgba(148,163,184,0.2)", borderRadius: 30, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: "rgba(15,23,42,0.5)" },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#34D399" },
  versionText: { color: "#94A3B8", fontSize: 9, fontWeight: "800", letterSpacing: 1.1 },
  hero: { alignItems: "center", paddingTop: 40 },
  logoHalo: { width: 176, height: 176, borderRadius: 88, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(129,140,248,0.25)", backgroundColor: "rgba(79,70,229,0.07)", marginBottom: 28 },
  logoInner: { width: 146, height: 146, borderRadius: 73, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.76)", borderWidth: 1, borderColor: "rgba(148,163,184,0.12)" },
  eyebrow: { color: "#A5B4FC", fontSize: 10, fontWeight: "800", letterSpacing: 2.3, marginBottom: 13 },
  title: { color: "#F8FAFC", fontSize: 38, lineHeight: 43, fontWeight: "800", letterSpacing: -1.6, textAlign: "center" },
  titleAccent: { color: "#A5B4FC" },
  description: { color: "#94A3B8", fontSize: 14, lineHeight: 22, textAlign: "center", maxWidth: 390, marginTop: 16 },
  featureList: { gap: 17, marginTop: 32, paddingHorizontal: 4 },
  feature: { flexDirection: "row", alignItems: "center", gap: 13 },
  featureIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(99,102,241,0.16)", borderWidth: 1, borderColor: "rgba(129,140,248,0.24)" },
  featureCheck: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#A5B4FC" },
  featureCopy: { flex: 1, gap: 3 },
  featureTitle: { color: "#E2E8F0", fontSize: 13, fontWeight: "700" },
  featureDetail: { color: "#64748B", fontSize: 11, lineHeight: 16 },
  actions: { gap: 12, marginTop: 34 },
  primaryButton: { minHeight: 56, borderRadius: 17, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#4F46E5", borderWidth: 1, borderColor: "#818CF8" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  arrow: { color: "#FFFFFF", fontSize: 20, marginTop: -2 },
  secondaryButton: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: "rgba(148,163,184,0.28)", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.48)" },
  secondaryButtonText: { color: "#CBD5E1", fontSize: 13, fontWeight: "700" },
  legal: { color: "#475569", fontSize: 10, lineHeight: 15, textAlign: "center", paddingHorizontal: 12, marginTop: 3 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
