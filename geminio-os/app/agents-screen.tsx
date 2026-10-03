import { ScrollView, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import * as Haptics from "expo-haptics";

interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: string;
  specialty: string[];
}

const AGENTS: Agent[] = [
  {
    id: 'writer',
    name: 'Writer Agent',
    role: 'Content Creator',
    description: 'Specializes in creating engaging written content',
    icon: '✍️',
    specialty: ['Articles', 'Blog Posts', 'Social Media', 'Email Copy'],
  },
  {
    id: 'researcher',
    name: 'Researcher Agent',
    role: 'Data Analyst',
    description: 'Gathers and analyzes information from multiple sources',
    icon: '🔍',
    specialty: ['Research', 'Trends', 'Competitor Analysis', 'Reports'],
  },
  {
    id: 'developer',
    name: 'Developer Agent',
    role: 'Code Expert',
    description: 'Helps with coding and technical implementation',
    icon: '💻',
    specialty: ['Code Generation', 'Debugging', 'Architecture', 'Documentation'],
  },
  {
    id: 'seo',
    name: 'SEO Agent',
    role: 'Marketing Specialist',
    description: 'Optimizes content for search engines',
    icon: '📈',
    specialty: ['SEO Optimization', 'Keywords', 'Meta Tags', 'Analytics'],
  },
  {
    id: 'designer',
    name: 'Designer Agent',
    role: 'Visual Creator',
    description: 'Creates visual content and design recommendations',
    icon: '🎨',
    specialty: ['UI/UX', 'Graphics', 'Layouts', 'Brand Guidelines'],
  },
  {
    id: 'learning',
    name: 'Learning Agent',
    role: 'Education Expert',
    description: 'Creates personalized learning plans and materials',
    icon: '🎓',
    specialty: ['Study Plans', 'Quizzes', 'Explanations', 'Progress Tracking'],
  },
];

export default function AgentsScreen() {
  const handleAgentPress = (agent: Agent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/multi-agent-system", params: { agent: agent.id } });
  };

  const AgentCard = ({ agent }: { agent: Agent }) => (
    <Pressable
      onPress={() => handleAgentPress(agent)}
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-row items-center gap-3 flex-1">
            <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
              <Text className="text-2xl">{agent.icon}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-foreground">
                {agent.name}
              </Text>
              <Text className="text-sm text-primary font-semibold">
                {agent.role}
              </Text>
            </View>
          </View>
          <Text className="text-lg">→</Text>
        </View>

        <Text className="text-sm text-muted">
          {agent.description}
        </Text>

        <View className="flex-row flex-wrap gap-2">
          {agent.specialty.slice(0, 3).map((spec, index) => (
            <View
              key={index}
              className="bg-primary/10 rounded-full px-2 py-1"
            >
              <Text className="text-xs font-semibold text-primary">
                {spec}
              </Text>
            </View>
          ))}
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
              AI Agent Team
            </Text>
            <Text className="text-base text-muted">
              Collaborate with specialized AI experts
            </Text>
          </View>

          {/* Team Overview */}
          <View className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-4 border border-primary/20 gap-2">
            <Text className="text-sm font-semibold text-primary">
              Your AI Team
            </Text>
            <Text className="text-2xl font-bold text-foreground">
              {AGENTS.length} Expert Agents
            </Text>
            <Text className="text-sm text-muted">
              Ready to assist with any task
            </Text>
          </View>

          {/* Agents List */}
          <View className="gap-3">
            <Text className="text-lg font-bold text-foreground">
              Available Agents
            </Text>
            {AGENTS.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </View>

          {/* Launch Team */}
          <Pressable
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
            className="bg-primary rounded-2xl p-4 items-center mt-4"
          >
            <Text className="text-white font-semibold text-lg">
              🚀 Launch Agent Team
            </Text>
          </Pressable>

          {/* Team Collaboration Info */}
          <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
            <Text className="text-lg font-bold text-foreground">
              How It Works
            </Text>
            <View className="gap-2">
              <View className="flex-row gap-3">
                <Text className="text-lg">1️⃣</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">
                    Describe Your Task
                  </Text>
                  <Text className="text-sm text-muted mt-1">
                    Tell the team what you need
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-3">
                <Text className="text-lg">2️⃣</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">
                    Agents Collaborate
                  </Text>
                  <Text className="text-sm text-muted mt-1">
                    Experts work together on your project
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-3">
                <Text className="text-lg">3️⃣</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">
                    Get Results
                  </Text>
                  <Text className="text-sm text-muted mt-1">
                    Receive comprehensive output
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
