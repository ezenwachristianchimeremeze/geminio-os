import { ScrollView, Text, View, Pressable, TextInput } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

interface ResearchResult {
  id: string;
  title: string;
  description: string;
  type: 'research' | 'trend' | 'competitor';
  date: number;
}

export default function ResearchScreen() {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [researchResults, setResearchResults] = useState<ResearchResult[]>([
    {
      id: '1',
      title: 'AI Market Trends 2026',
      description: 'Latest developments in artificial intelligence and machine learning',
      type: 'trend',
      date: Date.now() - 86400000,
    },
    {
      id: '2',
      title: 'Competitor Analysis: ChatGPT vs Claude',
      description: 'Detailed comparison of leading AI assistants',
      type: 'competitor',
      date: Date.now() - 172800000,
    },
  ]);
  const [activeTab, setActiveTab] = useState<'research' | 'trends' | 'competitors'>('research');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    const newResult: ResearchResult = {
      id: Date.now().toString(),
      title: `Research: ${searchQuery}`,
      description: 'Searching for relevant information...',
      type: 'research',
      date: Date.now(),
    };

    setResearchResults([newResult, ...researchResults]);
    setSearchQuery("");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const filteredResults = researchResults.filter((result) => {
    if (activeTab === 'research') return result.type === 'research';
    if (activeTab === 'trends') return result.type === 'trend';
    if (activeTab === 'competitors') return result.type === 'competitor';
    return true;
  });

  const ResultCard = ({ result }: { result: ResearchResult }) => (
    <Pressable
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold text-foreground flex-1">
            {result.title}
          </Text>
          <View className={`px-3 py-1 rounded-full ${
            result.type === 'research' ? 'bg-primary/10' :
            result.type === 'trend' ? 'bg-accent/10' :
            'bg-warning/10'
          }`}>
            <Text className={`text-xs font-semibold ${
              result.type === 'research' ? 'text-primary' :
              result.type === 'trend' ? 'text-accent' :
              'text-warning'
            }`}>
              {result.type}
            </Text>
          </View>
        </View>
        <Text className="text-sm text-muted">
          {result.description}
        </Text>
        <View className="flex-row items-center justify-between pt-2 border-t border-border">
          <Text className="text-xs text-muted">
            {new Date(result.date).toLocaleDateString()}
          </Text>
          <Pressable className="p-2">
            <Text className="text-lg">📄</Text>
          </Pressable>
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
              Research Agent
            </Text>
            <Text className="text-base text-muted">
              Discover insights and trends
            </Text>
          </View>

          {/* Search Bar */}
          <View className="flex-row gap-2">
            <View className="flex-1 bg-surface rounded-full px-4 py-3 border border-border flex-row items-center gap-2">
              <Text className="text-lg">🔍</Text>
              <TextInput
                placeholder="Search topics..."
                placeholderTextColor={colors.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="flex-1 text-foreground"
              />
            </View>
            <Pressable
              onPress={handleSearch}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
              className="bg-primary rounded-full p-3 items-center justify-center"
            >
              <Text className="text-xl">→</Text>
            </Pressable>
          </View>

          {/* Tab Navigation */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setActiveTab('research')}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                activeTab === 'research'
                  ? 'bg-primary border-primary'
                  : 'border-border bg-surface'
              }`}
            >
              <Text
                className={`text-center font-semibold text-sm ${
                  activeTab === 'research'
                    ? 'text-white'
                    : 'text-foreground'
                }`}
              >
                Research
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('trends')}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                activeTab === 'trends'
                  ? 'bg-primary border-primary'
                  : 'border-border bg-surface'
              }`}
            >
              <Text
                className={`text-center font-semibold text-sm ${
                  activeTab === 'trends'
                    ? 'text-white'
                    : 'text-foreground'
                }`}
              >
                Trends
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('competitors')}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                activeTab === 'competitors'
                  ? 'bg-primary border-primary'
                  : 'border-border bg-surface'
              }`}
            >
              <Text
                className={`text-center font-semibold text-sm ${
                  activeTab === 'competitors'
                    ? 'text-white'
                    : 'text-foreground'
                }`}
              >
                Competitors
              </Text>
            </Pressable>
          </View>

          {/* Results */}
          <View className="gap-2">
            <Text className="text-lg font-bold text-foreground">
              {filteredResults.length} Results
            </Text>
            {filteredResults.length > 0 ? (
              filteredResults.map((result) => (
                <ResultCard key={result.id} result={result} />
              ))
            ) : (
              <View className="bg-surface rounded-2xl p-6 border border-border items-center">
                <Text className="text-muted text-center">
                  No results yet. Start researching!
                </Text>
              </View>
            )}
          </View>

          {/* Quick Actions */}
          <View className="gap-3 mt-4">
            <Text className="text-lg font-bold text-foreground">
              Quick Actions
            </Text>
            <Pressable
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="bg-surface rounded-2xl p-4 border border-border flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">📊</Text>
                <View>
                  <Text className="font-semibold text-foreground">
                    Generate Report
                  </Text>
                  <Text className="text-xs text-muted">
                    Create research summary
                  </Text>
                </View>
              </View>
              <Text className="text-lg">→</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
