import { ScrollView, Text, View, Pressable, ActivityIndicator, Modal } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useMemory } from "@/lib/memory-context";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

interface Opportunity {
  id: string;
  title: string;
  description: string;
  category: string;
  potential: "high" | "medium" | "low";
  timeline: string;
  requiredSkills: string[];
  discoveredAt: Date;
}

const OPPORTUNITY_CATEGORIES = [
  { name: "Career", icon: "💼", color: "bg-blue-500" },
  { name: "Business", icon: "🚀", color: "bg-orange-500" },
  { name: "Learning", icon: "📚", color: "bg-purple-500" },
  { name: "Investment", icon: "💰", color: "bg-green-500" },
  { name: "Networking", icon: "🤝", color: "bg-pink-500" },
];

export default function OpportunityFinderScreen() {
  const colors = useColors();
  const { addMemory } = useMemory();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([
    {
      id: "1",
      title: "AI/ML Engineer Role",
      description: "Senior position at growing tech startup",
      category: "Career",
      potential: "high",
      timeline: "Immediate",
      requiredSkills: ["Python", "Machine Learning", "React"],
      discoveredAt: new Date(Date.now() - 86400000 * 2),
    },
    {
      id: "2",
      title: "Freelance Project",
      description: "Build mobile app for e-commerce client",
      category: "Business",
      potential: "medium",
      timeline: "2-3 months",
      requiredSkills: ["React Native", "Backend API", "UI/UX"],
      discoveredAt: new Date(Date.now() - 86400000),
    },
  ]);

  const [isScanning, setIsScanning] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);

  const scanForOpportunities = async () => {
    setIsScanning(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await trpc.chat.sendMessage.useMutation().mutateAsync({
        message: "Find 3 high-potential opportunities for me based on my skills and interests",
        conversationHistory: [],
      });

      if (response.success) {
        const responseText = typeof response.response === "string" ? response.response : "Opportunities found";
        
        // Simulate finding opportunities
        const newOpportunity: Opportunity = {
          id: Date.now().toString(),
          title: "Emerging Opportunity",
          description: responseText.substring(0, 100),
          category: OPPORTUNITY_CATEGORIES[Math.floor(Math.random() * OPPORTUNITY_CATEGORIES.length)].name,
          potential: ["high", "medium", "low"][Math.floor(Math.random() * 3)] as "high" | "medium" | "low",
          timeline: "1-4 weeks",
          requiredSkills: ["Skill 1", "Skill 2", "Skill 3"],
          discoveredAt: new Date(),
        };

        setOpportunities((prev) => [newOpportunity, ...prev]);
        await addMemory({
          type: "conversation",
          content: `Found opportunity: ${newOpportunity.title}`,
          tags: ["opportunity-finder", newOpportunity.category],
        });

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Opportunity scan error:", error);
    } finally {
      setIsScanning(false);
    }
  };

  const getPotentialColor = (potential: string) => {
    switch (potential) {
      case "high":
        return "bg-green-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const OpportunityCard = ({ opportunity }: { opportunity: Opportunity }) => (
    <Pressable
      onPress={() => {
        setSelectedOpportunity(opportunity);
        setShowModal(true);
      }}
      className="bg-surface border border-border rounded-lg p-4 mb-3"
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="font-semibold text-foreground">{opportunity.title}</Text>
          <Text className="text-sm text-muted mt-1">{opportunity.description}</Text>
        </View>
        <View
          className={`px-2 py-1 rounded-full ${getPotentialColor(opportunity.potential)}`}
        >
          <Text className="text-white text-xs font-semibold">
            {opportunity.potential.charAt(0).toUpperCase() + opportunity.potential.slice(1)}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2 mt-3">
        <Text className="text-2xl">
          {OPPORTUNITY_CATEGORIES.find((c) => c.name === opportunity.category)?.icon}
        </Text>
        <Text className="text-sm text-muted">{opportunity.category}</Text>
        <Text className="text-sm text-muted">•</Text>
        <Text className="text-sm text-muted">{opportunity.timeline}</Text>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="p-0 flex-1">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-6 pb-4 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">Opportunity Finder</Text>
          <Text className="text-sm text-muted mt-1">AI-powered opportunity detection</Text>
        </View>

        {/* Scan Section */}
        <View className="px-6 pt-6 pb-6 items-center">
          <View className="w-24 h-24 rounded-full bg-primary/10 items-center justify-center mb-4 border-4 border-primary">
            {isScanning ? (
              <ActivityIndicator color={colors.primary} size="large" />
            ) : (
              <Text className="text-4xl">🔍</Text>
            )}
          </View>

          <Pressable
            onPress={scanForOpportunities}
            disabled={isScanning}
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
            className="bg-primary rounded-lg px-8 py-4 items-center justify-center"
          >
            <Text className="text-white font-semibold">
              {isScanning ? "Scanning..." : "Scan for Opportunities"}
            </Text>
          </Pressable>

          <Text className="text-sm text-muted mt-4 text-center">
            AI will analyze your profile and find matching opportunities
          </Text>
        </View>

        {/* Opportunities List */}
        <View className="px-6 pb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">
            {opportunities.length} Opportunities Found
          </Text>
          {opportunities.length === 0 ? (
            <View className="items-center justify-center py-8">
              <Text className="text-4xl mb-3">🎯</Text>
              <Text className="text-lg font-semibold text-foreground">No opportunities yet</Text>
              <Text className="text-sm text-muted mt-1">Tap scan to find opportunities</Text>
            </View>
          ) : (
            opportunities.map((opp) => <OpportunityCard key={opp.id} opportunity={opp} />)
          )}
        </View>
      </ScrollView>

      {/* Opportunity Detail Modal */}
      <Modal visible={showModal && !!selectedOpportunity} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6 max-h-[85%]">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-1">
                <Text className="text-2xl font-bold text-foreground">{selectedOpportunity?.title}</Text>
                <View className="flex-row items-center gap-2 mt-2">
                  <Text className="text-2xl">
                    {OPPORTUNITY_CATEGORIES.find((c) => c.name === selectedOpportunity?.category)?.icon}
                  </Text>
                  <Text className="text-sm text-muted">{selectedOpportunity?.category}</Text>
                </View>
              </View>
              <Pressable onPress={() => setShowModal(false)}>
                <Text className="text-2xl text-muted">✕</Text>
              </Pressable>
            </View>

            <ScrollView className="flex-1 mb-4 border-t border-border pt-4">
              <Text className="text-foreground leading-relaxed mb-4">{selectedOpportunity?.description}</Text>

              <View className="mb-4">
                <Text className="text-sm font-semibold text-foreground mb-2">Potential</Text>
                <View
                  className={`px-3 py-2 rounded-lg items-center ${getPotentialColor(selectedOpportunity?.potential || "")}`}
                >
                  <Text className="text-white font-semibold">
                    {selectedOpportunity?.potential ? selectedOpportunity.potential.charAt(0).toUpperCase() + selectedOpportunity.potential.slice(1) : "Unknown"} Potential
                  </Text>
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-semibold text-foreground mb-2">Timeline</Text>
                <Text className="text-foreground">{selectedOpportunity?.timeline}</Text>
              </View>

              {selectedOpportunity?.requiredSkills && selectedOpportunity.requiredSkills.length > 0 && (
                <View className="mb-4">
                  <Text className="text-sm font-semibold text-foreground mb-2">Required Skills</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {selectedOpportunity.requiredSkills.map((skill, idx) => (
                      <View key={idx} className="bg-primary/10 px-3 py-1 rounded-full">
                        <Text className="text-sm text-primary" key={idx}>{skill}</Text>
                      </View>
                    ))}
                  </View>
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
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
                className="flex-1 bg-primary rounded-lg p-3 items-center"
              >
                <Text className="text-white font-semibold">Explore</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
