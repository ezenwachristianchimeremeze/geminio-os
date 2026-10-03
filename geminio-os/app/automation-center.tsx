import { ScrollView, Text, View, Pressable, TextInput, Modal, Switch, FlatList } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useMemory } from "@/lib/memory-context";
import * as Haptics from "expo-haptics";

interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
  createdAt: Date;
}

const AUTOMATION_TEMPLATES = [
  {
    name: "Daily Briefing",
    description: "Get AI-generated daily briefing at 8 AM",
    trigger: "Every day at 8:00 AM",
    action: "Generate and send daily briefing",
  },
  {
    name: "Task Reminder",
    description: "Remind me of pending tasks",
    trigger: "Every 2 hours",
    action: "Send task reminders",
  },
  {
    name: "Weekly Report",
    description: "Generate weekly productivity report",
    trigger: "Every Monday at 9:00 AM",
    action: "Generate and save weekly report",
  },
  {
    name: "Goal Check-in",
    description: "Check progress on goals",
    trigger: "Every Friday at 5:00 PM",
    action: "Review goal progress",
  },
];

export default function AutomationCenterScreen() {
  const colors = useColors();
  const { addMemory } = useMemory();
  const [automations, setAutomations] = useState<Automation[]>([
    {
      id: "1",
      name: "Daily Briefing",
      description: "Get AI-generated daily briefing at 8 AM",
      trigger: "Every day at 8:00 AM",
      action: "Generate and send daily briefing",
      enabled: true,
      createdAt: new Date(),
    },
    {
      id: "2",
      name: "Task Reminder",
      description: "Remind me of pending tasks",
      trigger: "Every 2 hours",
      action: "Send task reminders",
      enabled: true,
      createdAt: new Date(),
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [newAutomation, setNewAutomation] = useState({
    name: "",
    description: "",
    trigger: "Every day",
    action: "",
  });

  const addAutomation = async () => {
    if (!newAutomation.name.trim()) return;

    const automation: Automation = {
      id: Date.now().toString(),
      ...newAutomation,
      enabled: true,
      createdAt: new Date(),
    };

    setAutomations((prev) => [automation, ...prev]);
    await addMemory({
      type: "conversation",
      content: `Created automation: ${newAutomation.name}`,
      tags: ["automation"],
    });

    setNewAutomation({ name: "", description: "", trigger: "Every day", action: "" });
    setShowModal(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleAutomation = async (id: string) => {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const deleteAutomation = async (id: string) => {
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const AutomationCard = ({ automation }: { automation: Automation }) => (
    <View className="bg-surface border border-border rounded-lg p-4 mb-3">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="font-semibold text-foreground">{automation.name}</Text>
          <Text className="text-sm text-muted mt-1">{automation.description}</Text>
        </View>
        <Switch
          value={automation.enabled}
          onValueChange={() => toggleAutomation(automation.id)}
          trackColor={{ false: colors.border, true: colors.primary }}
        />
      </View>
      <View className="mt-3 pt-3 border-t border-border gap-2">
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-muted font-semibold">TRIGGER:</Text>
          <Text className="text-xs text-foreground">{automation.trigger}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-muted font-semibold">ACTION:</Text>
          <Text className="text-xs text-foreground">{automation.action}</Text>
        </View>
      </View>
      <Pressable
        onPress={() => deleteAutomation(automation.id)}
        className="mt-3 pt-3 border-t border-border items-center"
      >
        <Text className="text-sm text-red-500 font-semibold">Delete</Text>
      </Pressable>
    </View>
  );

  return (
    <ScreenContainer className="p-0 flex-1">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-6 pb-4 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">Automation Center</Text>
          <Text className="text-sm text-muted mt-1">
            {automations.filter((a) => a.enabled).length} automations active
          </Text>
        </View>

        {/* Active Automations */}
        <View className="px-6 pt-6 pb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Active Automations</Text>
          {automations.length === 0 ? (
            <View className="items-center justify-center py-8">
              <Text className="text-4xl mb-3">⚙️</Text>
              <Text className="text-lg font-semibold text-foreground">No automations yet</Text>
              <Text className="text-sm text-muted mt-1">Create your first automation</Text>
            </View>
          ) : (
            automations.map((automation) => (
              <AutomationCard key={automation.id} automation={automation} />
            ))
          )}
        </View>

        {/* Templates */}
        <View className="px-6 pb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Templates</Text>
          {AUTOMATION_TEMPLATES.map((template, idx) => (
            <View key={idx} className="bg-surface border border-border rounded-lg p-4 mb-3">
              <Text className="font-semibold text-foreground">{template.name}</Text>
              <Text className="text-sm text-muted mt-1">{template.description}</Text>
              <View className="mt-3 gap-2">
                <Text className="text-xs text-muted">
                  <Text className="font-semibold">Trigger:</Text> {template.trigger}
                </Text>
                <Text className="text-xs text-muted">
                  <Text className="font-semibold">Action:</Text> {template.action}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setNewAutomation({
                    name: template.name,
                    description: template.description,
                    trigger: template.trigger,
                    action: template.action,
                  });
                  setShowModal(true);
                }}
                className="mt-3 bg-primary rounded-lg p-2 items-center"
              >
                <Text className="text-white text-sm font-semibold">Use Template</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Add Automation Button */}
      <View className="px-6 pb-6">
        <Pressable
          onPress={() => {
            setNewAutomation({ name: "", description: "", trigger: "Every day", action: "" });
            setShowModal(true);
          }}
          style={({ pressed }) => [
            {
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
          className="bg-primary rounded-lg p-4 items-center justify-center"
        >
          <Text className="text-white font-semibold text-lg">+ Create Automation</Text>
        </Pressable>
      </View>

      {/* Create Automation Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-foreground">New Automation</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Text className="text-2xl text-muted">✕</Text>
              </Pressable>
            </View>

            <ScrollView className="mb-6">
              <Text className="text-sm font-semibold text-foreground mb-2">Name</Text>
              <TextInput
                placeholder="Automation name"
                placeholderTextColor={colors.muted}
                value={newAutomation.name}
                onChangeText={(text) =>
                  setNewAutomation((prev) => ({ ...prev, name: text }))
                }
                className="w-full bg-surface border border-border rounded-lg p-3 text-foreground mb-4"
              />

              <Text className="text-sm font-semibold text-foreground mb-2">Description</Text>
              <TextInput
                placeholder="What does this automation do?"
                placeholderTextColor={colors.muted}
                value={newAutomation.description}
                onChangeText={(text) =>
                  setNewAutomation((prev) => ({ ...prev, description: text }))
                }
                multiline
                numberOfLines={2}
                className="w-full bg-surface border border-border rounded-lg p-3 text-foreground mb-4"
              />

              <Text className="text-sm font-semibold text-foreground mb-2">Trigger</Text>
              <TextInput
                placeholder="When should this run?"
                placeholderTextColor={colors.muted}
                value={newAutomation.trigger}
                onChangeText={(text) =>
                  setNewAutomation((prev) => ({ ...prev, trigger: text }))
                }
                className="w-full bg-surface border border-border rounded-lg p-3 text-foreground mb-4"
              />

              <Text className="text-sm font-semibold text-foreground mb-2">Action</Text>
              <TextInput
                placeholder="What should happen?"
                placeholderTextColor={colors.muted}
                value={newAutomation.action}
                onChangeText={(text) =>
                  setNewAutomation((prev) => ({ ...prev, action: text }))
                }
                multiline
                numberOfLines={2}
                className="w-full bg-surface border border-border rounded-lg p-3 text-foreground mb-4"
              />
            </ScrollView>

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowModal(false)}
                className="flex-1 bg-surface border border-border rounded-lg p-3 items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={addAutomation}
                disabled={!newAutomation.name.trim()}
                className="flex-1 bg-primary rounded-lg p-3 items-center"
              >
                <Text className="text-white font-semibold">Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
