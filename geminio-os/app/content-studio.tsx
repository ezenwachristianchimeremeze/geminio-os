import { ScrollView, Text, View, Pressable, TextInput, FlatList, ActivityIndicator, Modal } from "react-native";
import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useMemory } from "@/lib/memory-context";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

interface ContentItem {
  id: string;
  type: "blog" | "social" | "image" | "video" | "email" | "presentation";
  title: string;
  content: string;
  createdAt: Date;
}

const CONTENT_TYPES = [
  { id: "blog", name: "Blog Post", icon: "📝", color: "bg-blue-500" },
  { id: "social", name: "Social Media", icon: "📱", color: "bg-purple-500" },
  { id: "image", name: "Image", icon: "🖼️", color: "bg-pink-500" },
  { id: "video", name: "Video Script", icon: "🎬", color: "bg-red-500" },
  { id: "email", name: "Email", icon: "📧", color: "bg-green-500" },
  { id: "presentation", name: "Presentation", icon: "📊", color: "bg-orange-500" },
];

export default function ContentStudioScreen() {
  const colors = useColors();
  const { addMemory } = useMemory();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const initialType = CONTENT_TYPES.some((item) => item.id === type) ? type as ContentItem["type"] : null;
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [selectedType, setSelectedType] = useState<ContentItem["type"] | null>(initialType);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");

  const generateContent = async () => {
    if (!selectedType || !prompt.trim()) return;

    setIsGenerating(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await trpc.chat.sendMessage.useMutation().mutateAsync({
        message: `Generate a ${selectedType} with this prompt: ${prompt}`,
        conversationHistory: [],
      });

      if (response.success) {
        const content = typeof response.response === "string" ? response.response : "Content generated";
        setGeneratedContent(content);

        const newItem: ContentItem = {
          id: Date.now().toString(),
          type: selectedType,
          title: prompt.substring(0, 50),
          content,
          createdAt: new Date(),
        };

        setContentItems((prev) => [newItem, ...prev]);

        // Store in memory
        await addMemory({
          type: "conversation",
          content: `Generated ${selectedType}: ${prompt}`,
          tags: ["content-studio", selectedType],
        });

        setPrompt("");
        setShowModal(true);
      }
    } catch (error) {
      console.error("Content generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ScreenContainer className="p-0 flex-1">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-6 pb-4 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">Content Studio</Text>
          <Text className="text-sm text-muted mt-1">Create content with AI assistance</Text>
        </View>

        {/* Content Types Grid */}
        <View className="px-6 pt-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Select Content Type</Text>
          <View className="flex-row flex-wrap gap-3">
            {CONTENT_TYPES.map((type) => (
              <Pressable
                key={type.id}
                onPress={() => setSelectedType(type.id as ContentItem["type"])}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className={`flex-1 min-w-[45%] rounded-lg p-4 items-center justify-center border-2 ${
                  selectedType === type.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface"
                }`}
              >
                <Text className="text-3xl mb-2">{type.icon}</Text>
                <Text className="text-sm font-semibold text-foreground text-center">{type.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Prompt Input */}
        {selectedType && (
          <View className="px-6 pt-6 pb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">Describe Your Content</Text>
            <TextInput
              placeholder={`Describe the ${CONTENT_TYPES.find((t) => t.id === selectedType)?.name.toLowerCase()} you want to create...`}
              placeholderTextColor={colors.muted}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              numberOfLines={4}
              editable={!isGenerating}
              className="w-full bg-surface border border-border rounded-lg p-4 text-foreground"
            />
            <Pressable
              onPress={generateContent}
              disabled={!prompt.trim() || isGenerating}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
              className="mt-4 bg-primary rounded-lg p-4 items-center justify-center"
            >
              {isGenerating ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold">Generate Content</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Generated Content History */}
        {contentItems.length > 0 && (
          <View className="px-6 pb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">Recent Content</Text>
            {contentItems.map((item) => (
              <View
                key={item.id}
                className="bg-surface border border-border rounded-lg p-4 mb-3"
              >
                <View className="flex-row items-center gap-3 mb-2">
                  <Text className="text-2xl">
                    {CONTENT_TYPES.find((t) => t.id === item.type)?.icon}
                  </Text>
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground">{item.title}</Text>
                    <Text className="text-xs text-muted">
                      {item.createdAt.toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-foreground line-clamp-2">{item.content}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Generated Content Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6 max-h-[80%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-foreground">Generated Content</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Text className="text-2xl text-muted">✕</Text>
              </Pressable>
            </View>
            <ScrollView className="flex-1 mb-4">
              <Text className="text-foreground leading-relaxed">{generatedContent}</Text>
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
                  setPrompt("");
                }}
                className="flex-1 bg-primary rounded-lg p-3 items-center"
              >
                <Text className="text-white font-semibold">Create Another</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
