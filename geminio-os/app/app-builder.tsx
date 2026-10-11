import React, { useState, useCallback, useEffect } from 'react';
import { ScrollView, Text, View, Pressable, TextInput, FlatList, Modal, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import { trpc } from '@/lib/trpc';

interface UIComponent {
  id: string;
  name: string;
  type: 'button' | 'input' | 'text' | 'image' | 'card' | 'list' | 'modal' | 'form';
  icon: string;
  category: 'basic' | 'layout' | 'input' | 'display';
}

interface AppDesign {
  id: string;
  name: string;
  description: string;
  screens: Screen[];
  components: UIComponent[];
  theme: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
  };
}

interface Screen {
  id: string;
  name: string;
  components: UIComponent[];
  layout: 'vertical' | 'horizontal' | 'grid';
}

const COMPONENT_LIBRARY: UIComponent[] = [
  { id: 'btn', name: 'Button', type: 'button', icon: '🔘', category: 'basic' },
  { id: 'txt', name: 'Text', type: 'text', icon: '📝', category: 'display' },
  { id: 'inp', name: 'Input', type: 'input', icon: '⌨️', category: 'input' },
  { id: 'img', name: 'Image', type: 'image', icon: '🖼️', category: 'display' },
  { id: 'card', name: 'Card', type: 'card', icon: '📇', category: 'layout' },
  { id: 'list', name: 'List', type: 'list', icon: '📋', category: 'layout' },
  { id: 'modal', name: 'Modal', type: 'modal', icon: '🪟', category: 'layout' },
  { id: 'form', name: 'Form', type: 'form', icon: '📋', category: 'input' },
];

const APP_DESIGNS_STORAGE_KEY = 'geminio.ai-builder.app-designs.v1';

type BuildRun = {
  appId: string;
  runId: string;
  status: 'accepted' | 'planning' | 'executing' | 'waiting_for_approval' | 'verifying' | 'completed' | 'failed' | 'cancelled';
};

function extractRunOutputText(result: unknown): string | null {
  if (!result || typeof result !== 'object' || !('output' in result)) return null;
  const output = result.output;
  return output && typeof output === 'object' && 'text' in output && typeof output.text === 'string' ? output.text : null;
}

const APP_TEMPLATES = [
  {
    id: 'ecommerce',
    name: 'E-Commerce App',
    description: 'Build a complete shopping app with product catalog and checkout',
    icon: '🛍️',
    screens: ['Home', 'Products', 'Cart', 'Checkout', 'Orders'],
  },
  {
    id: 'social',
    name: 'Social Media App',
    description: 'Create a social networking platform with feeds and messaging',
    icon: '👥',
    screens: ['Feed', 'Profile', 'Messages', 'Notifications', 'Settings'],
  },
  {
    id: 'productivity',
    name: 'Productivity App',
    description: 'Build a task management and note-taking application',
    icon: '✅',
    screens: ['Tasks', 'Notes', 'Calendar', 'Analytics', 'Settings'],
  },
  {
    id: 'fitness',
    name: 'Fitness Tracker',
    description: 'Create a health and fitness tracking application',
    icon: '💪',
    screens: ['Dashboard', 'Workouts', 'Progress', 'Goals', 'Community'],
  },
  {
    id: 'travel',
    name: 'Travel Planner',
    description: 'Build a travel planning and booking application',
    icon: '✈️',
    screens: ['Search', 'Bookings', 'Itinerary', 'Maps', 'Reviews'],
  },
  {
    id: 'education',
    name: 'Learning Platform',
    description: 'Create an online learning and course platform',
    icon: '📚',
    screens: ['Courses', 'Lessons', 'Progress', 'Certificates', 'Community'],
  },
];

