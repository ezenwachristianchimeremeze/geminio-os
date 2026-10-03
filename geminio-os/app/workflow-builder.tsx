import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, Pressable, TextInput, Modal, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';

interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  enabled: boolean;
  createdAt: Date;
}

interface WorkflowStep {
  id: string;
  type: 'action' | 'condition' | 'delay' | 'notification' | 'api' | 'transform';
  name: string;
  config: Record<string, any>;
  nextStep?: string;
}

interface WorkflowTrigger {
  type: 'schedule' | 'event' | 'webhook' | 'manual';
  config: Record<string, any>;
}

const WORKFLOW_TEMPLATES = [
  {
    id: 'daily-digest',
    name: 'Daily Digest',
    description: 'Send daily summary of activities',
    icon: '📧',
    steps: 3,
  },
  {
    id: 'task-reminder',
    name: 'Task Reminders',
    description: 'Remind about pending tasks',
    icon: '🔔',
    steps: 2,
  },
  {
    id: 'data-backup',
    name: 'Data Backup',
    description: 'Automatic daily backup',
    icon: '💾',
    steps: 4,
  },
  {
    id: 'lead-nurture',
    name: 'Lead Nurturing',
    description: 'Automated email sequences',
    icon: '🎯',
    steps: 5,
  },
  {
    id: 'social-post',
    name: 'Social Media Posts',
    description: 'Schedule and publish posts',
    icon: '📱',
    steps: 3,
  },
  {
    id: 'invoice-gen',
    name: 'Invoice Generation',
    description: 'Auto-generate invoices',
    icon: '📄',
    steps: 4,
  },
];

const AVAILABLE_ACTIONS = [
  { id: 'send-email', name: 'Send Email', icon: '📧', description: 'Send email to recipient' },
  { id: 'send-sms', name: 'Send SMS', icon: '💬', description: 'Send text message' },
  { id: 'create-task', name: 'Create Task', icon: '✅', description: 'Create new task' },
  { id: 'update-record', name: 'Update Record', icon: '📝', description: 'Update database record' },
  { id: 'api-call', name: 'API Call', icon: '🔌', description: 'Call external API' },
  { id: 'notification', name: 'Notification', icon: '🔔', description: 'Send notification' },
  { id: 'delay', name: 'Delay', icon: '⏱️', description: 'Wait for specified time' },
  { id: 'condition', name: 'Condition', icon: '❓', description: 'Branch based on condition' },
];

const TRIGGERS = [
  { id: 'schedule', name: 'Schedule', icon: '⏰', description: 'Run on schedule' },
  { id: 'event', name: 'Event', icon: '⚡', description: 'Trigger on event' },
  { id: 'webhook', name: 'Webhook', icon: '🪝', description: 'Trigger from webhook' },
  { id: 'manual', name: 'Manual', icon: '👆', description: 'Manual trigger' },
];

