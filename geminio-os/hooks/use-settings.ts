import { useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface AppSettings {
  theme: "light" | "dark" | "auto";
  language: string;
  notifications: {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
    taskReminders: boolean;
    goalUpdates: boolean;
    messages: boolean;
  };
  privacy: {
    analyticsEnabled: boolean;
    crashReportsEnabled: boolean;
    dataCollectionEnabled: boolean;
  };
  performance: {
    enableOfflineMode: boolean;
    autoSync: boolean;
    cacheSize: number;
  };
  accessibility: {
    fontSize: "small" | "medium" | "large";
    highContrast: boolean;
    reduceMotion: boolean;
    screenReaderEnabled: boolean;
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "auto",
  language: "en",
  notifications: {
    enabled: true,
    sound: true,
    vibration: true,
    taskReminders: true,
    goalUpdates: true,
    messages: true,
  },
  privacy: {
    analyticsEnabled: true,
    crashReportsEnabled: true,
    dataCollectionEnabled: false,
  },
  performance: {
    enableOfflineMode: true,
    autoSync: true,
    cacheSize: 100,
  },
  accessibility: {
    fontSize: "medium",
    highContrast: false,
    reduceMotion: false,
    screenReaderEnabled: false,
  },
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem("app_settings");
        if (stored) {
          setSettings(JSON.parse(stored));
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Save settings to storage
  const saveSettings = useCallback(
    async (newSettings: Partial<AppSettings>) => {
      try {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
        await AsyncStorage.setItem("app_settings", JSON.stringify(updated));
        return { success: true };
      } catch (error) {
        console.error("Error saving settings:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Save failed",
        };
      }
    },
    [settings]
  );

  // Update theme
  const setTheme = useCallback(
    (theme: "light" | "dark" | "auto") => {
      return saveSettings({ theme });
    },
    [saveSettings]
  );

  // Update language
  const setLanguage = useCallback(
    (language: string) => {
      return saveSettings({ language });
    },
    [saveSettings]
  );

  // Update notification settings
  const updateNotifications = useCallback(
    (notifications: Partial<AppSettings["notifications"]>) => {
      return saveSettings({
        notifications: { ...settings.notifications, ...notifications },
      });
    },
    [settings, saveSettings]
  );

  // Update privacy settings
  const updatePrivacy = useCallback(
    (privacy: Partial<AppSettings["privacy"]>) => {
      return saveSettings({
        privacy: { ...settings.privacy, ...privacy },
      });
    },
    [settings, saveSettings]
  );

  // Update performance settings
  const updatePerformance = useCallback(
    (performance: Partial<AppSettings["performance"]>) => {
      return saveSettings({
        performance: { ...settings.performance, ...performance },
      });
    },
    [settings, saveSettings]
  );

  // Update accessibility settings
  const updateAccessibility = useCallback(
    (accessibility: Partial<AppSettings["accessibility"]>) => {
      return saveSettings({
        accessibility: { ...settings.accessibility, ...accessibility },
      });
    },
    [settings, saveSettings]
  );

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    try {
      setSettings(DEFAULT_SETTINGS);
      await AsyncStorage.setItem("app_settings", JSON.stringify(DEFAULT_SETTINGS));
      return { success: true };
    } catch (error) {
      console.error("Error resetting settings:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Reset failed",
      };
    }
  }, []);

  // Export settings
  const exportSettings = useCallback(() => {
    return JSON.stringify(settings, null, 2);
  }, [settings]);

  // Import settings
  const importSettings = useCallback(
    async (settingsJson: string) => {
      try {
        const imported = JSON.parse(settingsJson) as AppSettings;
        await saveSettings(imported);
        return { success: true };
      } catch (error) {
        console.error("Error importing settings:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Import failed",
        };
      }
    },
    [saveSettings]
  );

  return {
    settings,
    isLoading,
    saveSettings,
    setTheme,
    setLanguage,
    updateNotifications,
    updatePrivacy,
    updatePerformance,
    updateAccessibility,
    resetToDefaults,
    exportSettings,
    importSettings,
  };
}