export default function AppBuilderScreen() {
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const [appDesigns, setAppDesigns] = useState<AppDesign[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [appName, setAppName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [showCodePreview, setShowCodePreview] = useState(false);
  const [activeBuildRun, setActiveBuildRun] = useState<BuildRun | null>(null);
  const [codePreviewSource, setCodePreviewSource] = useState<'ai-core' | 'local-draft'>('local-draft');
  const submitBuildMutation = trpc.aiCore.submit.useMutation();
  const cancelBuildMutation = trpc.aiCore.cancel.useMutation();
  const buildRunQuery = trpc.aiCore.getRun.useQuery(
    { runId: activeBuildRun?.runId ?? 'run_unavailable' },
    {
      enabled: Boolean(activeBuildRun?.runId),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === 'completed' || status === 'failed' || status === 'cancelled' ? false : 1500;
      },
    },
  );
  const buildRunStatus = buildRunQuery.data?.status ?? activeBuildRun?.status ?? null;

  useEffect(() => {
    if (!activeBuildRun || buildRunStatus !== 'completed') return;
    const outputText = extractRunOutputText(buildRunQuery.data?.result);
    if (!outputText) return;
    setGeneratedCode(outputText);
    setCodePreviewSource('ai-core');
    setShowCodePreview(true);
  }, [activeBuildRun, buildRunQuery.data?.result, buildRunStatus]);

  useEffect(() => {
    void AsyncStorage.getItem(APP_DESIGNS_STORAGE_KEY).then((stored) => {
      if (!stored) return;
      try {
        setAppDesigns(JSON.parse(stored) as AppDesign[]);
      } catch {
        setAppDesigns([]);
      }
    });
  }, []);

  useEffect(() => {
    if (appDesigns.length === 0) {
      void AsyncStorage.removeItem(APP_DESIGNS_STORAGE_KEY);
      return;
    }
    void AsyncStorage.setItem(APP_DESIGNS_STORAGE_KEY, JSON.stringify(appDesigns));
  }, [appDesigns]);

  const handleCreateFromTemplate = useCallback((templateId: string) => {
    setSelectedTemplate(templateId);
    setShowNameInput(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleCreateApp = useCallback(() => {
    if (!appName.trim() || !selectedTemplate) {
      Alert.alert('Error', 'Please enter an app name');
      return;
    }

    const template = APP_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) return;

    const newApp: AppDesign = {
      id: Date.now().toString(),
      name: appName,
      description: template.description,
      screens: template.screens.map((screenName, index) => ({
        id: `screen-${index}`,
        name: screenName,
        components: [],
        layout: 'vertical',
      })),
      components: COMPONENT_LIBRARY.slice(0, 3),
      theme: {
        primaryColor: '#0a7ea4',
        secondaryColor: '#f59e0b',
        fontFamily: 'System',
      },
    };

    setAppDesigns([...appDesigns, newApp]);
    setAppName('');
    setSelectedTemplate(null);
    setShowNameInput(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [appName, selectedTemplate, appDesigns]);

  const handleGenerateCode = useCallback(async (appId: string) => {
    const app = appDesigns.find(a => a.id === appId);
    if (!app) return;

    if (!isAuthenticated) {
      setGeneratedCode(generateReactNativeCode(app));
      setCodePreviewSource('local-draft');
      setShowCodePreview(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    try {
      const response = await submitBuildMutation.mutateAsync({
        requestId: `builder_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        message: `Generate production-ready React Native implementation guidance for the ${app.name} app. The application is ${app.description}. Required screens: ${app.screens.map((screen) => screen.name).join(', ')}. Return clear, reviewable code or implementation output only.`,
        conversationId: null,
        projectId: null,
        mode: 'execute',
        metadata: { source: 'app_builder', appId: app.id, appName: app.name, screenCount: app.screens.length },
      });
      setActiveBuildRun({ appId, runId: response.runId, status: response.status });
      const outputText = extractRunOutputText(response.result);
      if (response.status === 'completed' && outputText) {
        setGeneratedCode(outputText);
        setCodePreviewSource('ai-core');
        setShowCodePreview(true);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setGeneratedCode(generateReactNativeCode(app));
      setCodePreviewSource('local-draft');
      setShowCodePreview(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [appDesigns, isAuthenticated, submitBuildMutation]);

  const handleCancelBuild = useCallback(async () => {
    if (!activeBuildRun || cancelBuildMutation.isPending) return;
    try {
      const response = await cancelBuildMutation.mutateAsync({ runId: activeBuildRun.runId });
      setActiveBuildRun((current) => current ? { ...current, status: response.status } : current);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      Alert.alert('Task still active', 'The task could not be cancelled. Its recorded status remains available in the task activity.');
    }
  }, [activeBuildRun, cancelBuildMutation]);

  const handleExportApp = useCallback((appId: string) => {
    const app = appDesigns.find(a => a.id === appId);
    if (!app) return;

    Alert.alert('Export boundary', `The ${app.name} project is ready for a connected export provider. No files were uploaded or deployed.`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [appDesigns]);

  const TemplateCard = ({ template }: { template: typeof APP_TEMPLATES[0] }) => (
    <Pressable
      onPress={() => handleCreateFromTemplate(template.id)}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-2">
        <View className="flex-row items-center gap-3">
          <Text className="text-3xl">{template.icon}</Text>
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{template.name}</Text>
            <Text className="text-xs text-muted">{template.screens.length} screens</Text>
          </View>
        </View>
        <Text className="text-sm text-muted">{template.description}</Text>
      </View>
    </Pressable>
  );

  const AppCard = ({ app }: { app: AppDesign }) => (
    <Pressable
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-3">
        <View>
          <Text className="text-lg font-bold text-foreground">{app.name}</Text>
          <Text className="text-xs text-muted mt-1">{app.screens.length} screens</Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => handleGenerateCode(app.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className="flex-1 bg-primary rounded-lg py-2 items-center"
          >
            <Text className="text-primaryForeground font-semibold text-sm">Generate Code</Text>
          </Pressable>
          <Pressable
            onPress={() => handleExportApp(app.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className="flex-1 bg-primary/20 rounded-lg py-2 items-center"
          >
            <Text className="text-primary font-semibold text-sm">Export</Text>
          </Pressable>
        </View>
        {activeBuildRun?.appId === app.id && buildRunStatus ? (
          <View className="flex-row items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
            <Text className="flex-1 text-xs font-semibold capitalize text-foreground">AI task: {buildRunStatus.replaceAll('_', ' ')}</Text>
            {['accepted', 'planning', 'executing', 'waiting_for_approval', 'verifying'].includes(buildRunStatus) ? (
              <Pressable onPress={() => void handleCancelBuild()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <Text className="text-xs font-bold text-errorText">{cancelBuildMutation.isPending ? 'Cancelling…' : 'Cancel'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="px-6 pt-6 pb-8 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">App Builder</Text>
            <Text className="text-base text-muted">Design and generate React Native apps with AI</Text>
          </View>

          {/* Quick Start */}
          <View className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-4 border border-primary/20 gap-2">
            <Text className="text-sm font-semibold text-primary">🚀 Quick Start</Text>
            <Text className="text-lg font-bold text-foreground">Choose a Template</Text>
            <Text className="text-sm text-muted">Start with a pre-built template and customize it</Text>
          </View>

          {/* Templates */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">App Templates</Text>
              <Pressable
                onPress={() => setShowTemplateModal(true)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Text className="text-primary font-semibold">View All →</Text>
              </Pressable>
            </View>
            {APP_TEMPLATES.slice(0, 3).map(template => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </View>

          {/* Your Apps */}
          {appDesigns.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-bold text-foreground">Your Apps ({appDesigns.length})</Text>
              {appDesigns.map(app => (
                <AppCard key={app.id} app={app} />
              ))}
            </View>
          )}

          {/* Features */}
          <View className="gap-3 mt-4">
            <Text className="text-lg font-bold text-foreground">Features</Text>
            <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">🎨</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">Visual Designer</Text>
                  <Text className="text-xs text-muted">Drag-and-drop UI builder</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">⚡</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">Code Generation</Text>
                  <Text className="text-xs text-muted">Auto-generate React Native code</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">📱</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">Live Preview</Text>
                  <Text className="text-xs text-muted">See changes in real-time</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">🚀</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">One-Click Export</Text>
                  <Text className="text-xs text-muted">Export as Expo project</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Template Modal */}
      <Modal visible={showTemplateModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50">
          <View className="flex-1 bg-background mt-12 rounded-t-3xl">
            <View className="px-6 py-4 border-b border-border flex-row items-center justify-between">
              <Text className="text-xl font-bold text-foreground">All Templates</Text>
              <Pressable onPress={() => setShowTemplateModal(false)}>
                <Text className="text-2xl text-foreground">✕</Text>
              </Pressable>
            </View>
            <ScrollView className="flex-1 px-6 py-4">
              {APP_TEMPLATES.map(template => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showCodePreview} animationType="slide" transparent>
        <View className="flex-1 bg-black/50">
          <View className="flex-1 bg-background mt-12 rounded-t-3xl">
            <View className="px-6 py-4 border-b border-border flex-row items-center justify-between">
              <View><Text className="text-xl font-bold text-foreground">Generated code</Text><Text className="text-xs text-muted mt-1">{codePreviewSource === 'ai-core' ? 'AI Core output — review before exporting' : 'Local deterministic draft — no external provider was used'}</Text></View>
              <Pressable onPress={() => setShowCodePreview(false)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}><Text className="text-2xl text-foreground">✕</Text></Pressable>
            </View>
            <ScrollView className="flex-1 px-6 py-4"><Text selectable className="text-xs text-foreground leading-5">{generatedCode ?? "No generated artifact is available."}</Text></ScrollView>
          </View>
        </View>
      </Modal>

      {/* App Name Input Modal */}
      <Modal visible={showNameInput} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 items-center justify-center">
          <View className="bg-background rounded-3xl p-6 w-5/6 gap-4">
            <Text className="text-xl font-bold text-foreground">Create New App</Text>
            <TextInput
              placeholder="Enter app name"
              value={appName}
              onChangeText={setAppName}
              className="bg-surface border border-border rounded-lg p-3 text-foreground"
              placeholderTextColor="#999"
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setAppName('');
                  setShowNameInput(false);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1 bg-surface border border-border rounded-lg py-3 items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateApp}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1 bg-primary rounded-lg py-3 items-center"
              >
                <Text className="text-primaryForeground font-semibold">Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function generateReactNativeCode(app: AppDesign): string {
  return `
import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';

export default function ${app.name.replace(/\s+/g, '')}() {
  return (
    <ScreenContainer className="p-6">
      <ScrollView>
        <Text className="text-3xl font-bold text-foreground">${app.name}</Text>
        {/* Generated screens */}
        ${app.screens.map(screen => `
        <View className="mt-6 gap-4">
          <Text className="text-xl font-bold text-foreground">${screen.name}</Text>
          {/* ${screen.name} content */}
        </View>
        `).join('\n')}
      </ScrollView>
    </ScreenContainer>
  );
}
  `.trim();
}
