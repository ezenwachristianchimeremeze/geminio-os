import { ScrollView, Text, View, Pressable, ActivityIndicator, FlatList } from "react-native";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useMemory } from "@/lib/memory-context";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

interface VoiceCommand {
  id: string;
  command: string;
  response: string;
  timestamp: Date;
  type: "task" | "search" | "chat" | "control";
}

const VOICE_COMMANDS = [
  { icon: "📝", label: "Create Task", description: "Say: Create a task to..." },
  { icon: "🔍", label: "Search", description: "Say: Search for..." },
  { icon: "💬", label: "Chat", description: "Say: Tell me about..." },
  { icon: "⚙️", label: "Control", description: "Say: Turn on dark mode" },
];

export default function VoiceAssistantScreen() {
  const colors = useColors();
  const { addMemory } = useMemory();
  const [isListening, setIsListening] = useState(false);
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const startListening = async () => {
    setIsListening(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Simulate voice recording
    setTimeout(async () => {
      setIsListening(false);
      setIsProcessing(true);

      try {
        // Simulate voice input
        const simulatedCommand = "Create a task to review the project proposal";

        const response = await trpc.chat.sendMessage.useMutation().mutateAsync({
          message: `Process this voice command: "${simulatedCommand}"`,
          conversationHistory: [],
        });

        if (response.success) {
          const responseText = typeof response.response === "string" ? response.response : "Command processed";
          
          const command: VoiceCommand = {
            id: Date.now().toString(),
            command: simulatedCommand,
            response: responseText,
            timestamp: new Date(),
            type: "task",
          };

          setCommands((prev) => [command, ...prev]);
          setLastCommand(command);

          await addMemory({
            type: "conversation",
            content: `Voice command: ${simulatedCommand}`,
            tags: ["voice-assistant", "command"],
          });

          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        console.error("Voice command error:", error);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setIsProcessing(false);
      }
    }, 2000);
  };

  const CommandCard = ({ command }: { command: VoiceCommand }) => (
    <View className="bg-surface border border-border rounded-lg p-4 mb-3">
      <View className="flex-row items-start gap-3">
        <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
          <Text className="text-lg">🎤</Text>
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-foreground">{command.command}</Text>
          <Text className="text-sm text-muted mt-1">{command.response}</Text>
          <Text className="text-xs text-muted mt-2">{command.timestamp.toLocaleTimeString()}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-0 flex-1">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-6 pb-4 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">Voice Assistant</Text>
          <Text className="text-sm text-muted mt-1">Control Geminio with voice commands</Text>
        </View>

        {/* Voice Input Section */}
        <View className="px-6 pt-8 pb-8 items-center">
          <View className="w-32 h-32 rounded-full bg-primary/10 items-center justify-center mb-6 border-4 border-primary">
            {isListening ? (
              <View className="items-center">
                <ActivityIndicator color={colors.primary} size="large" />
                <Text className="text-sm text-muted mt-3">Listening...</Text>
              </View>
            ) : isProcessing ? (
              <View className="items-center">
                <ActivityIndicator color={colors.primary} size="large" />
                <Text className="text-sm text-muted mt-3">Processing...</Text>
              </View>
            ) : (
              <Text className="text-5xl">🎤</Text>
            )}
          </View>

          <Pressable
            onPress={startListening}
            disabled={isListening || isProcessing}
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
            className="bg-primary rounded-full px-8 py-4 items-center justify-center"
          >
            <Text className="text-white font-semibold text-lg">
              {isListening || isProcessing ? "Processing..." : "Start Listening"}
            </Text>
          </Pressable>

          <Text className="text-sm text-muted mt-4 text-center">
            Tap the button and speak your command
          </Text>
        </View>

        {/* Quick Commands */}
        <View className="px-6 pb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Quick Commands</Text>
          <View className="flex-row flex-wrap gap-3">
            {VOICE_COMMANDS.map((cmd, idx) => (
              <View
                key={idx}
                className="flex-1 min-w-[45%] bg-surface border border-border rounded-lg p-4 items-center"
              >
                <Text className="text-3xl mb-2">{cmd.icon}</Text>
                <Text className="text-sm font-semibold text-foreground text-center">{cmd.label}</Text>
                <Text className="text-xs text-muted text-center mt-1">{cmd.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Last Command Result */}
        {lastCommand && (
          <View className="px-6 pb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">Last Command</Text>
            <CommandCard command={lastCommand} />
          </View>
        )}

        {/* Command History */}
        {commands.length > 1 && (
          <View className="px-6 pb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">Command History</Text>
            {commands.slice(1).map((cmd) => (
              <CommandCard key={cmd.id} command={cmd} />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
