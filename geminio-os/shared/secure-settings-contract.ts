export type SettingsStorageState = "secure" | "fallback";

export function resolveSettingsStorageState(platform: string): SettingsStorageState {
  return platform === "web" ? "fallback" : "secure";
}
