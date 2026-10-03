import { ScrollView, Text, View, Pressable, TextInput, FlatList, ActivityIndicator, Modal } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useMemory } from "@/lib/memory-context";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

interface ResearchResult {
  id: string;
  query: string;
  type: "web_search" | "competitor" | "trend" | "report";
  findings: string;
  sources: string[];
  createdAt: Date;
}

const RESEARCH_TYPES = [
  { id: "web_search", name: "Web Search", icon: "🔍", description: "Search the web for information" },
  { id: "competitor", name: "Competitor Analysis", icon: "🎯", description: "Analyze competitors" },
  { id: "trend", name: "Trend Tracking", icon: "📈", description: "Track market trends" },
  { id: "report", name: "Report Generation", icon: "📊", description: "Generate research reports" },
];

export default function ResearchAgentScreen() {
  const colors = useColors();
  const { addMemory } = useMemory();
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [selectedType, setSelectedType] = useState<ResearchResult["type"] | null>(null);
  const [query, setQuery] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ResearchResult | null>(null);

  const performResearch = async () => {
    if (!selectedType || !query.trim()) return;

    setIsResearching(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await trpc.chat.sendMessage.useMutation().mutateAsync({
        message: `Perform ${selectedType} research on: ${query}. Provide detailed findings and cite sources.`,
        conversationHistory: [],
      });

      if (response.success) {
        const findings = typeof response.response === "string" ? response.response : "Research completed";
        
        const result: ResearchResult = {
          id: Date.now().toString(),
          query,
          type: selectedType,
          findings,
          sources: ["AI Research Engine", "Web Data", "Market Intelligence"],
          createdAt: new Date(),
        };

        setResults((prev) => [result, ...prev]);

        // Store in memory
        await addMemory({
          type: "conversation",
          content: `Research: ${query}`,
          tags: ["research", selectedType],
        });

        setQuery("");
        setSelectedResult(result);
        setShowModal(true);
      }
    } catch (error) {
      console.error("Research error:", error);
    } finally {
      setIsResearching(false);
    }
  };

  const ResultCard = ({ result }: { result: ResearchResult }) => (
    <Pressable
      onPress={() => {
        setSelectedResult(result);
        setShowModal(true);
      }}
      className="bg-surface border border-border rounded-lg p-4 mb-3"
    >
      <View className="flex-row items-start gap-3">
        <Text className="text-2xl">
          {RESEARCH_TYPES.find((t) => t.id === result.type)?.icon}
        </Text>
        <View className="flex-1">
          <Text className="font-semibold text-foreground">{result.query}</Text>
          <Text className="text-xs text-muted mt-1">
            {result.type.replace("_", " ").toUpperCase()} • {result.createdAt.toLocaleDateString()}
          </Text>
          <Text className="text-sm text-foreground mt-2 line-clamp-2">{result.findings}</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="p-0 flex-1">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-6 pb-4 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">Research Agent</Text>
          <Text className="text-sm text-muted mt-1">AI-powered research and analysis</Text>
        </View>

        {/* Research Types */}
        <View className="px-6 pt-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Research Type</Text>
          <View className="gap-3">
            {RESEARCH_TYPES.map((type) => (
              <Pressable
                key={type.id}
                onPress={() => setSelectedType(type.id as ResearchResult["type"])}
                className={`flex-row items-center p-4 rounded-lg border-2 ${
                  selectedType === type.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface"
                }`}
              >
                <Text className="text-2xl mr-3">{type.icon}</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">{type.name}</Text>
                  <Text className="text-xs text-muted mt-1">{type.description}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Query Input */}
        {selectedType && (
          <View className="px-6 pt-6 pb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">What would you like to research?</Text>
            <TextInput
              placeholder="Enter your research query..."
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              multiline
              numberOfLines={3}
              editable={!isResearching}
              className="w-full bg-surface border border-border rounded-lg p-4 text-foreground mb-4"
            />
            <Pressable
              onPress={performResearch}
              disabled={!query.trim() || isResearching}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
              className="bg-primary rounded-lg p-4 items-center justify-center"
            >
              {isResearching ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold">Start Research</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Research Results */}
        {results.length > 0 && (
          <View className="px-6 pb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">Research History</Text>
            {results.map((result) => (
              <ResultCard key={result.id} result={result} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Result Detail Modal */}
      <Modal visible={showModal && !!selectedResult} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6 max-h-[85%]">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-2">
                  <Text className="text-2xl">
                    {RESEARCH_TYPES.find((t) => t.id === selectedResult?.type)?.icon}
                  </Text>
                  <Text className="text-sm text-muted">
                    {selectedResult?.type.replace("_", " ").toUpperCase()}
                  </Text>
                </View>
                <Text className="text-lg font-bold text-foreground">{selectedResult?.query}</Text>
              </View>
              <Pressable onPress={() => setShowModal(false)}>
                <Text className="text-2xl text-muted">✕</Text>
              </Pressable>
            </View>

            <ScrollView className="flex-1 mb-4 border-t border-border pt-4">
              <Text className="text-foreground leading-relaxed mb-4">{selectedResult?.findings}</Text>
              
              {selectedResult?.sources && selectedResult.sources.length > 0 && (
                <View className="mt-4 pt-4 border-t border-border">
                  <Text className="text-sm font-semibold text-foreground mb-2">Sources</Text>
                  {selectedResult.sources.map((source, idx) => (
                    <Text key={idx} className="text-sm text-muted mb-1">
                      • {source}
                    </Text>
                  ))}
                </View>
              )}
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
                  setQuery("");
                }}
                className="flex-1 bg-primary rounded-lg p-3 items-center"
              >
                <Text className="text-white font-semibold">New Research</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
