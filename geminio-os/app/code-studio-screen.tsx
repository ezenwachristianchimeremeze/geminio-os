import { ScrollView, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import * as Haptics from "expo-haptics";

interface CodeTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  language: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

const CODE_TEMPLATES: CodeTemplate[] = [
  {
    id: 'website',
    title: 'Website Builder',
    description: 'Create responsive websites with HTML, CSS, and JavaScript',
    icon: '🌐',
    language: 'HTML/CSS/JS',
    difficulty: 'beginner',
  },
  {
    id: 'mobile',
    title: 'Mobile App',
    description: 'Build native mobile apps with React Native',
    icon: '📱',
    language: 'React Native',
    difficulty: 'intermediate',
  },
  {
    id: 'api',
    title: 'API Development',
    description: 'Create RESTful APIs with Node.js and Express',
    icon: '🔌',
    language: 'Node.js',
    difficulty: 'intermediate',
  },
  {
    id: 'database',
    title: 'Database Design',
    description: 'Design and manage databases with SQL',
    icon: '🗄️',
    language: 'SQL',
    difficulty: 'intermediate',
  },
  {
    id: 'python',
    title: 'Python Scripts',
    description: 'Write automation and data processing scripts',
    icon: '🐍',
    language: 'Python',
    difficulty: 'beginner',
  },
  {
    id: 'ml',
    title: 'Machine Learning',
    description: 'Build ML models with TensorFlow and PyTorch',
    icon: '🤖',
    language: 'Python',
    difficulty: 'advanced',
  },
];

export default function CodeStudioScreen() {
  const handleTemplatePress = (template: CodeTemplate) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/live-build-studio", params: { template: template.id } });
  };

  const TemplateCard = ({ template }: { template: CodeTemplate }) => (
    <Pressable
      onPress={() => handleTemplatePress(template)}
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
              <Text className="text-2xl">{template.icon}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-foreground">
                {template.title}
              </Text>
              <Text className="text-xs text-primary font-semibold mt-1">
                {template.language}
              </Text>
            </View>
          </View>
          <View
            className={`px-2 py-1 rounded-full ${
              template.difficulty === 'beginner'
                ? 'bg-success/20'
                : template.difficulty === 'intermediate'
                  ? 'bg-warning/20'
                  : 'bg-error/20'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                template.difficulty === 'beginner'
                  ? 'text-successText'
                  : template.difficulty === 'intermediate'
                    ? 'text-warningText'
                    : 'text-errorText'
              }`}
            >
              {template.difficulty}
            </Text>
          </View>
        </View>

        <Text className="text-sm text-muted">
          {template.description}
        </Text>

        <View className="flex-row items-center justify-between pt-2 border-t border-border">
          <Text className="text-sm font-semibold text-primary">
            Start Building →
          </Text>
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
              Code Studio
            </Text>
            <Text className="text-base text-muted">
              Build with AI assistance
            </Text>
          </View>

          {/* Quick Start */}
          <View className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-4 border border-primary/20 gap-2">
            <Text className="text-sm font-semibold text-primary">
              AI Code Assistant
            </Text>
            <Text className="text-lg font-bold text-foreground">
              Get Code Help
            </Text>
            <Text className="text-sm text-muted">
              Explain code, generate snippets, and debug issues
            </Text>
          </View>

          {/* Templates */}
          <View className="gap-3">
            <Text className="text-lg font-bold text-foreground">
              Project Templates
            </Text>
            {CODE_TEMPLATES.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </View>

          {/* Code Tools */}
          <View className="gap-3 mt-4">
            <Text className="text-lg font-bold text-foreground">
              Code Tools
            </Text>
            <Pressable
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="bg-surface rounded-2xl p-4 border border-border flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3 flex-1">
                <Text className="text-2xl">📝</Text>
                <View>
                  <Text className="font-semibold text-foreground">
                    Code Explanation
                  </Text>
                  <Text className="text-xs text-muted mt-1">
                    Understand any code snippet
                  </Text>
                </View>
              </View>
              <Text className="text-lg">→</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="bg-surface rounded-2xl p-4 border border-border flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3 flex-1">
                <Text className="text-2xl">🐛</Text>
                <View>
                  <Text className="font-semibold text-foreground">
                    Debug Assistant
                  </Text>
                  <Text className="text-xs text-muted mt-1">
                    Fix errors and optimize code
                  </Text>
                </View>
              </View>
              <Text className="text-lg">→</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="bg-surface rounded-2xl p-4 border border-border flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3 flex-1">
                <Text className="text-2xl">📚</Text>
                <View>
                  <Text className="font-semibold text-foreground">
                    Documentation
                  </Text>
                  <Text className="text-xs text-muted mt-1">
                    Generate API docs and comments
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
