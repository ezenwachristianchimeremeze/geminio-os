import { ScrollView, Text, View, Pressable } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import * as Haptics from "expo-haptics";

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface StudyPlan {
  id: string;
  title: string;
  subject: string;
  progress: number;
  daysLeft: number;
}

export default function LearningScreen() {
  const [activeTab, setActiveTab] = useState<'plans' | 'flashcards' | 'quizzes'>('plans');
  const [flippedCard, setFlippedCard] = useState<string | null>(null);

  const studyPlans: StudyPlan[] = [
    {
      id: '1',
      title: 'React Native Mastery',
      subject: 'Mobile Development',
      progress: 65,
      daysLeft: 14,
    },
    {
      id: '2',
      title: 'Python Advanced',
      subject: 'Programming',
      progress: 45,
      daysLeft: 21,
    },
  ];

  const flashcards: Flashcard[] = [
    {
      id: '1',
      question: 'What is React Native?',
      answer: 'A framework for building native mobile apps using React and JavaScript',
      category: 'React Native',
    },
    {
      id: '2',
      question: 'What is a hook in React?',
      answer: 'A special function that lets you hook into React features',
      category: 'React',
    },
    {
      id: '3',
      question: 'Explain useState',
      answer: 'A hook that lets you add state to functional components',
      category: 'React',
    },
  ];

  const StudyPlanCard = ({ plan }: { plan: StudyPlan }) => (
    <Pressable
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">
              {plan.title}
            </Text>
            <Text className="text-sm text-muted mt-1">
              {plan.subject}
            </Text>
          </View>
          <View className="bg-primary/10 rounded-full px-3 py-1">
            <Text className="text-sm font-bold text-primary">
              {plan.daysLeft}d
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View className="h-2 bg-border rounded-full overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${plan.progress}%` }}
          />
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-foreground">
            {plan.progress}% Complete
          </Text>
          <Pressable className="p-2">
            <Text className="text-lg">→</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  const FlashcardComponent = ({ card }: { card: Flashcard }) => {
    const isFlipped = flippedCard === card.id;

    return (
      <Pressable
        onPress={() => {
          setFlippedCard(isFlipped ? null : card.id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        style={({ pressed }) => [
          {
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        className="bg-primary rounded-2xl p-6 mb-4 min-h-40 items-center justify-center border border-primary/20"
      >
        <View className="items-center gap-2">
          <Text className="text-primaryForeground text-sm font-semibold">
            {isFlipped ? 'Answer' : 'Question'}
          </Text>
          <Text className="text-primaryForeground text-center text-lg font-bold">
            {isFlipped ? card.answer : card.question}
          </Text>
          <Text className="text-primaryForeground text-xs mt-4">
            Tap to flip
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="px-6 pt-6 pb-8 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">
              Learning Assistant
            </Text>
            <Text className="text-base text-muted">
              Study smarter with AI
            </Text>
          </View>

          {/* Tab Navigation */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setActiveTab('plans')}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                activeTab === 'plans'
                  ? 'bg-primary border-primary'
                  : 'border-border bg-surface'
              }`}
            >
              <Text
                className={`text-center font-semibold text-sm ${
                  activeTab === 'plans'
                    ? 'text-primaryForeground'
                    : 'text-foreground'
                }`}
              >
                Plans
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('flashcards')}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                activeTab === 'flashcards'
                  ? 'bg-primary border-primary'
                  : 'border-border bg-surface'
              }`}
            >
              <Text
                className={`text-center font-semibold text-sm ${
                  activeTab === 'flashcards'
                    ? 'text-primaryForeground'
                    : 'text-foreground'
                }`}
              >
                Flashcards
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('quizzes')}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                activeTab === 'quizzes'
                  ? 'bg-primary border-primary'
                  : 'border-border bg-surface'
              }`}
            >
              <Text
                className={`text-center font-semibold text-sm ${
                  activeTab === 'quizzes'
                    ? 'text-primaryForeground'
                    : 'text-foreground'
                }`}
              >
                Quizzes
              </Text>
            </Pressable>
          </View>

          {/* Content */}
          {activeTab === 'plans' && (
            <View className="gap-3">
              <Text className="text-lg font-bold text-foreground">
                Study Plans
              </Text>
              {studyPlans.map((plan) => (
                <StudyPlanCard key={plan.id} plan={plan} />
              ))}
            </View>
          )}

          {activeTab === 'flashcards' && (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-bold text-foreground">
                  Flashcards
                </Text>
                <Text className="text-sm text-muted">
                  {flashcards.length} cards
                </Text>
              </View>
              {flashcards.map((card) => (
                <FlashcardComponent key={card.id} card={card} />
              ))}
            </View>
          )}

          {activeTab === 'quizzes' && (
            <View className="bg-surface rounded-2xl p-6 border border-border items-center gap-4">
              <Text className="text-2xl">📝</Text>
              <Text className="text-lg font-bold text-foreground text-center">
                Quiz Generator
              </Text>
              <Text className="text-sm text-muted text-center">
                Create custom quizzes from your study materials
              </Text>
              <Pressable
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
                className="bg-primary rounded-lg px-6 py-3 mt-2"
              >
                <Text className="text-primaryForeground font-semibold">
                  Create Quiz
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
