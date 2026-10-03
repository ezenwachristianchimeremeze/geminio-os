import { ScrollView, Text, View, Pressable, TextInput, FlatList } from "react-native";
import { useState, useMemo } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useSearch, type SearchableItem } from "@/hooks/use-search";

// Mock data from all modules
const mockSearchItems: SearchableItem[] = [
  {
    id: "1",
    title: "Review project proposal",
    content: "Go through the Q3 proposal and provide feedback",
    tags: ["work", "urgent"],
    type: "task",
    createdAt: new Date(),
  },
  {
    id: "2",
    title: "Learn React Native",
    content: "Master React Native development for mobile apps",
    tags: ["learning", "programming"],
    type: "goal",
    createdAt: new Date(),
  },
  {
    id: "3",
    title: "Project Ideas",
    content: "Notes on potential project ideas and features",
    tags: ["ideas", "brainstorm"],
    type: "note",
    createdAt: new Date(),
  },
  {
    id: "4",
    title: "AI Engineer Role",
    content: "Senior position at growing tech startup",
    tags: ["career", "opportunity"],
    type: "opportunity",
    createdAt: new Date(),
  },
];

const ITEM_TYPE_ICONS: Record<string, string> = {
  task: "📋",
  goal: "🎯",
  note: "📝",
  message: "💬",
  opportunity: "🌟",
  automation: "⚙️",
};

export default function GlobalSearchScreen() {
  const colors = useColors();
  const { query, setQuery, filters, addFilter, removeFilter, clearFilters, results, allTags, allTypes } =
    useSearch(mockSearchItems);

  const [showFilters, setShowFilters] = useState(false);

  const ResultCard = ({ item }: { item: SearchableItem }) => (
    <View className="bg-surface border border-border rounded-lg p-4 mb-3">
      <View className="flex-row items-start gap-3">
        <Text className="text-2xl">{ITEM_TYPE_ICONS[item.type]}</Text>
        <View className="flex-1">
          <Text className="font-semibold text-foreground">{item.title}</Text>
          <Text className="text-sm text-muted mt-1 line-clamp-2">{item.content}</Text>
          <View className="flex-row gap-2 mt-2 flex-wrap">
            {item.tags.map((tag, idx) => (
              <View key={idx} className="bg-primary/10 px-2 py-1 rounded-full">
                <Text className="text-xs text-primary">{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-0 flex-1">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-6 pb-4 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">Global Search</Text>
          <Text className="text-sm text-muted mt-1">Search across all modules</Text>
        </View>

        {/* Search Input */}
        <View className="px-6 pt-6 pb-4">
          <View className="flex-row items-center bg-surface border border-border rounded-lg px-4 py-3 gap-2">
            <Text className="text-lg">🔍</Text>
            <TextInput
              placeholder="Search tasks, goals, notes, opportunities..."
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              className="flex-1 text-foreground"
            />
            {query && (
              <Pressable onPress={() => setQuery("")}>
                <Text className="text-lg text-muted">✕</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Filter Toggle */}
        <View className="px-6 pb-4">
          <Pressable
            onPress={() => setShowFilters(!showFilters)}
            className="flex-row items-center justify-between bg-surface border border-border rounded-lg px-4 py-3"
          >
            <View className="flex-row items-center gap-2">
              <Text className="text-lg">⚙️</Text>
              <Text className="font-semibold text-foreground">Filters</Text>
              {Object.keys(filters).length > 0 && (
                <View className="bg-primary px-2 py-1 rounded-full">
                  <Text className="text-xs text-white font-semibold">{Object.keys(filters).length}</Text>
                </View>
              )}
            </View>
            <Text className="text-lg text-muted">{showFilters ? "▼" : "▶"}</Text>
          </Pressable>
        </View>

        {/* Filters Panel */}
        {showFilters && (
          <View className="px-6 pb-4 bg-surface border border-border rounded-lg p-4 mx-6">
            {/* Type Filter */}
            <Text className="text-sm font-semibold text-foreground mb-2">Type</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {allTypes.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => {
                    const currentTypes = filters.types || [];
                    if (currentTypes.includes(type)) {
                      addFilter("types", currentTypes.filter((t) => t !== type));
                    } else {
                      addFilter("types", [...currentTypes, type]);
                    }
                  }}
                  className={`px-3 py-2 rounded-full border-2 ${
                    filters.types?.includes(type)
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface"
                  }`}
                >
                  <Text className="text-sm font-semibold text-foreground">
                    {ITEM_TYPE_ICONS[type]} {type}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Tag Filter */}
            <Text className="text-sm font-semibold text-foreground mb-2">Tags</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {allTags.slice(0, 8).map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => {
                    const currentTags = filters.tags || [];
                    if (currentTags.includes(tag)) {
                      addFilter("tags", currentTags.filter((t) => t !== tag));
                    } else {
                      addFilter("tags", [...currentTags, tag]);
                    }
                  }}
                  className={`px-3 py-2 rounded-full border-2 ${
                    filters.tags?.includes(tag)
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface"
                  }`}
                >
                  <Text className="text-sm font-semibold text-foreground">{tag}</Text>
                </Pressable>
              ))}
            </View>

            {/* Clear Filters */}
            {Object.keys(filters).length > 0 && (
              <Pressable
                onPress={clearFilters}
                className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 items-center"
              >
                <Text className="text-red-600 text-sm font-semibold">Clear All Filters</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Results */}
        <View className="px-6 pb-6">
          {query.trim() || Object.keys(filters).length > 0 ? (
            <>
              <Text className="text-lg font-semibold text-foreground mb-4">
                {results.length} Result{results.length !== 1 ? "s" : ""}
              </Text>
              {results.length === 0 ? (
                <View className="items-center justify-center py-8">
                  <Text className="text-4xl mb-3">🔍</Text>
                  <Text className="text-lg font-semibold text-foreground">No results found</Text>
                  <Text className="text-sm text-muted mt-1">Try different keywords or filters</Text>
                </View>
              ) : (
                results.map((item) => <ResultCard key={item.id} item={item} />)
              )}
            </>
          ) : (
            <View className="items-center justify-center py-12">
              <Text className="text-4xl mb-3">🔍</Text>
              <Text className="text-lg font-semibold text-foreground">Start searching</Text>
              <Text className="text-sm text-muted mt-1">Search across all your data</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
