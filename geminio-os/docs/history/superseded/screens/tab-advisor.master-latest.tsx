import { Text, View, Pressable, FlatList, TextInput, ActivityIndicator } from "react-native";
import { useState, useEffect, useRef } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SmoothScrollView, useSmoothScroll } from "@/components/smooth-scroll-view";
import { AnimatedMessageBubble, TypingIndicator, MessageEntrance } from "@/components/typing-animation";

interface Message {
  id: string;
  role: "user" | "advisor";
  content: string;
  timestamp: Date;
  tone?: string;
  isTyping?: boolean;
  recommendations?: Array<{
    title: string;
    description: string;
    reasoning: string;
    pros: string[];
    cons: string[];
  }>;
}

interface Suggestion {
  type: "opportunity" | "reminder" | "suggestion" | "warning";
  title: string;
  description: string;
  action: string;
  priority: "high" | "medium" | "low";
}

/**
 * AI Advisor Screen with Typing Animations & Smooth Scrolling
 * 
 * Features:
 * - Conversational AI advisor with character-by-character typing
 * - Smooth auto-scroll to bottom for new messages
 * - Animated message bubbles with entrance effects
 * - Decision support with multi-option analysis
 * - Proactive suggestions and reminders
 * - Personalized recommendations
 * - Risk and opportunity detection
 */
