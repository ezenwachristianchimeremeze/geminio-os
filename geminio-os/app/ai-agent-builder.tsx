import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, Pressable, TextInput, Modal, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';

interface AIAgent {
  id: string;
  name: string;
  description: string;
  personality: string;
  systemPrompt: string;
  capabilities: string[];
  model: 'gpt-4' | 'gpt-3.5' | 'claude' | 'llama';
  temperature: number;
  maxTokens: number;
  tools: AgentTool[];
  createdAt: Date;
}

interface AgentTool {
  id: string;
  name: string;
  description: string;
  type: 'api' | 'function' | 'search' | 'calculator' | 'database';
  config: Record<string, any>;
}

const AGENT_TEMPLATES = [
  {
    id: 'customer-support',
    name: 'Customer Support Agent',
    description: 'Handle customer inquiries and support tickets',
    icon: '🎧',
    capabilities: 4,
  },
  {
    id: 'sales-assistant',
    name: 'Sales Assistant',
    description: 'Qualify leads and assist with sales',
    icon: '💼',
    capabilities: 5,
  },
  {
    id: 'content-creator',
    name: 'Content Creator',
    description: 'Generate and optimize content',
    icon: '✍️',
    capabilities: 4,
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    description: 'Analyze data and generate insights',
    icon: '📊',
    capabilities: 5,
  },
  {
    id: 'code-assistant',
    name: 'Code Assistant',
    description: 'Help with coding and debugging',
    icon: '💻',
    capabilities: 6,
  },
  {
    id: 'research-agent',
    name: 'Research Agent',
    description: 'Conduct research and gather information',
    icon: '🔍',
    capabilities: 5,
  },
];

const AGENT_CAPABILITIES = [
  { id: 'nlp', name: 'Natural Language Processing', icon: '💬' },
  { id: 'search', name: 'Web Search', icon: '🔍' },
  { id: 'api', name: 'API Integration', icon: '🔌' },
  { id: 'db', name: 'Database Query', icon: '🗄️' },
  { id: 'calc', name: 'Calculations', icon: '🧮' },
  { id: 'vision', name: 'Image Recognition', icon: '👁️' },
  { id: 'voice', name: 'Voice Processing', icon: '🎤' },
  { id: 'memory', name: 'Long-term Memory', icon: '🧠' },
];

const AVAILABLE_TOOLS = [
  { id: 'web-search', name: 'Web Search', icon: '🔍', description: 'Search the internet' },
  { id: 'calculator', name: 'Calculator', icon: '🧮', description: 'Perform calculations' },
  { id: 'api', name: 'API Call', icon: '🔌', description: 'Call external APIs' },
  { id: 'database', name: 'Database', icon: '🗄️', description: 'Query databases' },
  { id: 'email', name: 'Email', icon: '📧', description: 'Send emails' },
  { id: 'slack', name: 'Slack', icon: '💬', description: 'Slack integration' },
];

