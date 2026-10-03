import { Tabs } from "expo-router";
import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { AppIcon } from "@/components/ui/app-icon";
import { useColors } from "@/hooks/use-colors";

const TAB_ITEMS = {
  index: { title: "Home", icon: "chat-bubble-outline" as const, activeIcon: "chat" as const },
  workspace: { title: "Workspace", icon: "apps" as const, activeIcon: "apps" as const },
  discover: { title: "Discover", icon: "explore-off" as const, activeIcon: "explore" as const },
  notifications: { title: "Notifications", icon: "notifications-none" as const, activeIcon: "notifications" as const },
  profile: { title: "Profile", icon: "person-outline" as const, activeIcon: "person" as const },
};

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktopRail = Platform.OS === "web" && width >= 1024;
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 58 + bottomPadding;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarButton: HapticTab,
        tabBarPosition: isDesktopRail ? "left" : "bottom",
        tabBarLabelPosition: isDesktopRail ? "beside-icon" : "below-icon",
        tabBarLabelStyle: isDesktopRail
          ? { fontSize: 12, fontWeight: "700", marginTop: 0, letterSpacing: -0.15 }
          : { fontSize: 10, fontWeight: "700", marginTop: -2, letterSpacing: -0.15 },
        tabBarItemStyle: isDesktopRail
          ? { minWidth: 0, minHeight: 54, alignItems: "flex-start", paddingHorizontal: 18 }
          : { minWidth: 0 },
        tabBarStyle: isDesktopRail
          ? {
              width: 220,
              paddingTop: 28,
              paddingBottom: 28,
              backgroundColor: colors.background,
              borderRightColor: colors.border,
              borderRightWidth: 0.5,
            }
          : {
              paddingTop: 7,
              paddingBottom: bottomPadding,
              height: tabBarHeight,
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              borderTopWidth: 0.5,
            },
        tabBarIcon: ({ color, focused }) => {
          const item = TAB_ITEMS[route.name as keyof typeof TAB_ITEMS];
          const iconName = focused ? item?.activeIcon : item?.icon;
          return iconName ? <AppIcon name={iconName} size={24} color={color} /> : null;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: TAB_ITEMS.index.title }} />
      <Tabs.Screen name="workspace" options={{ title: TAB_ITEMS.workspace.title }} />
      <Tabs.Screen name="discover" options={{ title: TAB_ITEMS.discover.title }} />
      <Tabs.Screen name="notifications" options={{ title: TAB_ITEMS.notifications.title, tabBarBadge: undefined }} />
      <Tabs.Screen name="profile" options={{ title: TAB_ITEMS.profile.title }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="tools" options={{ href: null }} />
      <Tabs.Screen name="studio" options={{ href: null }} />
    </Tabs>
  );
}