export default function AdvisorScreen() {
  const colors = useColors();
  const scrollViewRef = useRef<any>(null);
  const { scrollToBottom } = useSmoothScroll(scrollViewRef);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "advisor",
      content:
        "Hi! I'm your personal AI advisor. I'm here to help you make better decisions, spot opportunities, and achieve your goals. What's on your mind today?",
      timestamp: new Date(),
      tone: "friendly",
      isTyping: false,
    },
  ]);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([
    {
      type: "opportunity",
      title: "New Job Match",
      description: "Senior React Developer role matches your skills",
      action: "View Job",
      priority: "high",
    },
    {
      type: "reminder",
      title: "Interview Prep",
      description: "Your interview is in 3 days",
      action: "Prepare",
      priority: "high",
    },
    {
      type: "suggestion",
      title: "Learn TypeScript",
      description: "This skill would help you advance faster",
      action: "Learn",
      priority: "medium",
    },
  ]);

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom(true);
  }, [messages, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setShowSuggestions(false);
    setIsLoading(true);

    // Simulate AI response with typing animation
    setTimeout(() => {
      const advisorMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: "advisor",
        content: `That's a great question about "${inputValue}". Let me think about this...

I'd recommend considering a few different approaches here. Each has different trade-offs between speed, risk, and long-term impact.

What's your timeline for this decision? And what's the biggest concern you have about it?`,
        timestamp: new Date(),
        tone: "analytical",
        isTyping: true,
        recommendations: [
          {
            title: "Quick Action",
            description: "Move fast based on current knowledge",
            reasoning: "Builds momentum and gets results quickly",
            pros: ["Fast", "Clear", "Momentum"],
            cons: ["Higher risk", "May miss details"],
          },
          {
            title: "Thorough Research",
            description: "Take time to gather information",
            reasoning: "Reduces risk with informed decisions",
            pros: ["Lower risk", "Better outcomes", "Thorough"],
            cons: ["Takes longer", "May delay action"],
          },
        ],
      };

      setMessages((prev) => [...prev, advisorMessage]);
      setIsLoading(false);

      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    }, 800);
  };

  const handleTypingComplete = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, isTyping: false } : msg
      )
    );
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => (
    <MessageEntrance delay={index * 50}>
      <View
        className={`mb-4 ${
          item.role === "user" ? "items-end" : "items-start"
        }`}
      >
        <AnimatedMessageBubble
          message={item.content}
          isUser={item.role === "user"}
          isTyping={item.isTyping}
          onTypingComplete={() => handleTypingComplete(item.id)}
          className="max-w-xs"
        />

        {item.recommendations && item.recommendations.length > 0 && !item.isTyping && (
          <View className="mt-3 gap-2 max-w-xs">
            {item.recommendations.map((rec, idx) => (
              <Pressable
                key={idx}
                style={({ pressed }) => [
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View className="bg-background/10 rounded-lg p-2">
                  <Text className="text-xs font-semibold text-foreground">
                    {rec.title}
                  </Text>
                  <Text className="text-xs text-muted mt-1">
                    {rec.description}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Text className="text-xs text-muted mt-1">
          {item.timestamp.toLocaleTimeString()}
        </Text>
      </View>
    </MessageEntrance>
  );

  const renderSuggestion = ({ item }: { item: Suggestion }) => (
    <Pressable
      onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <View
        className={`rounded-lg border p-3 mb-2 ${
          item.priority === "high"
            ? "border-error bg-error/5"
            : "border-border bg-surface"
        }`}
      >
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground">
              {item.title}
            </Text>
            <Text className="text-xs text-muted mt-1">
              {item.description}
            </Text>
          </View>
          <View
            className="w-6 h-6 rounded-full items-center justify-center"
            style={{
              backgroundColor:
                item.type === "opportunity"
                  ? colors.success + "20"
                  : item.type === "warning"
                    ? colors.error + "20"
                    : colors.primary + "20",
            }}
          >
            <MaterialIcons
              name={
                item.type === "opportunity"
                  ? "lightbulb"
                  : item.type === "warning"
                    ? "warning"
                    : "info"
              }
              size={14}
              color={
                item.type === "opportunity"
                  ? colors.success
                  : item.type === "warning"
                    ? colors.error
                    : colors.primary
              }
            />
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          className="mt-2"
        >
          <Text className="text-xs font-semibold text-primary">
            {item.action} →
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="bg-background">
      <View className="flex-1 flex-col">
        {/* Header */}
        <View className="px-4 py-4 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">
            AI Advisor
          </Text>
          <Text className="text-sm text-muted mt-1">
            Your personal strategist
          </Text>
        </View>

        {/* Messages and Suggestions with Smooth Scrolling */}
        <SmoothScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ flexGrow: 1 }}
          autoScrollToBottom={true}
          scrollDelay={100}
          className="flex-1"
        >
          <View className="px-4 py-4">
            {showSuggestions && suggestions.length > 0 && (
              <View className="mb-6">
                <Text className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
                  Suggestions for You
                </Text>
                <FlatList
                  data={suggestions}
                  renderItem={renderSuggestion}
                  keyExtractor={(item, idx) => idx.toString()}
                  scrollEnabled={false}
                />
              </View>
            )}

            <FlatList
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />

            {isLoading && (
              <View className="items-start mb-4">
                <View className="bg-surface border border-border rounded-2xl px-4 py-3">
                  <TypingIndicator />
                </View>
              </View>
            )}
          </View>
        </SmoothScrollView>

        {/* Input Area */}
        <View className="px-4 py-4 border-t border-border gap-2">
          <View className="flex-row items-end gap-2">
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="Ask me anything..."
              placeholderTextColor={colors.muted}
              className="flex-1 bg-surface border border-border rounded-full px-4 py-3 text-foreground"
              multiline
              maxLength={500}
            />
            <Pressable
              onPress={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              style={({ pressed }) => [
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View className="bg-primary rounded-full p-3 items-center justify-center">
                <MaterialIcons
                  name="send"
                  size={20}
                  color={colors.background}
                />
              </View>
            </Pressable>
          </View>

          <View className="flex-row gap-2">
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className="flex-1"
            >
              <View className="bg-surface border border-border rounded-lg px-3 py-2 items-center">
                <Text className="text-xs font-semibold text-primary">
                  💡 Suggest Options
                </Text>
              </View>
            </Pressable>
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className="flex-1"
            >
              <View className="bg-surface border border-border rounded-lg px-3 py-2 items-center">
                <Text className="text-xs font-semibold text-primary">
                  ⚠️ Analyze Risks
                </Text>
              </View>
            </Pressable>
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className="flex-1"
            >
              <View className="bg-surface border border-border rounded-lg px-3 py-2 items-center">
                <Text className="text-xs font-semibold text-primary">
                  📚 Learn
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
