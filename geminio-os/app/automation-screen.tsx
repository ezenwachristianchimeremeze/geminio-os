import { ScrollView, Text, View, Pressable, Switch } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

interface Automation {
  id: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
  type: 'workflow' | 'routine' | 'trigger';
}

export default function AutomationScreen() {
  const colors = useColors();
  const [automations, setAutomations] = useState<Automation[]>([
    {
      id: '1',
      title: 'Morning Routine',
      description: 'Daily briefing, weather, and task summary',
      icon: '🌅',
      enabled: true,
      type: 'routine',
    },
    {
      id: '2',
      title: 'Email Digest',
      description: 'Summarize emails every evening',
      icon: '📧',
      enabled: true,
      type: 'workflow',
    },
    {
      id: '3',
      title: 'Focus Mode',
      description: 'Silence notifications during focus hours',
      icon: '🎯',
      enabled: false,
      type: 'trigger',
    },
    {
      id: '4',
      title: 'Weekly Report',
      description: 'Generate productivity report every Friday',
      icon: '📊',
      enabled: true,
      type: 'routine',
    },
  ]);

  const handleToggleAutomation = (id: string) => {
    setAutomations((prev) =>
      prev.map((auto) =>
        auto.id === id ? { ...auto, enabled: !auto.enabled } : auto
      )
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const AutomationCard = ({ automation }: { automation: Automation }) => (
    <View className="bg-surface rounded-2xl p-4 mb-3 border border-border flex-row items-center justify-between">
      <View className="flex-row items-center gap-3 flex-1">
        <Text className="text-3xl">{automation.icon}</Text>
        <View className="flex-1">
          <Text className="font-semibold text-foreground">
            {automation.title}
          </Text>
          <Text className="text-xs text-muted mt-1">
            {automation.description}
          </Text>
        </View>
      </View>
      <Switch
        value={automation.enabled}
        onValueChange={() => handleToggleAutomation(automation.id)}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={automation.enabled ? colors.primary : colors.muted}
      />
    </View>
  );

  const enabledCount = automations.filter((a) => a.enabled).length;

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="px-6 pt-6 pb-8 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">
              Automation Center
            </Text>
            <Text className="text-base text-muted">
              {enabledCount} automations active
            </Text>
          </View>

          {/* Stats */}
          <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20 flex-row items-center justify-between">
            <View>
              <Text className="text-sm text-muted mb-1">
                Time Saved This Week
              </Text>
              <Text className="text-3xl font-bold text-primary">
                4.5 hrs
              </Text>
            </View>
            <Text className="text-4xl">⚡</Text>
          </View>

          {/* Automations List */}
          <View className="gap-3">
            <Text className="text-lg font-bold text-foreground">
              Active Automations
            </Text>
            {automations.map((automation) => (
              <AutomationCard key={automation.id} automation={automation} />
            ))}
          </View>

          {/* Create New Automation */}
          <Pressable
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
            className="bg-primary rounded-2xl p-4 items-center mt-4"
          >
            <Text className="text-white font-semibold">
              + Create New Automation
            </Text>
          </Pressable>

          {/* Workflow Templates */}
          <View className="gap-3">
            <Text className="text-lg font-bold text-foreground">
              Workflow Templates
            </Text>
            <Pressable
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="bg-surface rounded-2xl p-4 border border-border"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  <Text className="text-2xl">📱</Text>
                  <View>
                    <Text className="font-semibold text-foreground">
                      Social Media Posting
                    </Text>
                    <Text className="text-xs text-muted mt-1">
                      Auto-post to multiple platforms
                    </Text>
                  </View>
                </View>
                <Text className="text-lg">→</Text>
              </View>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="bg-surface rounded-2xl p-4 border border-border"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  <Text className="text-2xl">📝</Text>
                  <View>
                    <Text className="font-semibold text-foreground">
                      Content Pipeline
                    </Text>
                    <Text className="text-xs text-muted mt-1">
                      Generate and schedule content
                    </Text>
                  </View>
                </View>
                <Text className="text-lg">→</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
