import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ColorValue,
  type ListRenderItemInfo,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useColors } from "@/hooks/use-colors";

const SCREEN_HEIGHT = Dimensions.get("window").height;

export function SkeletonBlock({
  width = "100%",
  height = 18,
  radius = 10,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.border }, { opacity }, style]} />;
}

export function GlassSurface({
  children,
  intensity = 55,
  style,
  tint = "light",
}: {
  children: React.ReactNode;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  tint?: "light" | "dark" | "default";
}) {
  const colors = useColors();
  return (
    <View style={[styles.glassClip, { borderColor: colors.border }, style]}>
      <BlurView
        intensity={intensity}
        tint={tint}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.glassContent, { backgroundColor: `${colors.surface}CC` }]}>{children}</View>
    </View>
  );
}

export function GradientSurface({
  children,
  colors,
  style,
}: {
  children: React.ReactNode;
  colors?: readonly [ColorValue, ColorValue, ...ColorValue[]];
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useColors();
  const gradientColors = colors ?? [theme.tint, theme.primary, theme.surface];
  return (
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      {children}
    </LinearGradient>
  );
}

export function GradientButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.buttonPressable, pressed && styles.buttonPressed, disabled && styles.buttonDisabled]}
    >
      <LinearGradient colors={[colors.tint, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientButton}>
        <Text style={styles.gradientButtonText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function CapabilityBottomSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    } else {
      Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [translateY, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 8,
        onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 120) onClose();
          else Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }).start();
        },
      }),
    [onClose, translateY],
  );

  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable accessibilityLabel="Close sheet" style={styles.sheetDismiss} onPress={onClose} />
        <Animated.View {...panResponder.panHandlers} style={[styles.sheet, { backgroundColor: colors.surface, transform: [{ translateY }] }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{title}</Text>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

export function CapabilityFlashList<T>({
  data,
  renderItem,
  keyExtractor,
}: {
  data: T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
}) {
  return <FlashList data={data} renderItem={renderItem} keyExtractor={keyExtractor} />;
}

export function CapabilityMasonry<T>({
  data,
  renderItem,
  keyExtractor,
}: {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
}) {
  const columns = useMemo(() => [data.filter((_, index) => index % 2 === 0), data.filter((_, index) => index % 2 === 1)], [data]);
  return (
    <View style={styles.masonry}>
      {columns.map((column, columnIndex) => (
        <View key={`column-${columnIndex}`} style={styles.masonryColumn}>
          {column.map((item, index) => <View key={keyExtractor(item, index)}>{renderItem(item, index)}</View>)}
        </View>
      ))}
    </View>
  );
}

export function ParallaxHeader({
  scrollY,
  title,
  height = 180,
}: {
  scrollY: Animated.Value;
  title: string;
  height?: number;
}) {
  const colors = useColors();
  const translateY = scrollY.interpolate({ inputRange: [-height, 0, height], outputRange: [height / 2, 0, -height * 0.25], extrapolate: "clamp" });
  const scale = scrollY.interpolate({ inputRange: [-height, 0], outputRange: [1.25, 1], extrapolate: "clamp" });
  return (
    <Animated.View style={[styles.parallaxHeader, { height, backgroundColor: colors.tint, transform: [{ translateY }, { scale }] }]}>
      <Text style={styles.parallaxTitle}>{title}</Text>
    </Animated.View>
  );
}

export function CapabilityLottie({
  source,
  autoPlay = true,
  loop = true,
  reducedMotion = false,
}: {
  source: string | number | object;
  autoPlay?: boolean;
  loop?: boolean;
  reducedMotion?: boolean;
}) {
  if (reducedMotion) return null;
  return <LottieView source={source as never} autoPlay={autoPlay} loop={loop} style={styles.lottie} />;
}

const styles = StyleSheet.create({
  glassClip: { borderRadius: 22, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  glassContent: { padding: 16 },
  buttonPressable: { borderRadius: 14, overflow: "hidden" },
  buttonPressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  buttonDisabled: { opacity: 0.5 },
  gradientButton: { minHeight: 46, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  gradientButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.36)" },
  sheetDismiss: { ...StyleSheet.absoluteFillObject },
  sheet: { minHeight: 220, maxHeight: "82%", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  sheetHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 999, marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: "800", marginBottom: 16 },
  masonry: { flexDirection: "row", gap: 12 },
  masonryColumn: { flex: 1, gap: 12 },
  parallaxHeader: { alignItems: "center", justifyContent: "center", borderRadius: 24, overflow: "hidden" },
  parallaxTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "800" },
  lottie: { width: 120, height: 120, alignSelf: "center" },
});
