import { ScrollView, Text, View, Pressable, TextInput, FlatList, ActivityIndicator, Modal, Switch } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useMemory } from "@/lib/memory-context";
import * as Haptics from "expo-haptics";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  completed: boolean;
  dueDate: Date | null;
  category: string;
  createdAt: Date;
}

const PRIORITY_COLORS = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

export default function TaskManagementScreen() {
  const colors = useColors();
  const { addMemory } = useMemory();
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "1",
      title: "Review project proposal",
      description: "Go through the Q3 proposal",
      priority: "high",
      completed: false,
      dueDate: new Date(Date.now() + 86400000),
      category: "Work",
      createdAt: new Date(),
    },
    {
      id: "2",
      title: "Team meeting",
      description: "Weekly sync with team",
      priority: "medium",
      completed: false,
      dueDate: new Date(Date.now() + 172800000),
      category: "Meetings",
      createdAt: new Date(),
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState<{
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    category: string;
  }>({
    title: "",
    description: "",
    priority: "medium",
    category: "General",
  });

  const addTask = async () => {
    if (!newTask.title.trim()) return;

    const task: Task = {
      id: Date.now().toString(),
      ...newTask,
      completed: false,
      dueDate: null,
      createdAt: new Date(),
    };

    setTasks((prev) => [task, ...prev]);
    await addMemory({
      type: "task",
      content: newTask.title,
      tags: [newTask.category, newTask.priority],
    });

    setNewTask({ title: "", description: "", priority: "medium", category: "General" });
    setShowModal(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleTask = async (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;

  const TaskCard = ({ task }: { task: Task }) => (
    <View className="bg-surface border border-border rounded-lg p-4 mb-3 flex-row items-start gap-3">
      <Pressable
        onPress={() => toggleTask(task.id)}
        className={`w-6 h-6 rounded-full border-2 items-center justify-center flex-shrink-0 ${
          task.completed ? "bg-primary border-primary" : "border-border"
        }`}
      >
        {task.completed && <Text className="text-white text-sm">✓</Text>}
      </Pressable>

      <View className="flex-1">
        <Text
          className={`font-semibold ${
            task.completed ? "text-muted line-through" : "text-foreground"
          }`}
        >
          {task.title}
        </Text>
        {task.description && (
          <Text className="text-sm text-muted mt-1">{task.description}</Text>
        )}
        <View className="flex-row gap-2 mt-2 items-center">
          <View
            className={`px-2 py-1 rounded-full ${
              PRIORITY_COLORS[task.priority]
            }`}
          >
            <Text className="text-white text-xs font-semibold">
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </Text>
          </View>
          <Text className="text-xs text-muted">{task.category}</Text>
          {task.dueDate && (
            <Text className="text-xs text-muted">
              Due: {task.dueDate.toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>

      <Pressable onPress={() => deleteTask(task.id)}>
        <Text className="text-lg text-muted">✕</Text>
      </Pressable>
    </View>
  );

  return (
    <ScreenContainer className="p-0 flex-1">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-6 pb-4 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">Task Management</Text>
          <Text className="text-sm text-muted mt-1">
            {completedCount} of {totalCount} tasks completed
          </Text>
          <View className="w-full bg-border rounded-full h-2 mt-3 overflow-hidden">
            <View
              className="bg-primary h-full"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </View>
        </View>

        {/* Task List */}
        <View className="px-6 pt-6 pb-6">
          {tasks.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Text className="text-4xl mb-3">📋</Text>
              <Text className="text-lg font-semibold text-foreground">No tasks yet</Text>
              <Text className="text-sm text-muted mt-1">Create your first task to get started</Text>
            </View>
          ) : (
            tasks.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </View>
      </ScrollView>

      {/* Add Task Button */}
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
          <Text className="text-white font-semibold text-lg">+ Add Task</Text>
        </Pressable>
      </View>

      {/* Add Task Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-foreground">New Task</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Text className="text-2xl text-muted">✕</Text>
              </Pressable>
            </View>

            <ScrollView className="mb-6">
              <Text className="text-sm font-semibold text-foreground mb-2">Task Title</Text>
              <TextInput
                placeholder="What needs to be done?"
                placeholderTextColor={colors.muted}
                value={newTask.title}
                onChangeText={(text) =>
                  setNewTask((prev) => ({ ...prev, title: text }))
                }
                className="w-full bg-surface border border-border rounded-lg p-3 text-foreground mb-4"
              />

              <Text className="text-sm font-semibold text-foreground mb-2">Description</Text>
              <TextInput
                placeholder="Add details..."
                placeholderTextColor={colors.muted}
                value={newTask.description}
                onChangeText={(text) =>
                  setNewTask((prev) => ({ ...prev, description: text }))
                }
                multiline
                numberOfLines={3}
                className="w-full bg-surface border border-border rounded-lg p-3 text-foreground mb-4"
              />

              <Text className="text-sm font-semibold text-foreground mb-2">Priority</Text>
              <View className="flex-row gap-2 mb-4">
                {(["low", "medium", "high"] as const).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() =>
                      setNewTask((prev) => ({ ...prev, priority: p as "high" | "medium" | "low" }))
                    }
                    className={`flex-1 p-2 rounded-lg border-2 items-center ${
                      newTask.priority === (p as "high" | "medium" | "low")
                        ? "border-primary bg-primary/10"
                        : "border-border"
                    }`}
                  >
                    <Text className="text-sm font-semibold text-foreground">
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="text-sm font-semibold text-foreground mb-2">Category</Text>
              <View className="flex-row gap-2 flex-wrap mb-4">
                {["General", "Work", "Personal", "Shopping"].map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() =>
                      setNewTask((prev) => ({ ...prev, category: cat }))
                    }
                    className={`px-3 py-2 rounded-full border-2 ${
                      newTask.category === cat
                        ? "border-primary bg-primary/10"
                        : "border-border"
                    }`}
                  >
                    <Text className="text-sm font-semibold text-foreground">
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowModal(false)}
                className="flex-1 bg-surface border border-border rounded-lg p-3 items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={addTask}
                disabled={!newTask.title.trim()}
                className="flex-1 bg-primary rounded-lg p-3 items-center"
              >
                <Text className="text-white font-semibold">Create Task</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
