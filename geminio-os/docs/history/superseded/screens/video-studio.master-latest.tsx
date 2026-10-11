import { ScrollView, Text, View, Pressable, TextInput, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import * as Haptics from "expo-haptics";

interface Video {
  id: string;
  title: string;
  duration: string;
  status: "draft" | "generating" | "completed";
  thumbnail?: string;
}

export default function VideoStudioScreen() {
  const router = useRouter();
  const colors = useColors();
  const [prompt, setPrompt] = useState("");
  const [videos, setVideos] = useState<Video[]>([
    { id: "1", title: "Product Demo", duration: "2:30", status: "completed" },
    { id: "2", title: "Tutorial Video", duration: "5:15", status: "completed" },
    { id: "3", title: "Marketing Promo", duration: "0:30", status: "draft" },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateVideo = async () => {
    if (!prompt.trim()) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGenerating(true);

    // Simulate video generation
    setTimeout(() => {
      const newVideo: Video = {
        id: Date.now().toString(),
        title: prompt,
        duration: "0:00",
        status: "generating",
      };
      setVideos([newVideo, ...videos]);
      setPrompt("");
      setIsGenerating(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 2000);
  };

  const renderVideoItem = ({ item }: { item: Video }) => (
    <Pressable
      onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      className="mb-3"
    >
      <View className="bg-surface rounded-lg overflow-hidden border border-border">
        <View className="bg-gradient-to-r from-primary/20 to-primary/10 h-32 flex items-center justify-center">
          <MaterialIcons name="video-library" size={48} color={colors.primary} />
        </View>
        <View className="p-3 gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-foreground flex-1">{item.title}</Text>
            <View className={`px-2 py-1 rounded-full ${
              item.status === "completed" ? "bg-success/20" : 
              item.status === "generating" ? "bg-warning/20" : "bg-border"
            }`}>
              <Text className={`text-xs font-semibold ${
                item.status === "completed" ? "text-success" :
                item.status === "generating" ? "text-warning" : "text-muted"
              }`}>
                {item.status === "completed" ? "Ready" : 
                 item.status === "generating" ? "Generating" : "Draft"}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-muted">{item.duration}</Text>
        </View>
      </View>
    </Pressable>
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
            <Text className="text-3xl font-bold text-foreground">Video Studio</Text>
            <Text className="text-sm text-muted">Generate and manage videos with AI</Text>
          </View>

          {/* Generation Form */}
          <View className="bg-surface rounded-xl border border-border p-4 gap-3">
            <Text className="text-sm font-semibold text-foreground">Create New Video</Text>
            <TextInput
              placeholder="Describe your video..."
              placeholderTextColor={colors.muted}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              numberOfLines={3}
              className="bg-background rounded-lg px-3 py-2 text-foreground border border-border"
              editable={!isGenerating}
            />
            <Pressable
              onPress={handleGenerateVideo}
              disabled={!prompt.trim() || isGenerating}
              style={{ opacity: !prompt.trim() || isGenerating ? 0.5 : 1 }}
            >
              <View className="bg-primary rounded-lg px-4 py-3 flex-row items-center justify-center gap-2">
                <MaterialIcons 
                  name={isGenerating ? "hourglass-empty" : "videocam"} 
                  size={20} 
                  color={colors.background} 
                />
                <Text className="text-base font-semibold text-background">
                  {isGenerating ? "Generating..." : "Generate Video"}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Video List */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Your Videos</Text>
            <FlatList
              data={videos}
              renderItem={renderVideoItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ListEmptyComponent={
                <View className="items-center justify-center py-8">
                  <MaterialIcons name="video-library" size={48} color={colors.muted} />
                  <Text className="text-sm text-muted mt-2">No videos yet</Text>
                </View>
              }
            />
          </View>

          {/* Features */}
          <View className="bg-surface rounded-xl border border-border p-4 gap-3">
            <Text className="text-sm font-semibold text-foreground">Features</Text>
            <View className="gap-2">
              {[
                { icon: "auto-awesome", text: "AI-powered video generation" },
                { icon: "edit", text: "Edit and customize videos" },
                { icon: "download", text: "Download in multiple formats" },
                { icon: "share", text: "Share directly to social media" },
              ].map((feature, idx) => (
                <View key={idx} className="flex-row items-center gap-3">
                  <MaterialIcons name={feature.icon as any} size={20} color={colors.primary} />
                  <Text className="text-sm text-foreground">{feature.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