export default function AIAgentBuilderScreen() {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  const handleCreateFromTemplate = useCallback((templateId: string) => {
    setSelectedTemplate(templateId);
    setShowNameInput(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleCreateAgent = useCallback(() => {
    if (!agentName.trim() || !selectedTemplate) {
      Alert.alert('Error', 'Please enter an agent name');
      return;
    }

    const template = AGENT_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) return;

    const newAgent: AIAgent = {
      id: Date.now().toString(),
      name: agentName,
      description: template.description,
      personality: 'Professional and helpful',
      systemPrompt: `You are ${agentName}, a helpful AI assistant specialized in ${template.description.toLowerCase()}.`,
      capabilities: AGENT_CAPABILITIES.slice(0, template.capabilities).map(c => c.id),
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
      tools: AVAILABLE_TOOLS.slice(0, 3).map((tool, i) => ({
        id: `tool-${i}`,
        name: tool.name,
        description: tool.description,
        type: tool.id as any,
        config: {},
      })),
      createdAt: new Date(),
    };

    setAgents([...agents, newAgent]);
    setAgentName('');
    setSelectedTemplate(null);
    setShowNameInput(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [agentName, selectedTemplate, agents]);

  const handleTestAgent = useCallback((agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    Alert.alert('Test Agent', `Testing ${agent.name}...`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [agents]);

  const handleDeployAgent = useCallback((agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    Alert.alert('Deploy', `Deploying ${agent.name} to production...`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [agents]);

  const TemplateCard = ({ template }: { template: typeof AGENT_TEMPLATES[0] }) => (
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
            <Text className="text-xs text-muted">{template.capabilities} capabilities</Text>
          </View>
        </View>
        <Text className="text-sm text-muted">{template.description}</Text>
      </View>
    </Pressable>
  );

  const AgentCard = ({ agent }: { agent: AIAgent }) => (
    <Pressable
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-3">
        <View>
          <Text className="text-lg font-bold text-foreground">{agent.name}</Text>
          <Text className="text-xs text-muted mt-1">{agent.description}</Text>
          <View className="flex-row gap-2 mt-2">
            <View className="bg-primary/20 rounded px-2 py-1">
              <Text className="text-xs text-primary font-semibold">{agent.model}</Text>
            </View>
            <View className="bg-primary/20 rounded px-2 py-1">
              <Text className="text-xs text-primary font-semibold">{agent.capabilities.length} capabilities</Text>
            </View>
          </View>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => handleTestAgent(agent.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className="flex-1 bg-primary/20 rounded-lg py-2 items-center"
          >
            <Text className="text-primary font-semibold text-sm">Test</Text>
          </Pressable>
          <Pressable
            onPress={() => handleDeployAgent(agent.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className="flex-1 bg-primary rounded-lg py-2 items-center"
          >
            <Text className="text-white font-semibold text-sm">Deploy</Text>
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
            <Text className="text-3xl font-bold text-foreground">AI Agent Builder</Text>
            <Text className="text-base text-muted">Create and deploy custom AI agents</Text>
          </View>

          {/* Quick Start */}
          <View className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-4 border border-primary/20 gap-2">
            <Text className="text-sm font-semibold text-primary">🤖 Quick Start</Text>
            <Text className="text-lg font-bold text-foreground">Choose a Template</Text>
            <Text className="text-sm text-muted">Start with pre-configured agent templates</Text>
          </View>

          {/* Templates */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">Agent Templates</Text>
              <Pressable
                onPress={() => setShowTemplateModal(true)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Text className="text-primary font-semibold">View All →</Text>
              </Pressable>
            </View>
            {AGENT_TEMPLATES.slice(0, 3).map(template => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </View>

          {/* Your Agents */}
          {agents.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-bold text-foreground">Your Agents ({agents.length})</Text>
              {agents.map(agent => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </View>
          )}

          {/* Capabilities */}
          <View className="gap-3 mt-4">
            <Text className="text-lg font-bold text-foreground">Available Capabilities</Text>
            <View className="flex-row flex-wrap gap-2">
              {AGENT_CAPABILITIES.map(cap => (
                <View key={cap.id} className="bg-surface rounded-lg px-3 py-2 border border-border flex-row items-center gap-2">
                  <Text className="text-lg">{cap.icon}</Text>
                  <Text className="text-xs font-semibold text-foreground">{cap.name}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Tools */}
          <View className="gap-3 mt-4">
            <Text className="text-lg font-bold text-foreground">Available Tools</Text>
            {AVAILABLE_TOOLS.map(tool => (
              <View key={tool.id} className="bg-surface rounded-2xl p-4 border border-border flex-row items-center gap-3">
                <Text className="text-2xl">{tool.icon}</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">{tool.name}</Text>
                  <Text className="text-xs text-muted">{tool.description}</Text>
                </View>
              </View>
            ))}
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
              {AGENT_TEMPLATES.map(template => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Agent Name Input Modal */}
      <Modal visible={showNameInput} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 items-center justify-center">
          <View className="bg-background rounded-3xl p-6 w-5/6 gap-4">
            <Text className="text-xl font-bold text-foreground">Create New Agent</Text>
            <TextInput
              placeholder="Enter agent name"
              value={agentName}
              onChangeText={setAgentName}
              className="bg-surface border border-border rounded-lg p-3 text-foreground"
              placeholderTextColor="#999"
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setAgentName('');
                  setShowNameInput(false);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1 bg-surface border border-border rounded-lg py-3 items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateAgent}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1 bg-primary rounded-lg py-3 items-center"
              >
                <Text className="text-white font-semibold">Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
