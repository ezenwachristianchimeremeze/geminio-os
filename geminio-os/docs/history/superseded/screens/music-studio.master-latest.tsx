import { ScrollView, Text, View, Pressable, TextInput, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import * as Haptics from "expo-haptics";

interface Track {
  id: string;
  title: string;
  duration: string;
  genre: string;
  status: "draft" | "generating" | "completed";
}

export default function MusicStudioScreen() {
  const router = useRouter();
  const colors = useColors();
  const [prompt, setPrompt] = useState("");
  const [genre, setGenre] = useState("ambient");
  const [tracks, setTracks] = useState<Track[]>([
    { id: "1", title: "Ambient Dreams", duration: "3:45", genre: "ambient", status: "completed" },
    { id: "2", title: "Upbeat Energy", duration: "2:30", genre: "electronic", status: "completed" },
    { id: "3", title: "Jazz Vibes", duration: "4:15", genre: "jazz", status: "draft" },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const genres = ["ambient", "electronic", "jazz", "classical", "lo-fi", "rock"];

  const handleGenerateTrack = async () => {
    if (!prompt.trim()) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGenerating(true);

    setTimeout(() => {
      const newTrack: Track = {
        id: Date.now().toString(),
        title: prompt,
        duration: "0:00",
        genre: genre,
        status: "generating",
      };
      setTracks([newTrack, ...tracks]);
      setPrompt("");
      setIsGenerating(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 2000);
  };

  const renderTrackItem = ({ item }: { item: Track }) => (
    <Pressable
      onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      className="mb-3"
    >
      <View className="bg-surface rounded-lg border border-border p-3 flex-row items-center gap-3">
        <View className="bg-primary/20 rounded-lg p-2">
          <MaterialIcons name="music-note" size={24} color={colors.primary} />
        </View>
        <View className="flex-1 gap-1">
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
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted capitalize">{item.genre}</Text>
            <Text className="text-xs text-muted">{item.duration}</Text>
          </View>
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
            <Text className="text-3xl font-bold text-foreground">Music Studio</Text>
            <Text className="text-sm text-muted">Generate and compose music with AI</Text>
          </View>

          {/* Generation Form */}
          <View className="bg-surface rounded-xl border border-border p-4 gap-3">
            <Text className="text-sm font-semibold text-foreground">Create New Track</Text>
            
            <TextInput
              placeholder="Describe your music..."
              placeholderTextColor={colors.muted}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              numberOfLines={3}
              className="bg-background rounded-lg px-3 py-2 text-foreground border border-border"
              editable={!isGenerating}
            />

            {/* Genre Selection */}
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted">Genre</Text>
              <View className="flex-row flex-wrap gap-2">
                {genres.map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setGenre(g)}
                    disabled={isGenerating}
                  >
                    <View className={`px-3 py-2 rounded-full border ${
                      genre === g 
                        ? `bg-primary border-primary` 
                        : `bg-background border-border`
                    }`}>
                      <Text className={`text-xs font-semibold capitalize ${
                        genre === g ? "text-background" : "text-foreground"
                      }`}>
                        {g}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              onPress={handleGenerateTrack}
              disabled={!prompt.trim() || isGenerating}
              style={{ opacity: !prompt.trim() || isGenerating ? 0.5 : 1 }}
            >
              <View className="bg-primary rounded-lg px-4 py-3 flex-row items-center justify-center gap-2">
                <MaterialIcons 
                  name={isGenerating ? "hourglass-empty" : "music-note"} 
                  size={20} 
                  color={colors.background} 
                />
                <Text className="text-base font-semibold text-background">
                  {isGenerating ? "Generating..." : "Generate Track"}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Tracks List */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Your Tracks</Text>
            <FlatList
              data={tracks}
              renderItem={renderTrackItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ListEmptyComponent={
                <View className="items-center justify-center py-8">
                  <MaterialIcons name="music-note" size={48} color={colors.muted} />
                  <Text className="text-sm text-muted mt-2">No tracks yet</Text>
                </View>
              }
            />
          </View>

          {/* Features */}
          <View className="bg-surface rounded-xl border border-border p-4 gap-3">
            <Text className="text-sm font-semibold text-foreground">Features</Text>
            <View className="gap-2">
              {[
                { icon: "auto-awesome", text: "AI music composition" },
                { icon: "tune", text: "Customize tempo and mood" },
                { icon: "layers", text: "Stem export (vocals, drums, etc)" },
                { icon: "share", text: "Share to streaming platforms" },
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
