import { ScrollView, Text, View, Pressable, Image } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: string;
  features: string[];
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: "Welcome to Geminio OS",
    description: "Your personal AI operating system for productivity and growth",
    icon: "🤖",
    features: ["AI-powered assistance", "Smart automation", "Cross-platform sync"],
  },
  {
    id: 2,
    title: "AI Chat & Memory",
    description: "Chat with AI and build a persistent memory of your conversations",
    icon: "💬",
    features: ["Real-time AI responses", "Conversation history", "Memory storage"],
  },
  {
    id: 3,
    title: "Productivity Tools",
    description: "Manage tasks, goals, and projects with AI assistance",
    icon: "📊",
    features: ["Task management", "Goal tracking", "Progress analytics"],
  },
  {
    id: 4,
    title: "Content Creation",
    description: "Generate content with AI across multiple formats",
    icon: "✨",
    features: ["Blog posts", "Social media", "Presentations"],
  },
  {
    id: 5,
    title: "Multi-Agent System",
    description: "Work with 6 specialized AI agents for different tasks",
    icon: "👥",
    features: ["Writer", "Researcher", "Developer", "SEO", "Designer", "Learning"],
  },
  {
    id: 6,
    title: "Advanced Features",
    description: "Analytics, automation, wallet tracking, and knowledge graphs",
    icon: "⚡",
    features: ["Analytics dashboard", "Automation center", "Financial tracking"],
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)" as any);
    }
  };

  const handlePrevious = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/(tabs)" as any);
  };

  const step = ONBOARDING_STEPS[currentStep];
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <ScreenContainer className="p-0 flex-1 bg-background">
      <ScrollView className="flex-1">
        {/* Progress Bar */}
        <View className="h-1 bg-border">
          <View
            className="h-full bg-primary"
            style={{ width: `${progress}%` }}
          />
        </View>

        {/* Content */}
        <View className="flex-1 px-6 py-12 items-center justify-center">
          {/* Icon */}
          <Text className="text-7xl mb-8">{step.icon}</Text>

          {/* Title */}
          <Text className="text-3xl font-bold text-foreground text-center mb-4">
            {step.title}
          </Text>

          {/* Description */}
          <Text className="text-lg text-muted text-center mb-8 leading-relaxed">
            {step.description}
          </Text>

          {/* Features List */}
          <View className="w-full bg-surface border border-border rounded-lg p-6 mb-8">
            {step.features.map((feature, idx) => (
              <View key={idx} className="flex-row items-center gap-3 mb-3">
                <View className="w-2 h-2 rounded-full bg-primary" />
                <Text className="text-foreground flex-1">{feature}</Text>
              </View>
            ))}
          </View>

          {/* Step Indicator */}
          <View className="flex-row gap-2 mb-8">
            {ONBOARDING_STEPS.map((_, idx) => (
              <View
                key={idx}
                className={`h-2 rounded-full ${
                  idx === currentStep ? "bg-primary w-8" : "bg-border w-2"
                }`}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View className="px-6 pb-6 gap-3">
        {/* Skip Button */}
        <Pressable
          onPress={handleSkip}
          className="border border-border rounded-lg p-3 items-center"
        >
          <Text className="text-foreground font-semibold">Skip Tutorial</Text>
        </Pressable>

        {/* Navigation Buttons */}
        <View className="flex-row gap-3">
          {currentStep > 0 && (
            <Pressable
              onPress={handlePrevious}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
              className="flex-1 bg-surface border border-border rounded-lg p-3 items-center"
            >
              <Text className="text-foreground font-semibold">← Back</Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
            className={`${currentStep > 0 ? "flex-1" : "flex-1"} bg-primary rounded-lg p-3 items-center`}
          >
            <Text className="text-primaryForeground font-semibold">
              {currentStep === ONBOARDING_STEPS.length - 1 ? "Get Started →" : "Next →"}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}
