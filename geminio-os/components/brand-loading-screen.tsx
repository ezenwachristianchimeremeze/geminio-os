import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { BrandMark } from "@/components/brand-mark";

export function BrandLoadingScreen() {
  const pulse = useRef(new Animated.Value(0.96)).current;
  const orbit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.035, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.96, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const orbitLoop = Animated.loop(Animated.timing(orbit, {
      toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true,
    }));
    pulseLoop.start();
    orbitLoop.start();
    return () => {
      pulseLoop.stop();
      orbitLoop.stop();
      pulse.stopAnimation();
      orbit.stopAnimation();
    };
  }, [orbit, pulse]);

  const rotate = orbit.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={styles.screen} accessibilityRole="progressbar" accessibilityLabel="Loading Geminio OS">
      <View style={styles.center}>
        <View style={styles.markStage}>
          <Animated.View style={[styles.orbitRing, { transform: [{ rotate }] }]} />
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <BrandMark size={104} />
          </Animated.View>
        </View>
        <Text style={styles.title}>Geminio <Text style={styles.os}>OS</Text></Text>
        <Text style={styles.subtitle}>Preparing your workspace</Text>
        <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
        <Text style={styles.status}>SECURE · INTELLIGENT · CONNECTED</Text>
      </View>
      <Text style={styles.footer}>A more capable way to work.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#080D1B", alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  center: { alignItems: "center", width: "100%", maxWidth: 360 },
  markStage: { width: 168, height: 168, alignItems: "center", justifyContent: "center", marginBottom: 28 },
  orbitRing: { position: "absolute", width: 154, height: 154, borderRadius: 77, borderWidth: 1, borderColor: "rgba(129,140,248,0.28)", borderTopColor: "#60A5FA", borderRightColor: "rgba(56,189,248,0.55)" },
  title: { color: "#F8FAFC", fontSize: 29, fontWeight: "800", letterSpacing: -1.1 },
  os: { color: "#A5B4FC", fontWeight: "700" },
  subtitle: { color: "#94A3B8", fontSize: 13, marginTop: 9, letterSpacing: 0.2 },
  progressTrack: { height: 3, width: 132, borderRadius: 2, backgroundColor: "#1E293B", overflow: "hidden", marginTop: 30 },
  progressFill: { height: "100%", width: "42%", borderRadius: 2, backgroundColor: "#818CF8" },
  status: { color: "#64748B", fontSize: 9, letterSpacing: 1.6, fontWeight: "700", marginTop: 16 },
  footer: { position: "absolute", bottom: 34, color: "#475569", fontSize: 11, letterSpacing: 0.25 },
});
