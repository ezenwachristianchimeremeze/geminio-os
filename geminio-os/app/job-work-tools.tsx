import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, Pressable, Alert, TextInput, Modal } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';

interface JobApplication {
  id: string;
  company: string;
  position: string;
  status: 'draft' | 'applied' | 'interview' | 'offer' | 'rejected';
  appliedDate?: Date;
  nextSteps?: string;
}

interface WorkDocument {
  id: string;
  type: 'resume' | 'cover_letter' | 'report' | 'presentation' | 'contract';
  title: string;
  content: string;
  createdAt: Date;
}

const SAMPLE_APPLICATIONS: JobApplication[] = [
  {
    id: 'j1',
    company: 'Tech Corp',
    position: 'Senior Developer',
    status: 'interview',
    appliedDate: new Date(Date.now() - 7 * 86400000),
    nextSteps: 'Technical interview on Friday',
  },
  {
    id: 'j2',
    company: 'StartUp Inc',
    position: 'Full Stack Engineer',
    status: 'applied',
    appliedDate: new Date(Date.now() - 3 * 86400000),
  },
];

const SAMPLE_DOCUMENTS: WorkDocument[] = [
  {
    id: 'd1',
    type: 'resume',
    title: 'My Resume',
    content: 'Professional resume with 5+ years of experience...',
    createdAt: new Date(),
  },
  {
    id: 'd2',
    type: 'cover_letter',
    title: 'Tech Corp Cover Letter',
    content: 'Dear Hiring Manager, I am excited to apply for...',
    createdAt: new Date(),
  },
];

