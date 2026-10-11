#!/bin/bash

# Generate all 10 dashboard screens for Geminio OS

DASHBOARDS=(
  "job-hub"
  "video-studio"
  "music-studio"
  "documents"
  "knowledge-vault"
  "finance"
  "automation"
  "device-control"
  "settings"
  "privacy"
)

for dashboard in "${DASHBOARDS[@]}"; do
  echo "Creating dashboard: $dashboard"
  cat > "/home/ubuntu/geminio-os/app/${dashboard}.tsx" << 'EOF'
import { ScrollView, Text, View, Pressable, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";

export default function DashboardScreen() {
  const router = useRouter();
  const colors = useColors();

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-4 py-6 gap-6">
          <Pressable onPress={() => router.back()}>
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
              <Text className="text-sm font-semibold text-primary">Back</Text>
            </View>
          </Pressable>
          <View className="gap-1">
            <Text className="text-3xl font-bold text-foreground">Dashboard</Text>
            <Text className="text-sm text-muted">Feature dashboard</Text>
          </View>
          <View className="bg-surface rounded-xl border border-border p-6 gap-4">
            <MaterialIcons name="dashboard" size={48} color={colors.primary} />
            <Text className="text-lg font-semibold text-foreground">Coming Soon</Text>
            <Text className="text-sm text-muted">This dashboard is currently under development.</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
EOF
  echo "✓ Created $dashboard.tsx"
done

echo "All dashboards created successfully!"
