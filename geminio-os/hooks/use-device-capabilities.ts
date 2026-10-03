import * as Battery from "expo-battery";
import * as Brightness from "expo-brightness";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { Accelerometer, Gyroscope } from "expo-sensors";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

export type DeviceCapabilityState = "available" | "unsupported" | "denied" | "error";

export interface MotionSnapshot {
  accelerometer: { x: number; y: number; z: number };
  gyroscope: { x: number; y: number; z: number };
}

export interface DeviceCapabilitySnapshot {
  batteryLevel: number | null;
  batteryState: Battery.BatteryState | null;
  lowPowerMode: boolean | null;
  brightness: number | null;
  motion: MotionSnapshot;
  batteryStatus: DeviceCapabilityState;
  brightnessState: DeviceCapabilityState;
  motionState: DeviceCapabilityState;
}

const initialMotion: MotionSnapshot = {
  accelerometer: { x: 0, y: 0, z: 0 },
  gyroscope: { x: 0, y: 0, z: 0 },
};

export function useDeviceCapabilities({ motion = false }: { motion?: boolean } = {}) {
  const [snapshot, setSnapshot] = useState<DeviceCapabilitySnapshot>({
    batteryLevel: null,
    batteryState: null,
    lowPowerMode: null,
    brightness: null,
    motion: initialMotion,
    batteryStatus: Platform.OS === "web" ? "unsupported" : "available",
    brightnessState: Platform.OS === "web" ? "unsupported" : "available",
    motionState: Platform.OS === "web" ? "unsupported" : "available",
  });

  useEffect(() => {
    let mounted = true;
    if (Platform.OS === "web") return () => { mounted = false; };
    (async () => {
      try {
        const available = await Battery.isAvailableAsync();
        if (!mounted) return;
        if (!available) {
          setSnapshot((current) => ({ ...current, batteryStatus: "unsupported" }));
          return;
        }
        const [level, state, power] = await Promise.all([
          Battery.getBatteryLevelAsync(),
          Battery.getBatteryStateAsync(),
          Battery.getPowerStateAsync(),
        ]);
        if (mounted) setSnapshot((current) => ({ ...current, batteryLevel: level >= 0 ? level : null, batteryState: state, lowPowerMode: power.lowPowerMode ?? false }));
      } catch {
        if (mounted) setSnapshot((current) => ({ ...current, batteryStatus: "error" }));
      }
    })();
    const levelSubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      if (mounted) setSnapshot((current) => ({ ...current, batteryLevel: batteryLevel >= 0 ? batteryLevel : null }));
    });
    const stateSubscription = Battery.addBatteryStateListener(({ batteryState }) => {
      if (mounted) setSnapshot((current) => ({ ...current, batteryState }));
    });
    return () => {
      mounted = false;
      levelSubscription.remove();
      stateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!motion || Platform.OS === "web") return;
    let mounted = true;
    try {
      Accelerometer.setUpdateInterval(250);
      Gyroscope.setUpdateInterval(250);
      const accelerometerSubscription = Accelerometer.addListener((value) => {
        if (mounted) setSnapshot((current) => ({ ...current, motion: { ...current.motion, accelerometer: value } }));
      });
      const gyroscopeSubscription = Gyroscope.addListener((value) => {
        if (mounted) setSnapshot((current) => ({ ...current, motion: { ...current.motion, gyroscope: value } }));
      });
      return () => {
        mounted = false;
        accelerometerSubscription.remove();
        gyroscopeSubscription.remove();
      };
    } catch {
      setSnapshot((current) => ({ ...current, motionState: "error" }));
      return undefined;
    }
  }, [motion]);

  const readBrightness = useCallback(async () => {
    if (Platform.OS === "web") return { state: "unsupported" as const, value: null };
    try {
      const value = await Brightness.getBrightnessAsync();
      setSnapshot((current) => ({ ...current, brightness: value, brightnessState: "available" }));
      return { state: "available" as const, value };
    } catch {
      setSnapshot((current) => ({ ...current, brightnessState: "error" }));
      return { state: "error" as const, value: null };
    }
  }, []);

  const setBrightness = useCallback(async (value: number) => {
    if (Platform.OS === "web") return { state: "unsupported" as const };
    try {
      const clamped = Math.min(1, Math.max(0, value));
      await Brightness.setBrightnessAsync(clamped);
      setSnapshot((current) => ({ ...current, brightness: clamped, brightnessState: "available" }));
      return { state: "available" as const };
    } catch {
      setSnapshot((current) => ({ ...current, brightnessState: "error" }));
      return { state: "error" as const };
    }
  }, []);

  const copyText = useCallback(async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      return { state: "available" as const };
    } catch {
      return { state: "error" as const };
    }
  }, []);

  const shareFile = useCallback(async (uri: string, mimeType?: string) => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) return { state: "unsupported" as const };
      await Sharing.shareAsync(uri, mimeType ? { mimeType } : undefined);
      return { state: "available" as const };
    } catch {
      return { state: "error" as const };
    }
  }, []);

  return { ...snapshot, readBrightness, setBrightness, copyText, shareFile };
}