export default function WorkflowBuilderScreen() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  const handleCreateFromTemplate = useCallback((templateId: string) => {
    setSelectedTemplate(templateId);
    setShowNameInput(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleCreateWorkflow = useCallback(() => {
    if (!workflowName.trim() || !selectedTemplate) {
      Alert.alert('Error', 'Please enter a workflow name');
      return;
    }

    const template = WORKFLOW_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) return;

    const newWorkflow: Workflow = {
      id: Date.now().toString(),
      name: workflowName,
      description: template.description,
      steps: Array.from({ length: template.steps }, (_, i) => ({
        id: `step-${i}`,
        type: 'action' as const,
        name: `Step ${i + 1}`,
        config: {},
        nextStep: i < template.steps - 1 ? `step-${i + 1}` : undefined,
      })),
      triggers: [
        {
          type: 'schedule' as const,
          config: { frequency: 'daily', time: '09:00' },
        },
      ],
      enabled: false,
      createdAt: new Date(),
    };

    setWorkflows([...workflows, newWorkflow]);
    setWorkflowName('');
    setSelectedTemplate(null);
    setShowNameInput(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [workflowName, selectedTemplate, workflows]);

  const handleToggleWorkflow = useCallback((workflowId: string) => {
    setWorkflows(workflows.map(w => 
      w.id === workflowId ? { ...w, enabled: !w.enabled } : w
    ));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [workflows]);

  const handleTestWorkflow = useCallback((workflowId: string) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return;

    Alert.alert('Testing', `Running test for "${workflow.name}"...`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [workflows]);

  const TemplateCard = ({ template }: { template: typeof WORKFLOW_TEMPLATES[0] }) => (
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
            <Text className="text-xs text-muted">{template.steps} steps</Text>
          </View>
        </View>
        <Text className="text-sm text-muted">{template.description}</Text>
      </View>
    </Pressable>
  );

  const WorkflowCard = ({ workflow }: { workflow: Workflow }) => (
    <Pressable
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      className="bg-surface rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{workflow.name}</Text>
            <Text className="text-xs text-muted mt-1">{workflow.steps.length} steps</Text>
          </View>
          <Pressable
            onPress={() => handleToggleWorkflow(workflow.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className={`px-3 py-1 rounded-full ${workflow.enabled ? 'bg-success/20' : 'bg-muted/20'}`}
          >
            <Text className={`text-xs font-semibold ${workflow.enabled ? 'text-success' : 'text-muted'}`}>
              {workflow.enabled ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => handleTestWorkflow(workflow.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className="flex-1 bg-primary/20 rounded-lg py-2 items-center"
          >
            <Text className="text-primary font-semibold text-sm">Test</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className="flex-1 bg-primary rounded-lg py-2 items-center"
          >
            <Text className="text-white font-semibold text-sm">Edit</Text>
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
            <Text className="text-3xl font-bold text-foreground">Workflow Builder</Text>
            <Text className="text-base text-muted">Automate your tasks and processes</Text>
          </View>

          {/* Quick Start */}
          <View className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-4 border border-primary/20 gap-2">
            <Text className="text-sm font-semibold text-primary">⚙️ Quick Start</Text>
            <Text className="text-lg font-bold text-foreground">Choose a Template</Text>
            <Text className="text-sm text-muted">Start with pre-built workflow templates</Text>
          </View>

          {/* Templates */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">Workflow Templates</Text>
              <Pressable
                onPress={() => setShowTemplateModal(true)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Text className="text-primary font-semibold">View All →</Text>
              </Pressable>
            </View>
            {WORKFLOW_TEMPLATES.slice(0, 3).map(template => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </View>

          {/* Your Workflows */}
          {workflows.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-bold text-foreground">Your Workflows ({workflows.length})</Text>
              {workflows.map(workflow => (
                <WorkflowCard key={workflow.id} workflow={workflow} />
              ))}
            </View>
          )}

          {/* Available Actions */}
          <View className="gap-3 mt-4">
            <Text className="text-lg font-bold text-foreground">Available Actions</Text>
            {AVAILABLE_ACTIONS.slice(0, 4).map(action => (
              <View key={action.id} className="bg-surface rounded-2xl p-4 border border-border flex-row items-center gap-3">
                <Text className="text-2xl">{action.icon}</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">{action.name}</Text>
                  <Text className="text-xs text-muted">{action.description}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Triggers */}
          <View className="gap-3 mt-4">
            <Text className="text-lg font-bold text-foreground">Trigger Types</Text>
            <View className="flex-row flex-wrap gap-2">
              {TRIGGERS.map(trigger => (
                <View key={trigger.id} className="bg-surface rounded-lg p-3 border border-border flex-1 min-w-1/2 items-center gap-1">
                  <Text className="text-2xl">{trigger.icon}</Text>
                  <Text className="text-xs font-semibold text-foreground text-center">{trigger.name}</Text>
                </View>
              ))}
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
              {WORKFLOW_TEMPLATES.map(template => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Workflow Name Input Modal */}
      <Modal visible={showNameInput} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 items-center justify-center">
          <View className="bg-background rounded-3xl p-6 w-5/6 gap-4">
            <Text className="text-xl font-bold text-foreground">Create New Workflow</Text>
            <TextInput
              placeholder="Enter workflow name"
              value={workflowName}
              onChangeText={setWorkflowName}
              className="bg-surface border border-border rounded-lg p-3 text-foreground"
              placeholderTextColor="#999"
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setWorkflowName('');
                  setShowNameInput(false);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1 bg-surface border border-border rounded-lg py-3 items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateWorkflow}
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
