import { ScrollView, Text, View, Pressable, TextInput, Modal, ActivityIndicator } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useMemory } from "@/lib/memory-context";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

interface Agent {
  id: string;
  name: string;
  role: string;
  icon: string;
  description: string;
  specialty: string;
  status: "idle" | "working" | "ready";
}

interface AgentTask {
  id: string;
  agentId: string;
  task: string;
  result: string;
  timestamp: Date;
}

const AGENTS: Agent[] = [
  {
    id: "writer",
    name: "Writer Agent",
    role: "Content Creator",
    icon: "✍️",
    description: "Creates engaging written content",
    specialty: "Blog posts, articles, copywriting",
    status: "ready",
  },
  {
    id: "researcher",
    name: "Researcher Agent",
    role: "Information Specialist",
    icon: "🔬",
    description: "Gathers and analyzes information",
    specialty: "Research, analysis, insights",
    status: "ready",
  },
  {
    id: "developer",
    name: "Developer Agent",
    role: "Code Expert",
    icon: "👨‍💻",
    description: "Assists with code and development",
    specialty: "Programming, debugging, architecture",
    status: "ready",
  },
  {
    id: "seo",
    name: "SEO Agent",
    role: "Optimization Specialist",
    icon: "📊",
    description: "Optimizes content for search",
    specialty: "SEO, keywords, rankings",
    status: "ready",
  },
  {
    id: "designer",
    name: "Designer Agent",
    role: "Visual Creator",
    icon: "🎨",
    description: "Creates visual concepts and designs",
    specialty: "UI/UX, branding, visual design",
    status: "ready",
  },
  {
    id: "learning",
    name: "Learning Agent",
    role: "Educational Guide",
    icon: "📚",
    description: "Creates educational content",
    specialty: "Tutorials, courses, explanations",
    status: "ready",
  },
];

export default function MultiAgentSystemScreen() {
  const colors = useColors();
  const { addMemory } = useMemory();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [taskInput, setTaskInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [result, setResult] = useState("");

  const assignTask = async () => {
    if (!selectedAgent || !taskInput.trim()) return;

    setIsProcessing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await trpc.chat.sendMessage.useMutation().mutateAsync({
        message: `As a ${selectedAgent.name}, ${selectedAgent.specialty}: ${taskInput}`,
        conversationHistory: [],
      });

      if (response.success) {
        const resultText = typeof response.response === "string" ? response.response : "Task completed";
        
        const agentTask: AgentTask = {
          id: Date.now().toString(),
          agentId: selectedAgent.id,
          task: taskInput,
          result: resultText,
          timestamp: new Date(),
        };

        setTasks((prev) => [agentTask, ...prev]);
        setResult(resultText);

        await addMemory({
          type: "conversation",
          content: `${selectedAgent.name}: ${taskInput}`,
          tags: ["multi-agent", selectedAgent.id],
        });

        setTaskInput("");
        setShowModal(true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Agent task error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const AgentCard = ({ agent }: { agent: Agent }) => (
    <Pressable
      onPress={() => setSelectedAgent(agent)}
      className={`rounded-lg p-4 mb-3 border-2 ${
        selectedAgent?.id === agent.id
          ? "border-primary bg-primary/10"
          : "border-border bg-surface"
      }`}
    >
      <View className="flex-row items-start gap-3">
        <Text className="text-4xl">{agent.icon}</Text>
        <View className="flex-1">
          <Text className="font-semibold text-foreground">{agent.name}</Text>
          <Text className="text-xs text-muted mt-1">{agent.role}</Text>
          <Text className="text-sm text-foreground mt-2">{agent.description}</Text>
          <Text className="text-xs text-muted mt-2">Specialty: {agent.specialty}</Text>
        </View>
        <View
          className={`px-2 py-1 rounded-full ${
            agent.status === "ready" ? "bg-success/20" : "bg-warning/20"
          }`}
        >
          <Text className="text-xs text-successText">Ready</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="p-0 flex-1">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-6 pb-4 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">Multi-Agent System</Text>
          <Text className="text-sm text-muted mt-1">
            {AGENTS.length} specialized AI agents ready to help
          </Text>
        </View>

        {/* Agents Grid */}
        <View className="px-6 pt-6 pb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Select an Agent</Text>
          {AGENTS.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </View>

        {/* Task Input */}
        {selectedAgent && (
          <View className="px-6 pb-6 border-t border-border pt-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Assign Task to {selectedAgent.name}
            </Text>
            <TextInput
              placeholder={`What do you want ${selectedAgent.name.split(" ")[0]} to do?`}
              placeholderTextColor={colors.muted}
              value={taskInput}
              onChangeText={setTaskInput}
              multiline
              numberOfLines={4}
              editable={!isProcessing}
              className="w-full bg-surface border border-border rounded-lg p-4 text-foreground mb-4"
            />
            <Pressable
              onPress={assignTask}
              disabled={!taskInput.trim() || isProcessing}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
              className="bg-primary rounded-lg p-4 items-center justify-center"
            >
              {isProcessing ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-primaryForeground font-semibold">Assign Task</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Task History */}
        {tasks.length > 0 && (
          <View className="px-6 pb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">Task History</Text>
            {tasks.map((task) => {
              const agent = AGENTS.find((a) => a.id === task.agentId);
              return (
                <View key={task.id} className="bg-surface border border-border rounded-lg p-4 mb-3">
                  <View className="flex-row items-center gap-2 mb-2">
                    <Text className="text-2xl">{agent?.icon}</Text>
                    <Text className="font-semibold text-foreground">{agent?.name}</Text>
                  </View>
                  <Text className="text-sm text-foreground mb-2">{task.task}</Text>
                  <Text className="text-xs text-muted">{task.timestamp.toLocaleTimeString()}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Result Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6 max-h-[80%]">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center gap-2">
                <Text className="text-3xl">{selectedAgent?.icon}</Text>
                <Text className="text-xl font-bold text-foreground">{selectedAgent?.name}</Text>
              </View>
              <Pressable onPress={() => setShowModal(false)}>
                <Text className="text-2xl text-muted">✕</Text>
              </Pressable>
            </View>
            <ScrollView className="flex-1 mb-4">
              <Text className="text-foreground leading-relaxed">{result}</Text>
            </ScrollView>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowModal(false)}
                className="flex-1 bg-surface border border-border rounded-lg p-3 items-center"
              >
                <Text className="text-foreground font-semibold">Close</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowModal(false);
                  setTaskInput("");
                }}
                className="flex-1 bg-primary rounded-lg p-3 items-center"
              >
                <Text className="text-primaryForeground font-semibold">New Task</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