export default function JobWorkToolsScreen() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'tools'>('jobs');
  const [applications, setApplications] = useState<JobApplication[]>(SAMPLE_APPLICATIONS);
  const [documents, setDocuments] = useState<WorkDocument[]>(SAMPLE_DOCUMENTS);
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');

  const handleAddApplication = useCallback(() => {
    if (!jobTitle.trim() || !company.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const newApp: JobApplication = {
      id: `j-${Date.now()}`,
      company,
      position: jobTitle,
      status: 'draft',
    };

    setApplications([newApp, ...applications]);
    setJobTitle('');
    setCompany('');
    setShowJobModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [jobTitle, company, applications]);

  const handleGenerateResume = useCallback(() => {
    Alert.alert('Resume Builder', 'Generating professional resume...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleGenerateCoverLetter = useCallback(() => {
    Alert.alert('Cover Letter', 'Creating personalized cover letter...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleInterviewCoach = useCallback(() => {
    Alert.alert('Interview Coach', 'Starting interview preparation...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleGenerateReport = useCallback(() => {
    Alert.alert('Report Generator', 'Creating professional report...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleGeneratePresentation = useCallback(() => {
    Alert.alert('Presentation', 'Building presentation slides...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'offer':
        return 'bg-success/20';
      case 'interview':
        return 'bg-primary/20';
      case 'applied':
        return 'bg-accent/20';
      case 'rejected':
        return 'bg-error/20';
      default:
        return 'bg-muted/20';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'offer':
        return 'text-success';
      case 'interview':
        return 'text-primary';
      case 'applied':
        return 'text-accent';
      case 'rejected':
        return 'text-error';
      default:
        return 'text-muted';
    }
  };

  const ApplicationCard = ({ app }: { app: JobApplication }) => (
    <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
      <View className="gap-2">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{app.position}</Text>
            <Text className="text-sm text-muted mt-1">{app.company}</Text>
          </View>
          <View className={`rounded-full px-3 py-1 ${getStatusColor(app.status)}`}>
            <Text className={`text-xs font-bold uppercase ${getStatusTextColor(app.status)}`}>
              {app.status}
            </Text>
          </View>
        </View>
        {app.appliedDate && (
          <Text className="text-xs text-muted">Applied: {app.appliedDate.toLocaleDateString()}</Text>
        )}
        {app.nextSteps && (
          <View className="bg-primary/10 rounded-lg p-2 mt-2">
            <Text className="text-xs text-primary font-semibold">📌 {app.nextSteps}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const DocumentCard = ({ doc }: { doc: WorkDocument }) => (
    <View className="bg-surface rounded-lg p-3 mb-2 border border-border">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="font-semibold text-foreground">{doc.title}</Text>
          <Text className="text-xs text-muted capitalize">{doc.type.replace('_', ' ')}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          className="bg-primary/20 rounded-lg px-2 py-1"
        >
          <Text className="text-primary font-semibold text-xs">Edit</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-0">
      <View className="flex-1">
        {/* Tabs */}
        <View className="flex-row border-b border-border">
          <Pressable
            onPress={() => setActiveTab('jobs')}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className={`flex-1 py-4 items-center border-b-2 ${
              activeTab === 'jobs' ? 'border-primary' : 'border-transparent'
            }`}
          >
            <Text className={`font-semibold ${activeTab === 'jobs' ? 'text-primary' : 'text-muted'}`}>
              Job Search
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('tools')}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className={`flex-1 py-4 items-center border-b-2 ${
              activeTab === 'tools' ? 'border-primary' : 'border-transparent'
            }`}
          >
            <Text className={`font-semibold ${activeTab === 'tools' ? 'text-primary' : 'text-muted'}`}>
              Work Tools
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
          <View className="px-6 pt-6 pb-8 gap-4">
            {activeTab === 'jobs' ? (
              <>
                {/* Quick Actions */}
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setShowJobModal(true)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className="flex-1 bg-primary rounded-lg py-3 items-center"
                  >
                    <Text className="text-white font-semibold">+ Track Job</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleInterviewCoach}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className="flex-1 bg-primary/20 rounded-lg py-3 items-center"
                  >
                    <Text className="text-primary font-semibold">Coach</Text>
                  </Pressable>
                </View>

                {/* Applications */}
                <View className="gap-2">
                  <Text className="text-lg font-bold text-foreground">My Applications</Text>
                  {applications.map(app => (
                    <ApplicationCard key={app.id} app={app} />
                  ))}
                </View>

                {/* Stats */}
                <View className="bg-surface rounded-2xl p-4 border border-border gap-2">
                  <Text className="font-semibold text-foreground">Application Stats</Text>
                  <View className="flex-row justify-between">
                    <View>
                      <Text className="text-2xl font-bold text-primary">{applications.length}</Text>
                      <Text className="text-xs text-muted">Total</Text>
                    </View>
                    <View>
                      <Text className="text-2xl font-bold text-accent">
                        {applications.filter(a => a.status === 'interview').length}
                      </Text>
                      <Text className="text-xs text-muted">Interviews</Text>
                    </View>
                    <View>
                      <Text className="text-2xl font-bold text-success">
                        {applications.filter(a => a.status === 'offer').length}
                      </Text>
                      <Text className="text-xs text-muted">Offers</Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* Work Assistant Tools */}
                <View className="gap-3">
                  <Text className="text-lg font-bold text-foreground">AI Work Assistant</Text>
                  
                  <Pressable
                    onPress={handleGenerateResume}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className="bg-primary rounded-lg p-4 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3">
                      <Text className="text-2xl">📄</Text>
                      <View>
                        <Text className="font-semibold text-white">Resume Builder</Text>
                        <Text className="text-xs text-white/80">Create professional resume</Text>
                      </View>
                    </View>
                    <Text className="text-white">→</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleGenerateCoverLetter}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className="bg-primary rounded-lg p-4 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3">
                      <Text className="text-2xl">✉️</Text>
                      <View>
                        <Text className="font-semibold text-white">Cover Letter</Text>
                        <Text className="text-xs text-white/80">Generate personalized letter</Text>
                      </View>
                    </View>
                    <Text className="text-white">→</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleGenerateReport}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className="bg-primary rounded-lg p-4 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3">
                      <Text className="text-2xl">📊</Text>
                      <View>
                        <Text className="font-semibold text-white">Report Generator</Text>
                        <Text className="text-xs text-white/80">Create professional reports</Text>
                      </View>
                    </View>
                    <Text className="text-white">→</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleGeneratePresentation}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className="bg-primary rounded-lg p-4 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3">
                      <Text className="text-2xl">🎯</Text>
                      <View>
                        <Text className="font-semibold text-white">Presentation Builder</Text>
                        <Text className="text-xs text-white/80">Build slide presentations</Text>
                      </View>
                    </View>
                    <Text className="text-white">→</Text>
                  </Pressable>
                </View>

                {/* Documents */}
                <View className="gap-2">
                  <Text className="text-lg font-bold text-foreground">My Documents</Text>
                  {documents.map(doc => (
                    <DocumentCard key={doc.id} doc={doc} />
                  ))}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Add Job Modal */}
      <Modal visible={showJobModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 items-center justify-center">
          <View className="bg-background rounded-3xl p-6 w-5/6 gap-4">
            <Text className="text-xl font-bold text-foreground">Track New Job</Text>
            <TextInput
              placeholder="Company name"
              value={company}
              onChangeText={setCompany}
              className="bg-surface border border-border rounded-lg p-3 text-foreground"
              placeholderTextColor="#999"
            />
            <TextInput
              placeholder="Job position"
              value={jobTitle}
              onChangeText={setJobTitle}
              className="bg-surface border border-border rounded-lg p-3 text-foreground"
              placeholderTextColor="#999"
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setJobTitle('');
                  setCompany('');
                  setShowJobModal(false);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1 bg-surface border border-border rounded-lg py-3 items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAddApplication}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1 bg-primary rounded-lg py-3 items-center"
              >
                <Text className="text-white font-semibold">Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
