import { ScrollView, Text, View, Pressable, FlatList, TextInput, ActivityIndicator, Switch } from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { trpc } from "@/lib/trpc";

interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
  createdAt: Date;
}

/**
 * Automation Screen - Create and manage automated workflows
 * 
 * Features:
 * - Create automation workflows
 * - Trigger-based automation
 * - Enable/disable automations
 * - View automation history
 * - Delete automations
 */
export default function AutomationScreen() {
  const router = useRouter();
  const colors = useColors();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAutomation, setNewAutomation] = useState({
    name: "",
    description: "",
    trigger: "time",
    action: "notification",
  });

  // Mock automations for demo (will be replaced with API calls)
  useEffect(() => {
    loadAutomations();
  }, []);

  const loadAutomations = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await trpc.automation.list.useQuery();
      
      // Mock data for now
      const mockAutomations: Automation[] = [
        {
          id: "1",
          name: "Morning Briefing",
          description: "Get daily briefing at 8 AM",
          trigger: "time:08:00",
          action: "notification:briefing",
          enabled: true,
          createdAt: new Date(),
        },
        {
          id: "2",
          name: "Weekly Report",
          description: "Generate weekly report every Monday",
          trigger: "time:monday:09:00",
          action: "email:report",
          enabled: true,
          createdAt: new Date(),
        },
      ];
      
      setAutomations(mockAutomations);
    } catch (error) {
      console.error("Failed to load automations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAutomation = async () => {
    if (!newAutomation.name.trim()) {
      alert("Please enter automation name");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // TODO: Replace with actual API call
      // const response = await trpc.automation.create.useMutation();
      
      const automation: Automation = {
        id: Date.now().toString(),
        name: newAutomation.name,
        description: newAutomation.description,
        trigger: newAutomation.trigger,
        action: newAutomation.action,
        enabled: true,
        createdAt: new Date(),
      };

      setAutomations((prev) => [automation, ...prev]);
      setNewAutomation({ name: "", description: "", trigger: "time", action: "notification" });
      setShowCreateForm(false);
    } catch (error) {
      console.error("Failed to create automation:", error);
      alert("Failed to create automation");
    }
  };

  const handleToggleAutomation = async (id: string, enabled: boolean) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // TODO: Replace with actual API call
      setAutomations((prev) =>
        prev.map((auto) =>
          auto.id === id ? { ...auto, enabled: !enabled } : auto
        )
      );
    } catch (error) {
      console.error("Failed to toggle automation:", error);
    }
  };

  const handleDeleteAutomation = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      // TODO: Replace with actual API call
      setAutomations((prev) => prev.filter((auto) => auto.id !== id));
    } catch (error) {
      console.error("Failed to delete automation:", error);
      alert("Failed to delete automation");
    }
  };

  const renderAutomation = ({ item }: { item: Automation }) => (
    <View className="bg-surface rounded-lg border border-border p-4 mb-3 flex-row items-center justify-between">
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{item.name}</Text>
        <Text className="text-xs text-muted mt-1">{item.description}</Text>
        <View className="flex-row gap-2 mt-2">
          <View className="bg-primary/10 rounded px-2 py-1">
            <Text className="text-xs text-primary font-medium">{item.trigger}</Text>
          </View>
          <View className="bg-success/10 rounded px-2 py-1">
            <Text className="text-xs text-success font-medium">{item.action}</Text>
          </View>
        </View>
      </View>
      <View className="flex-row gap-2 items-center">
        <Switch
          value={item.enabled}
          onValueChange={() => handleToggleAutomation(item.id, item.enabled)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={item.enabled ? colors.primary : colors.muted}
        />
        <Pressable
          onPress={() => handleDeleteAutomation(item.id)}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialIcons name="delete" size={20} color={colors.error} />
        </Pressable>
      </View>
    </View>
  );

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
            <Text className="text-3xl font-bold text-foreground">Automation</Text>
            <Text className="text-sm text-muted">Create and manage automated workflows</Text>
          </View>

          {/* Create Button */}
          <Pressable
            onPress={() => setShowCreateForm(!showCreateForm)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="bg-primary rounded-lg px-4 py-3 flex-row items-center justify-center gap-2">
              <MaterialIcons name="add" size={20} color={colors.background} />
              <Text className="text-base font-semibold text-background">
                {showCreateForm ? "Cancel" : "Create Automation"}
              </Text>
            </View>
          </Pressable>

          {/* Create Form */}
          {showCreateForm && (
            <View className="bg-surface rounded-lg border border-border p-4 gap-3">
              <View>
                <Text className="text-xs font-semibold text-muted mb-1">Automation Name</Text>
                <TextInput
                  value={newAutomation.name}
                  onChangeText={(text) => setNewAutomation({ ...newAutomation, name: text })}
                  placeholder="e.g., Morning Briefing"
                  placeholderTextColor={colors.muted}
                  className="bg-background rounded px-3 py-2 text-foreground border border-border"
                />
              </View>

              <View>
                <Text className="text-xs font-semibold text-muted mb-1">Description</Text>
                <TextInput
                  value={newAutomation.description}
                  onChangeText={(text) => setNewAutomation({ ...newAutomation, description: text })}
                  placeholder="What does this automation do?"
                  placeholderTextColor={colors.muted}
                  className="bg-background rounded px-3 py-2 text-foreground border border-border"
                  multiline
                />
              </View>

              <View>
                <Text className="text-xs font-semibold text-muted mb-1">Trigger</Text>
                <View className="flex-row gap-2">
                  {["time", "event", "manual"].map((trigger) => (
                    <Pressable
                      key={trigger}
                      onPress={() => setNewAutomation({ ...newAutomation, trigger })}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    >
                      <View
                        className={`rounded px-3 py-2 border ${
                          newAutomation.trigger === trigger
                            ? "bg-primary border-primary"
                            : "bg-background border-border"
                        }`}
                      >
                        <Text
                          className={`text-xs font-medium ${
                            newAutomation.trigger === trigger ? "text-background" : "text-foreground"
                          }`}
                        >
                          {trigger}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View>
                <Text className="text-xs font-semibold text-muted mb-1">Action</Text>
                <View className="flex-row gap-2">
                  {["notification", "email", "sms"].map((action) => (
                    <Pressable
                      key={action}
                      onPress={() => setNewAutomation({ ...newAutomation, action })}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    >
                      <View
                        className={`rounded px-3 py-2 border ${
                          newAutomation.action === action
                            ? "bg-success border-success"
                            : "bg-background border-border"
                        }`}
                      >
                        <Text
                          className={`text-xs font-medium ${
                            newAutomation.action === action ? "text-background" : "text-foreground"
                          }`}
                        >
                          {action}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={handleCreateAutomation}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View className="bg-success rounded-lg px-4 py-3 items-center">
                  <Text className="text-base font-semibold text-background">Create</Text>
                </View>
              </Pressable>
            </View>
          )}

          {/* Loading State */}
          {isLoading && (
            <View className="items-center justify-center py-8">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}

          {/* Automations List */}
          {!isLoading && automations.length > 0 ? (
            <View className="gap-3">
              <Text className="text-sm font-semibold text-muted uppercase tracking-wide">
                Your Automations ({automations.length})
              </Text>
              <FlatList
                data={automations}
                renderItem={renderAutomation}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            </View>
          ) : !isLoading ? (
            <View className="bg-surface rounded-lg border border-border p-6 items-center gap-2">
              <MaterialIcons name="settings-remote" size={48} color={colors.primary} />
              <Text className="text-sm font-semibold text-foreground">No Automations Yet</Text>
              <Text className="text-xs text-muted text-center">
                Create your first automation to get started
              </Text>
            </View>
          ) : null}

          {/* Spacing */}
          <View className="h-4" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
