import { ScrollView, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import * as Haptics from "expo-haptics";

interface StudioCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const STUDIO_CATEGORIES: StudioCategory[] = [
  {
    id: "blog",
    title: "Blog Post",
    description: "Create engaging articles and blog posts",
    icon: "📝",
    color: "bg-blue-500",
  },
  {
    id: "social",
    title: "Social Media",
    description: "Generate posts for all platforms",
    icon: "📱",
    color: "bg-purple-500",
  },
  {
    id: "image",
    title: "Image Generation",
    description: "Create stunning visuals with AI",
    icon: "🎨",
    color: "bg-pink-500",
  },
  {
    id: "video",
    title: "Video Script",
    description: "Write scripts for your videos",
    icon: "🎬",
    color: "bg-error",
  },
  {
    id: "email",
    title: "Email Campaign",
    description: "Craft compelling email content",
    icon: "✉️",
    color: "bg-success",
  },
  {
    id: "presentation",
    title: "Presentation",
    description: "Build professional slides",
    icon: "📊",
    color: "bg-orange-500",
  },
];

export default function StudioScreen() {
  const handleCategoryPress = (category: StudioCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/content-studio", params: { type: category.id } });
  };

  const CategoryCard = ({ category }: { category: StudioCategory }) => (
    <Pressable
      onPress={() => handleCategoryPress(category)}
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
      className="bg-surface rounded-3xl p-6 border border-border mb-4"
    >
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-4xl">{category.icon}</Text>
          <View className="bg-primary/10 rounded-full px-3 py-1">
            <Text className="text-xs font-semibold text-primary">
              AI Powered
            </Text>
          </View>
        </View>
        <View className="gap-1">
          <Text className="text-lg font-bold text-foreground">
            {category.title}
          </Text>
          <Text className="text-sm text-muted">
            {category.description}
          </Text>
        </View>
        <View className="flex-row items-center justify-between pt-2 border-t border-border">
          <Text className="text-xs text-muted">
            Tap to create
          </Text>
          <Text className="text-lg">→</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="px-6 pt-6 pb-8 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">
              Content Studio
            </Text>
            <Text className="text-base text-muted">
              Create amazing content with AI assistance
            </Text>
          </View>

          {/* Quick Create Button */}
          <Pressable
            onPress={() => router.push("/content-studio")}
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
            className="bg-primary rounded-2xl p-4 flex-row items-center justify-between"
          >
            <View className="gap-1">
              <Text className="text-primaryForeground font-bold text-lg">
                Quick Create
              </Text>
              <Text className="text-primaryForeground text-sm">
                Start with a template
              </Text>
            </View>
            <Text className="text-2xl">✨</Text>
          </Pressable>

          {/* Categories */}
          <View className="gap-2">
            <Text className="text-lg font-bold text-foreground">
              Choose a Format
            </Text>
            {STUDIO_CATEGORIES.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </View>

          {/* Recent Projects */}
          <View className="gap-3 mt-4">
            <Text className="text-lg font-bold text-foreground">
              Recent Projects
            </Text>
            <View className="bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-sm text-muted text-center">
                No recent projects yet. Start creating!
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
