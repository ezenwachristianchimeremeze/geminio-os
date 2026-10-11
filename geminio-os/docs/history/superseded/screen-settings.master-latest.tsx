import { ScrollView, Text, View, Pressable, Switch, TextInput, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface UserSettings {
  notifications: boolean;
  darkMode: boolean;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  language: string;
  theme: string;
  privacyMode: boolean;
  offlineMode: boolean;
}

/**
 * Settings Screen - User preferences and application settings
 * 
 * Features:
 * - Notification preferences
 * - Theme selection
 * - Language settings
 * - Privacy settings
 * - Offline mode
 * - Account management
 */
export default function SettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    notifications: true,
    darkMode: true,
    soundEnabled: true,
    hapticEnabled: true,
    language: "en",
    theme: "auto",
    privacyMode: false,
    offlineMode: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await trpc.settings.get.useQuery();
      // setSettings(response);
      
      // For now, use default settings
      setSettings({
        notifications: true,
        darkMode: true,
        soundEnabled: true,
        hapticEnabled: true,
        language: "en",
        theme: "auto",
        privacyMode: false,
        offlineMode: false,
      });
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingChange = async (key: keyof UserSettings, value: any) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);

    try {
      // TODO: Replace with actual API call
      // await trpc.settings.update.useMutation({ settings: updatedSettings });
    } catch (error) {
      console.error("Failed to update settings:", error);
      alert("Failed to save settings");
    }
  };

  const handleLogout = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    try {
      // TODO: Replace with actual logout API call
      // await trpc.auth.logout.useMutation();
      router.push("/");
    } catch (error) {
      console.error("Failed to logout:", error);
      alert("Failed to logout");
    }
  };

  const SettingRow = ({
    icon,
    label,
    description,
    value,
    onChange,
    type = "toggle",
  }: {
    icon: string;
    label: string;
    description: string;
    value: any;
    onChange: (value: any) => void;
    type?: "toggle" | "select";
  }) => (
    <View className="bg-surface rounded-lg border border-border p-4 mb-3 flex-row items-center justify-between">
      <View className="flex-row items-center gap-3 flex-1">
        <View
          className="w-10 h-10 rounded-lg items-center justify-center"
          style={{ backgroundColor: colors.primary + "20" }}
        >
          <MaterialIcons name={icon as any} size={20} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground">{label}</Text>
          <Text className="text-xs text-muted mt-1">{description}</Text>
        </View>
      </View>

      {type === "toggle" && (
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={value ? colors.primary : colors.muted}
        />
      )}
    </View>
  );

  if (isLoading) {
    return (
      <ScreenContainer className="bg-background items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-4 py-6 gap-6">
          {/* Header */}
          <Pressable onPress={() => router.back()}>
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
              <Text className="text-sm font-semibold text-primary">Back</Text>
            </View>
          </Pressable>

          <View className="gap-1">
            <Text className="text-3xl font-bold text-foreground">Settings</Text>
            <Text className="text-sm text-muted">Manage your preferences</Text>
          </View>

          {/* Notifications Section */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-muted uppercase tracking-wide">
              Notifications
            </Text>
            <SettingRow
              icon="notifications"
              label="Push Notifications"
              description="Receive push notifications"
              value={settings.notifications}
              onChange={(value) => handleSettingChange("notifications", value)}
            />
            <SettingRow
              icon="volume-up"
              label="Sound"
              description="Play notification sounds"
              value={settings.soundEnabled}
              onChange={(value) => handleSettingChange("soundEnabled", value)}
            />
            <SettingRow
              icon="vibration"
              label="Haptic Feedback"
              description="Vibration feedback on interactions"
              value={settings.hapticEnabled}
              onChange={(value) => handleSettingChange("hapticEnabled", value)}
            />
          </View>

          {/* Display Section */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-muted uppercase tracking-wide">
              Display
            </Text>
            <SettingRow
              icon="dark-mode"
              label="Dark Mode"
              description="Use dark theme"
              value={settings.darkMode}
              onChange={(value) => handleSettingChange("darkMode", value)}
            />
          </View>

          {/* Language Section */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-muted uppercase tracking-wide">
              Language & Region
            </Text>
            <View className="bg-surface rounded-lg border border-border p-4 mb-3">
              <View className="flex-row items-center gap-3 mb-2">
                <View
                  className="w-10 h-10 rounded-lg items-center justify-center"
                  style={{ backgroundColor: colors.primary + "20" }}
                >
                  <MaterialIcons name="language" size={20} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">Language</Text>
                  <Text className="text-xs text-muted mt-1">Select your language</Text>
                </View>
              </View>
              <View className="flex-row gap-2 flex-wrap mt-3">
                {["en", "es", "fr", "de", "zh"].map((lang) => (
                  <Pressable
                    key={lang}
                    onPress={() => handleSettingChange("language", lang)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View
                      className={`rounded px-3 py-2 border ${
                        settings.language === lang
                          ? "bg-primary border-primary"
                          : "bg-background border-border"
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          settings.language === lang ? "text-background" : "text-foreground"
                        }`}
                      >
                        {lang.toUpperCase()}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Privacy & Security Section */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-muted uppercase tracking-wide">
              Privacy & Security
            </Text>
            <SettingRow
              icon="privacy-tip"
              label="Privacy Mode"
              description="Hide sensitive information"
              value={settings.privacyMode}
              onChange={(value) => handleSettingChange("privacyMode", value)}
            />
            <SettingRow
              icon="cloud-off"
              label="Offline Mode"
              description="Work without internet connection"
              value={settings.offlineMode}
              onChange={(value) => handleSettingChange("offlineMode", value)}
            />
          </View>

          {/* Account Section */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-muted uppercase tracking-wide">
              Account
            </Text>
            <Pressable
              onPress={() => {
                // TODO: Navigate to account details screen
                alert("Account details screen not yet implemented");
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View className="bg-surface rounded-lg border border-border p-4 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  <View
                    className="w-10 h-10 rounded-lg items-center justify-center"
                    style={{ backgroundColor: colors.primary + "20" }}
                  >
                    <MaterialIcons name="person" size={20} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">Account Details</Text>
                    <Text className="text-xs text-muted mt-1">View and edit your profile</Text>
                  </View>
                </View>
                <MaterialIcons name="arrow-forward" size={20} color={colors.muted} />
              </View>
            </Pressable>

            <Pressable
              onPress={() => {
                // TODO: Navigate to change password screen
                alert("Change password screen not yet implemented");
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View className="bg-surface rounded-lg border border-border p-4 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  <View
                    className="w-10 h-10 rounded-lg items-center justify-center"
                    style={{ backgroundColor: colors.primary + "20" }}
                  >
                    <MaterialIcons name="lock" size={20} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">Change Password</Text>
                    <Text className="text-xs text-muted mt-1">Update your password</Text>
                  </View>
                </View>
                <MaterialIcons name="arrow-forward" size={20} color={colors.muted} />
              </View>
            </Pressable>
          </View>

          {/* Logout Section */}
          <View className="gap-3">
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View className="bg-error/10 rounded-lg border border-error/20 px-4 py-3 flex-row items-center justify-center gap-2">
                <MaterialIcons name="logout" size={20} color={colors.error} />
                <Text className="text-base font-semibold text-error">Logout</Text>
              </View>
            </Pressable>
          </View>

          {/* Spacing */}
          <View className="h-4" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
