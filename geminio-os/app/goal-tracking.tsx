import { ScrollView, Text, View, Pressable, TextInput, Modal, ActivityIndicator } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useMemory } from "@/lib/memory-context";
import * as Haptics from "expo-haptics";

interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  targetDate: Date;
  progress: number; // 0-100
  milestones: Milestone[];
  createdAt: Date;
}

interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

const GOAL_CATEGORIES = [
  { name: "Health", icon: "💪", color: "bg-green-500" },
  { name: "Career", icon: "💼", color: "bg-blue-500" },
  { name: "Learning", icon: "📚", color: "bg-purple-500" },
  { name: "Finance", icon: "💰", color: "bg-yellow-500" },
  { name: "Personal", icon: "🎯", color: "bg-pink-500" },
  { name: "Relationships", icon: "❤️", color: "bg-red-500" },
];

export default function GoalTrackingScreen() {
  const colors = useColors();
  const { addMemory } = useMemory();
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: "1",
      title: "Learn React Native",
      description: "Master React Native development",
      category: "Learning",
      targetDate: new Date(Date.now() + 7776000000), // 90 days
      progress: 45,
      milestones: [
        { id: "1", title: "Complete basics", completed: true },
        { id: "2", title: "Build first app", completed: true },
        { id: "3", title: "Deploy to app store", completed: false },
      ],
      createdAt: new Date(),
    },
    {
      id: "2",
      title: "Save $10,000",
      description: "Build emergency fund",
      category: "Finance",
      targetDate: new Date(Date.now() + 15552000000), // 180 days
      progress: 30,
      milestones: [
        { id: "1", title: "Save $2,500", completed: true },
        { id: "2", title: "Save $5,000", completed: false },
        { id: "3", title: "Save $10,000", completed: false },
      ],
      createdAt: new Date(),
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    category: "Personal",
    daysToComplete: "90",
  });

  const addGoal = async () => {
    if (!newGoal.title.trim()) return;

    const goal: Goal = {
      id: Date.now().toString(),
      title: newGoal.title,
      description: newGoal.description,
      category: newGoal.category,
      targetDate: new Date(Date.now() + parseInt(newGoal.daysToComplete) * 86400000),
      progress: 0,
      milestones: [],
      createdAt: new Date(),
    };

    setGoals((prev) => [goal, ...prev]);
    await addMemory({
      type: "goal",
      content: newGoal.title,
      tags: [newGoal.category],
    });

    setNewGoal({ title: "", description: "", category: "Personal", daysToComplete: "90" });
    setShowModal(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const updateProgress = async (id: string, newProgress: number) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, progress: Math.min(100, newProgress) } : g))
    );
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleMilestone = async (goalId: string, milestoneId: string) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? {
              ...g,
              milestones: g.milestones.map((m) =>
                m.id === milestoneId ? { ...m, completed: !m.completed } : m
              ),
            }
          : g
      )
    );
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const deleteGoal = async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const daysRemaining = (targetDate: Date) => {
    const days = Math.ceil((targetDate.getTime() - Date.now()) / 86400000);
    return days > 0 ? days : 0;
  };

  const GoalCard = ({ goal }: { goal: Goal }) => (
    <View className="bg-surface border border-border rounded-lg p-4 mb-4">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">{goal.title}</Text>
          <Text className="text-sm text-muted mt-1">{goal.description}</Text>
        </View>
        <Pressable onPress={() => deleteGoal(goal.id)}>
          <Text className="text-lg text-muted">✕</Text>
        </Pressable>
      </View>

      <View className="flex-row items-center gap-2 mb-3">
        <Text className="text-2xl">
          {GOAL_CATEGORIES.find((c) => c.name === goal.category)?.icon}
        </Text>
        <Text className="text-sm text-muted">{goal.category}</Text>
        <Text className="text-sm text-muted">•</Text>
        <Text className="text-sm text-muted">{daysRemaining(goal.targetDate)} days left</Text>
      </View>

      {/* Progress Bar */}
      <View className="mb-3">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm font-semibold text-foreground">Progress</Text>
          <Text className="text-sm font-semibold text-primary">{goal.progress}%</Text>
        </View>
        <View className="w-full bg-border rounded-full h-3 overflow-hidden">
          <View
            className="bg-primary h-full"
            style={{ width: `${goal.progress}%` }}
          />
        </View>
      </View>

      {/* Progress Controls */}
      <View className="flex-row gap-2 mb-3">
        <Pressable
          onPress={() => updateProgress(goal.id, goal.progress - 10)}
          className="flex-1 bg-border rounded-lg p-2 items-center"
        >
          <Text className="text-foreground font-semibold">-10%</Text>
        </Pressable>
        <Pressable
          onPress={() => updateProgress(goal.id, goal.progress + 10)}
          className="flex-1 bg-primary rounded-lg p-2 items-center"
        >
          <Text className="text-white font-semibold">+10%</Text>
        </Pressable>
      </View>

      {/* Milestones */}
      {goal.milestones.length > 0 && (
        <View className="border-t border-border pt-3">
          <Text className="text-sm font-semibold text-foreground mb-2">Milestones</Text>
          {goal.milestones.map((milestone) => (
            <Pressable
              key={milestone.id}
              onPress={() => toggleMilestone(goal.id, milestone.id)}
              className="flex-row items-center gap-2 py-2"
            >
              <View
                className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                  milestone.completed ? "bg-primary border-primary" : "border-border"
                }`}
              >
                {milestone.completed && <Text className="text-white text-xs">✓</Text>}
              </View>
              <Text
                className={`text-sm ${
                  milestone.completed ? "text-muted line-through" : "text-foreground"
                }`}
              >
                {milestone.title}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ScreenContainer className="p-0 flex-1">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-6 pb-4 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">Goal Tracking</Text>
          <Text className="text-sm text-muted mt-1">
            {goals.length} active goals
          </Text>
        </View>

        {/* Goals List */}
        <View className="px-6 pt-6 pb-6">
          {goals.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Text className="text-4xl mb-3">🎯</Text>
              <Text className="text-lg font-semibold text-foreground">No goals yet</Text>
              <Text className="text-sm text-muted mt-1">Set your first goal to get started</Text>
            </View>
          ) : (
            goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)
          )}
        </View>
      </ScrollView>

      {/* Add Goal Button */}
      <View className="px-6 pb-6">
        <Pressable
          onPress={() => setShowModal(true)}
          style={({ pressed }) => [
            {
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
          className="bg-primary rounded-lg p-4 items-center justify-center"
        >
          <Text className="text-white font-semibold text-lg">+ Add Goal</Text>
        </Pressable>
      </View>

      {/* Add Goal Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-foreground">New Goal</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Text className="text-2xl text-muted">✕</Text>
              </Pressable>
            </View>

            <ScrollView className="mb-6">
              <Text className="text-sm font-semibold text-foreground mb-2">Goal Title</Text>
              <TextInput
                placeholder="What do you want to achieve?"
                placeholderTextColor={colors.muted}
                value={newGoal.title}
                onChangeText={(text) =>
                  setNewGoal((prev) => ({ ...prev, title: text }))
                }
                className="w-full bg-surface border border-border rounded-lg p-3 text-foreground mb-4"
              />

              <Text className="text-sm font-semibold text-foreground mb-2">Description</Text>
              <TextInput
                placeholder="Add details about your goal..."
                placeholderTextColor={colors.muted}
                value={newGoal.description}
                onChangeText={(text) =>
                  setNewGoal((prev) => ({ ...prev, description: text }))
                }
                multiline
                numberOfLines={3}
                className="w-full bg-surface border border-border rounded-lg p-3 text-foreground mb-4"
              />

              <Text className="text-sm font-semibold text-foreground mb-2">Category</Text>
              <View className="flex-row gap-2 flex-wrap mb-4">
                {GOAL_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.name}
                    onPress={() =>
                      setNewGoal((prev) => ({ ...prev, category: cat.name }))
                    }
                    className={`px-3 py-2 rounded-full border-2 ${
                      newGoal.category === cat.name
                        ? "border-primary bg-primary/10"
                        : "border-border"
                    }`}
                  >
                    <Text className="text-sm font-semibold text-foreground">
                      {cat.icon} {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="text-sm font-semibold text-foreground mb-2">Timeline (days)</Text>
              <TextInput
                placeholder="90"
                placeholderTextColor={colors.muted}
                value={newGoal.daysToComplete}
                onChangeText={(text) =>
                  setNewGoal((prev) => ({ ...prev, daysToComplete: text }))
                }
                keyboardType="number-pad"
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
                onPress={addGoal}
                disabled={!newGoal.title.trim()}
                className="flex-1 bg-primary rounded-lg p-3 items-center"
              >
                <Text className="text-white font-semibold">Create Goal</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
