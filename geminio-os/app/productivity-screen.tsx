import { ScrollView, Text, View, Pressable, TextInput, FlatList } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import * as Haptics from "expo-haptics";

export default function ProductivityScreen() {
  const colors = useColors();
  const { tasks, goals, addTask, updateTask, deleteTask } = useData();
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [activeTab, setActiveTab] = useState<"tasks" | "goals">("tasks");

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    addTask({
      title: newTaskTitle,
      completed: false,
      priority: "medium",
    });

    setNewTaskTitle("");
    setShowAddTask(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleToggleTask = (taskId: string, completed: boolean) => {
    updateTask(taskId, { completed: !completed });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const TaskCard = ({ task }: { task: typeof tasks[0] }) => (
    <Pressable
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border flex-row items-center justify-between"
    >
      <View className="flex-1 flex-row items-center gap-3">
        <Pressable
          onPress={() => handleToggleTask(task.id, task.completed)}
          className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
            task.completed
              ? "bg-success border-success"
              : "border-muted"
          }`}
        >
          {task.completed && <Text className="text-successForeground text-sm">✓</Text>}
        </Pressable>
        <View className="flex-1">
          <Text
            className={`font-semibold ${
              task.completed
                ? "text-muted line-through"
                : "text-foreground"
            }`}
          >
            {task.title}
          </Text>
          {task.description && (
            <Text className="text-xs text-muted mt-1">
              {task.description}
            </Text>
          )}
        </View>
      </View>
      <View
        className={`px-3 py-1 rounded-full ${
          task.priority === "high"
            ? "bg-error/20"
            : task.priority === "medium"
              ? "bg-warning/20"
              : "bg-success/20"
        }`}
      >
        <Text
          className={`text-xs font-semibold ${
            task.priority === "high"
              ? "text-errorText"
              : task.priority === "medium"
                ? "text-warningText"
                : "text-successText"
          }`}
        >
          {task.priority}
        </Text>
      </View>
    </Pressable>
  );

  const GoalCard = ({ goal }: { goal: typeof goals[0] }) => {
    const progressPercent = (goal.progress / goal.target) * 100;

    return (
      <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="font-bold text-foreground flex-1">
            {goal.title}
          </Text>
          <Text className="text-sm font-semibold text-primary">
            {goal.progress}/{goal.target}
          </Text>
        </View>
        <View className="h-2 bg-border rounded-full overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </View>
        <Text className="text-xs text-muted mt-2">
          {Math.round(progressPercent)}% Complete • {goal.category}
        </Text>
      </View>
    );
  };

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="px-6 pt-6 pb-8 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">
              Productivity Center
            </Text>
            <Text className="text-base text-muted">
              Manage tasks and track goals
            </Text>
          </View>

          {/* Tab Navigation */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setActiveTab("tasks")}
              className={`flex-1 py-3 px-4 rounded-lg border ${
                activeTab === "tasks"
                  ? "bg-primary border-primary"
                  : "border-border bg-surface"
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  activeTab === "tasks"
                    ? "text-primaryForeground"
                    : "text-foreground"
                }`}
              >
                Tasks ({tasks.length})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("goals")}
              className={`flex-1 py-3 px-4 rounded-lg border ${
                activeTab === "goals"
                  ? "bg-primary border-primary"
                  : "border-border bg-surface"
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  activeTab === "goals"
                    ? "text-primaryForeground"
                    : "text-foreground"
                }`}
              >
                Goals ({goals.length})
              </Text>
            </Pressable>
          </View>

          {/* Content */}
          {activeTab === "tasks" ? (
            <View className="gap-4">
              {/* Add Task Button */}
              {!showAddTask && (
                <Pressable
                  onPress={() => setShowAddTask(true)}
                  style={({ pressed }) => [
                    {
                      opacity: pressed ? 0.7 : 1,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                  className="bg-primary rounded-2xl p-4 items-center"
                >
                  <Text className="text-primaryForeground font-semibold">
                    + Add New Task
                  </Text>
                </Pressable>
              )}

              {/* Add Task Form */}
              {showAddTask && (
                <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
                  <TextInput
                    placeholder="Task title..."
                    placeholderTextColor={colors.muted}
                    value={newTaskTitle}
                    onChangeText={setNewTaskTitle}
                    className="bg-background border border-border rounded-lg p-3 text-foreground"
                  />
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={handleAddTask}
                      className="flex-1 bg-primary rounded-lg p-3 items-center"
                    >
                      <Text className="text-primaryForeground font-semibold">
                        Add Task
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setShowAddTask(false);
                        setNewTaskTitle("");
                      }}
                      className="flex-1 bg-surface border border-border rounded-lg p-3 items-center"
                    >
                      <Text className="text-foreground font-semibold">
                        Cancel
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Tasks List */}
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </View>
          ) : (
            <View className="gap-4">
              {/* Goals List */}
              {goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
