import { ScrollView, Text, View, Pressable } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import * as Haptics from "expo-haptics";

interface ToolModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  items: string[];
}

const TOOL_MODULES: ToolModule[] = [
  {
    id: "productivity",
    title: "Productivity Center",
    description: "Tasks, goals, habits, and time tracking",
    icon: "⚡",
    items: ["Tasks", "Goals", "Habits", "Focus Timer", "Time Tracking", "Projects"],
  },
  {
    id: "business",
    title: "Business Center",
    description: "Income, expenses, clients, and opportunities",
    icon: "💼",
    items: ["Income Tracking", "Expenses", "Clients", "Opportunities", "Reports"],
  },
  {
    id: "knowledge",
    title: "Knowledge Vault",
    description: "Notes, documents, and organization",
    icon: "📚",
    items: ["Notes", "Documents", "Tags", "Search", "Organization", "Backup"],
  },
  {
    id: "communication",
    title: "Communication Center",
    description: "Contacts, email, and messages",
    icon: "💬",
    items: ["Contacts", "Email Drafts", "Messages", "Calendar", "Notifications"],
  },
  {
    id: "learning",
    title: "Learning Assistant",
    description: "Study plans, flashcards, and quizzes",
    icon: "🎓",
    items: ["Study Plans", "Flashcards", "Quizzes", "Progress", "Recommendations"],
  },
  {
    id: "research",
    title: "Research Agent",
    description: "Research, trends, and analysis",
    icon: "🔍",
    items: ["Research", "Trends", "Competitor Analysis", "Reports"],
  },
  {
    id: "code",
    title: "Code Development",
    description: "Website, app, and API assistants",
    icon: "💻",
    items: ["Website", "Mobile App", "API", "Code Explanation", "Documentation"],
  },
  {
    id: "automation",
    title: "Automation Center",
    description: "Workflows, triggers, and routines",
    icon: "🤖",
    items: ["Workflows", "Triggers", "Daily Routines", "Pipelines"],
  },
];

export default function ToolsScreen() {
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const handleModulePress = (moduleId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedModule(expandedModule === moduleId ? null : moduleId);
  };

  const ModuleCard = ({ module }: { module: ToolModule }) => {
    const isExpanded = expandedModule === module.id;

    return (
      <View className="mb-4">
        <Pressable
          onPress={() => handleModulePress(module.id)}
          style={({ pressed }) => [
            {
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          className="bg-surface rounded-2xl p-4 border border-border"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <Text className="text-3xl">{module.icon}</Text>
              <View className="flex-1">
                <Text className="text-lg font-bold text-foreground">
                  {module.title}
                </Text>
                <Text className="text-sm text-muted">
                  {module.description}
                </Text>
              </View>
            </View>
            <Text className={`text-2xl transition-transform ${isExpanded ? "rotate-180" : ""}`}>
              ▼
            </Text>
          </View>
        </Pressable>

        {/* Expanded Items */}
        {isExpanded && (
          <View className="bg-surface/50 rounded-b-2xl border border-t-0 border-border px-4 py-3 gap-2">
            {module.items.map((item, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="py-2 px-3 rounded-lg bg-background/50 flex-row items-center justify-between"
              >
                <Text className="text-foreground font-medium">{item}</Text>
                <Text className="text-muted">→</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="px-6 pt-6 pb-8 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">
              Tools & Modules
            </Text>
            <Text className="text-base text-muted">
              Access all your productivity and business tools
            </Text>
          </View>

          {/* Search Bar */}
          <View className="bg-surface rounded-full px-4 py-3 border border-border flex-row items-center gap-2">
            <Text className="text-lg">🔍</Text>
            <Text className="text-muted flex-1">Search tools...</Text>
          </View>

          {/* Modules List */}
          <View className="gap-2">
            {TOOL_MODULES.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </View>

          {/* Multi-Agent Team Section */}
          <View className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-6 border border-primary/20 gap-3 mt-4">
            <View className="flex-row items-center gap-2">
              <Text className="text-2xl">🤖</Text>
              <Text className="text-lg font-bold text-foreground">
                Multi-Agent AI Team
              </Text>
            </View>
            <Text className="text-sm text-muted">
              Collaborate with specialized AI agents: Writer, Researcher, Developer, SEO, Designer, Learning, and Business experts.
            </Text>
            <Pressable
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              className="bg-primary rounded-lg p-3 items-center mt-2"
            >
              <Text className="text-primaryForeground font-semibold">
                Launch Agent Team
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
