import { ScrollView, Text, View, Pressable, Switch, Alert } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import * as Haptics from "expo-haptics";

export default function SettingsScreen() {
  const { logout, authMethod } = useAuth();
  const colors = useColors();
  const colorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(colorScheme === "dark");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Logout",
          onPress: async () => {
            await logout();
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
          style: "destructive",
        },
      ]
    );
  };

  const SettingRow = ({ 
    label, 
    description, 
    value, 
    onValueChange,
    isToggle = false 
  }: { 
    label: string
    description?: string
    value?: boolean
    onValueChange?: (value: boolean) => void
    isToggle?: boolean
  }) => (
    <View className="flex-row items-center justify-between py-4 px-4 border-b border-border">
      <View className="flex-1">
        <Text className="text-base font-semibold text-foreground">
          {label}
        </Text>
        {description && (
          <Text className="text-sm text-muted mt-1">
            {description}
          </Text>
        )}
      </View>
      {isToggle && value !== undefined && onValueChange ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={value ? colors.primary : colors.muted}
        />
      ) : (
        <Text className="text-lg text-muted">→</Text>
      )}
    </View>
  );

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="px-6 pt-6 pb-8 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">
              Settings
            </Text>
            <Text className="text-base text-muted">
              Customize your experience
            </Text>
          </View>

          {/* Appearance Section */}
          <View className="gap-3">
            <Text className="text-lg font-bold text-foreground">
              Appearance
            </Text>
            <View className="bg-surface rounded-2xl border border-border overflow-hidden">
              <SettingRow
                label="Dark Mode"
                description={isDarkMode ? "Enabled" : "Disabled"}
                value={isDarkMode}
                onValueChange={setIsDarkMode}
                isToggle={true}
              />
            </View>
          </View>

          {/* Notifications Section */}
          <View className="gap-3">
            <Text className="text-lg font-bold text-foreground">
              Notifications
            </Text>
            <View className="bg-surface rounded-2xl border border-border overflow-hidden">
              <SettingRow
                label="Enable Notifications"
                description={notificationsEnabled ? "Enabled" : "Disabled"}
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                isToggle={true}
              />
            </View>
          </View>

          {/* Account Section */}
          <View className="gap-3">
            <Text className="text-lg font-bold text-foreground">
              Account
            </Text>
            <View className="bg-surface rounded-2xl border border-border overflow-hidden">
              <SettingRow
                label="Authentication Method"
                description={authMethod === "none" ? "Not authenticated" : authMethod}
              />
              <SettingRow
                label="Version"
                description="1.0.0 (Phase 1)"
              />
            </View>
          </View>

          {/* About Section */}
          <View className="gap-3">
            <Text className="text-lg font-bold text-foreground">
              About
            </Text>
            <View className="bg-surface rounded-2xl border border-border p-4 gap-2">
              <Text className="text-sm text-foreground font-semibold">
                Geminio OS
              </Text>
              <Text className="text-sm text-muted">
                Your AI-powered personal assistant. Phase 1 includes AI Chat, Memory System, Voice Input, Authentication, and Dashboard.
              </Text>
              <Text className="text-xs text-muted mt-2">
                © 2026 Geminio. All rights reserved.
              </Text>
            </View>
          </View>

          {/* Logout Button */}
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
            className="bg-error rounded-2xl p-4 items-center"
          >
            <Text className="text-white font-semibold text-lg">
              Logout
            </Text>
          </Pressable>

          {/* Footer */}
          <View className="items-center gap-2 py-4">
            <Text className="text-xs text-muted">
              Geminio OS v1.0.0 - Phase 1
            </Text>
            <Text className="text-xs text-muted">
              Multi-platform: iOS • Android • Web • Desktop
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
