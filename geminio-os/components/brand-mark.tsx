import { Circle, Defs, LinearGradient, Path, Stop, Svg } from "react-native-svg";
import { StyleSheet, Text, View } from "react-native";

type BrandMarkProps = {
  size?: number;
  showWordmark?: boolean;
  tagline?: boolean;
  tone?: "light" | "dark";
};

export function BrandMark({ size = 72, showWordmark = false, tagline = false, tone = "light" }: BrandMarkProps) {
  const wordColor = tone === "dark" ? "#F8FAFC" : "#0F172A";
  const mutedColor = tone === "dark" ? "#94A3B8" : "#64748B";

  return (
    <View style={styles.lockup} accessible accessibilityRole="image" accessibilityLabel="Geminio OS brand">
      <Svg width={size} height={size} viewBox="0 0 512 512">
        <Defs>
          <LinearGradient id="geminioBrand" x1="104" y1="84" x2="414" y2="428" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#A5B4FC" />
            <Stop offset="0.52" stopColor="#6366F1" />
            <Stop offset="1" stopColor="#38BDF8" />
          </LinearGradient>
          <LinearGradient id="geminioOrbit" x1="84" y1="130" x2="438" y2="382" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#818CF8" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#38BDF8" stopOpacity="0.55" />
          </LinearGradient>
        </Defs>
        <Path d="M385 151C350 112 306 91 255 91C164 91 91 164 91 255C91 346 164 419 255 419C337 419 403 362 416 282H257" stroke="url(#geminioBrand)" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d="M365 112C407 143 435 192 435 248" stroke="url(#geminioOrbit)" strokeWidth="10" strokeLinecap="round" fill="none" />
        <Circle cx="435" cy="248" r="22" fill="#38BDF8" />
        <Circle cx="435" cy="248" r="9" fill="#E0F2FE" />
      </Svg>
      {showWordmark ? (
        <View style={styles.wordmark}>
          <Text style={[styles.name, { color: wordColor }]}>Geminio <Text style={styles.os}>OS</Text></Text>
          {tagline ? <Text style={[styles.tagline, { color: mutedColor }]}>Your intelligence, in motion.</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { alignItems: "center", justifyContent: "center", gap: 12 },
  wordmark: { alignItems: "center", gap: 5 },
  name: { fontSize: 25, fontWeight: "800", letterSpacing: -0.8 },
  os: { color: "#818CF8", fontWeight: "700" },
  tagline: { fontSize: 12, fontWeight: "500", letterSpacing: 0.25 },
});
