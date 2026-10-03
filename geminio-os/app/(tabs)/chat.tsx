import { Alert, Text, View, Pressable, TextInput, FlatList, ActivityIndicator } from "react-native";
import { useState, useRef, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useMemory } from "@/lib/memory-context";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isTyping?: boolean;
}

export default function ChatScreen() {
  const colors = useColors();
  const { addMemory } = useMemory();
  const chatMutation = trpc.chat.sendMessage.useMutation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hello! I'm Geminio, your AI assistant. How can I help you today?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Store in memory
    await addMemory({
      type: "conversation",
      content: inputText,
      tags: ["chat"],
    });

    const userInput = inputText;
    setInputText("");
    setIsLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Show typing indicator
    const typingMessage: Message = {
      id: Date.now().toString(),
      text: "",
      isUser: false,
      timestamp: new Date(),
      isTyping: true,
    };
    setMessages((prev) => [...prev, typingMessage]);

    try {
      // Call the backend LLM API using tRPC client
      const response = await chatMutation.mutateAsync({
        message: userInput,
        conversationHistory: messages
          .filter((m) => !m.isTyping)
          .map((m) => ({
            role: m.isUser ? ("user" as const) : ("assistant" as const),
            content: m.text,
          })),
      });

      if (response.success) {
        const responseText = typeof response.response === 'string' 
          ? response.response 
          : 'Response received';
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: responseText,
          isUser: false,
          timestamp: new Date(),
        };

        setMessages((prev) => [
          ...prev.filter((m) => !m.isTyping),
          aiResponse,
        ]);

        // Store AI response in memory
        await addMemory({
          type: "conversation",
          content: responseText,
          tags: ["chat", "ai-response"],
        });
      } else {
        const errorText = typeof response.response === 'string' 
          ? response.response 
          : 'An error occurred';
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: errorText,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [
          ...prev.filter((m) => !m.isTyping),
          errorMessage,
        ]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        errorMessage,
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRecording(false);
    Alert.alert("Voice input unavailable", "Voice transcription is not configured in this build. You can continue by typing your message.");
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const MessageBubble = ({ message }: { message: Message }) => (
    <View
      className={`flex-row mb-4 ${message.isUser ? "justify-end" : "justify-start"}`}
    >
      <View
        className={`max-w-xs rounded-3xl px-4 py-3 ${
          message.isUser
            ? "bg-primary rounded-br-none"
            : "bg-surface border border-border rounded-bl-none"
        }`}
      >
        {message.isTyping ? (
          <ActivityIndicator color={colors.muted} />
        ) : (
          <Text
            className={`text-base ${
              message.isUser ? "text-white" : "text-foreground"
            }`}
          >
            {message.text}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-0 flex-1">
      <View className="flex-1 flex-col">
        {/* Header */}
        <View className="px-6 pt-6 pb-4 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">
            Geminio Assistant
          </Text>
          <Text className="text-sm text-muted mt-1">
            Your AI-powered personal assistant
          </Text>
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item }) => <MessageBubble message={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          scrollEnabled={true}
          onContentSizeChange={scrollToBottom}
        />

        {/* Input Area */}
        <View className="px-6 pb-6 pt-4 border-t border-border gap-3">
          <View className="flex-row gap-3 items-end">
            <View className="flex-1 flex-row items-center bg-surface border border-border rounded-full px-4 py-2 gap-2">
              <TextInput
                placeholder="Type your message..."
                placeholderTextColor={colors.muted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!isLoading}
                className="flex-1 text-foreground text-base"
              />
              <Pressable
                onPress={handleVoiceInput}
                disabled={isLoading}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text className={`text-2xl ${isRecording ? "text-primary" : "text-muted"}`}>
                  🎤
                </Text>
              </Pressable>
            </View>
            <Pressable
              onPress={handleSendMessage}
              disabled={!inputText.trim() || isLoading}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
              className="bg-primary rounded-full p-3 items-center justify-center"
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-xl">➤</Text>
              )}
            </Pressable>
          </View>
          <Text className="text-xs text-muted text-center">
            Powered by AI • Your conversations are private
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
