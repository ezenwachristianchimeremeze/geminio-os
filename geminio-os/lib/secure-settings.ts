import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { resolveSettingsStorageState, type SettingsStorageState } from "@/shared/secure-settings-contract";

export type { SettingsStorageState } from "@/shared/secure-settings-contract";

export function getSettingsStorageState(): SettingsStorageState {
  return resolveSettingsStorageState(Platform.OS);
}

export async function setSecureSetting(key: string, value: string): Promise<SettingsStorageState> {
  if (Platform.OS !== "web") {
    try {
      await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      return "secure";
    } catch {
      // Some managed/web-like runtimes do not expose a usable keychain. Preserve data safely in the local fallback.
    }
  }
  await AsyncStorage.setItem(`secure-settings:${key}`, value);
  return "fallback";
}

export async function getSecureSetting(key: string): Promise<string | null> {
  if (Platform.OS !== "web") {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value !== null) return value;
    } catch {
      // Fall through to the explicit local fallback.
    }
  }
  return AsyncStorage.getItem(`secure-settings:${key}`);
}

export async function removeSecureSetting(key: string): Promise<void> {
  if (Platform.OS !== "web") {
    try { await SecureStore.deleteItemAsync(key); } catch { /* fallback cleanup remains best effort */ }
  }
  await AsyncStorage.removeItem(`secure-settings:${key}`);
}
