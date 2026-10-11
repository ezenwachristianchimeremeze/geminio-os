import React, { useState } from 'react';
import { ScrollView, Text, View, Pressable, TextInput, Switch, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useMediaStudio } from '@/lib/media-studio-context';
import { useColors } from '@/hooks/use-colors';

export default function MediaStudioScreen() {
  const colors = useColors();
  const {
    projects,
    currentProject,
    settings,
    isGenerating,
    generationProgress,
    createProject,
    generateMedia,
    updateSettings,
    setCurrentProject,
    deleteProject,
  } = useMediaStudio();

  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [prompt, setPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const handleCreateProject = async (type: 'image' | 'video') => {
    const generationType = type === 'image' ? 'text-to-image' : 'text-to-video';
    await createProject(`${type} Project`, type, generationType);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !currentProject) return;
    await generateMedia(prompt);
  };

  const imageProjects = projects.filter(p => p.type === 'image');
  const videoProjects = projects.filter(p => p.type === 'video');

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Media Studio</Text>
            <Text className="text-sm text-muted">Create stunning images and videos with AI</Text>
          </View>

          {/* Tabs */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setActiveTab('image')}
              className={`flex-1 rounded-lg py-3 items-center ${
                activeTab === 'image' ? 'bg-primary' : 'bg-surface'
              }`}
            >
              <Text className={activeTab === 'image' ? 'text-primaryForeground font-semibold' : 'text-foreground font-semibold'}>
                📷 Image
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('video')}
              className={`flex-1 rounded-lg py-3 items-center ${
                activeTab === 'video' ? 'bg-primary' : 'bg-surface'
              }`}
            >
              <Text className={activeTab === 'video' ? 'text-primaryForeground font-semibold' : 'text-foreground font-semibold'}>
                🎬 Video
              </Text>
            </Pressable>
          </View>

          {/* Current Project */}
          {currentProject && currentProject.type === activeTab && (
            <View className="gap-4">
              <View className="gap-2">
                <Text className="text-sm font-semibold text-foreground">Project: {currentProject.name}</Text>
                <Text className={`text-xs ${
                  currentProject.status === 'completed'
                    ? 'text-successText'
                    : currentProject.status === 'failed'
                    ? 'text-errorText'
                    : 'text-muted'
                }`}>
                  Status: {currentProject.status}
                </Text>
              </View>

              {/* Prompt Input */}
              <View className="gap-2">
                <Text className="text-sm font-semibold text-foreground">Describe what you want to create</Text>
                <TextInput
                  placeholder="Enter your creative prompt..."
                  value={prompt}
                  onChangeText={setPrompt}
                  multiline
                  numberOfLines={4}
                  className="bg-surface text-foreground p-3 rounded-lg border border-border"
                  placeholderTextColor={colors.muted}
                  editable={!isGenerating}
                />
              </View>

              {/* Generation Progress */}
              {isGenerating && (
                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-foreground">Generating...</Text>
                    <Text className="text-sm text-primary font-semibold">{generationProgress}%</Text>
                  </View>
                  <View className="h-2 bg-border rounded-full overflow-hidden">
                    <View
                      className="h-full bg-primary"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </View>
                </View>
              )}

              {/* Generate Button */}
              <Pressable
                onPress={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className={`rounded-lg py-3 items-center ${
                  isGenerating || !prompt.trim() ? 'bg-muted/50' : 'bg-primary'
                }`}
              >
                {isGenerating ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-primaryForeground font-semibold">Generate {activeTab === 'image' ? 'Image' : 'Video'}</Text>
                )}
              </Pressable>

              {/* Result */}
              {currentProject.result && (
                <View className="gap-2">
                  <Text className="text-sm font-semibold text-foreground">Generated {activeTab}</Text>
                  <View
                    className="rounded-lg p-4 items-center justify-center h-48"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <Text className="text-4xl mb-2">
                      {activeTab === 'image' ? '🖼️' : '🎥'}
                    </Text>
                    <Text className="text-xs text-muted text-center">
                      {activeTab === 'image' ? 'Image generated successfully' : 'Video generated successfully'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Settings */}
          <View className="gap-3">
            <Pressable
              onPress={() => setShowSettings(!showSettings)}
              className="flex-row items-center justify-between"
            >
              <Text className="text-lg font-semibold text-foreground">Settings</Text>
              <Text className="text-lg text-primary">⚙️</Text>
            </Pressable>

            {showSettings && (
              <View className="gap-3">
                {/* Quality */}
                <View className="rounded-lg p-4 gap-3" style={{ backgroundColor: colors.surface }}>
                  <Text className="text-sm font-semibold text-foreground">Quality</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {['low', 'medium', 'high', 'ultra'].map(q => (
                      <Pressable
                        key={q}
                        onPress={() => updateSettings({ quality: q as any })}
                        className={`px-3 py-2 rounded-lg ${
                          settings.quality === q ? 'bg-primary' : 'bg-border'
                        }`}
                      >
                        <Text className={settings.quality === q ? 'text-primaryForeground text-xs font-semibold' : 'text-foreground text-xs'}>
                          {q.charAt(0).toUpperCase() + q.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Style */}
                <View className="rounded-lg p-4 gap-3" style={{ backgroundColor: colors.surface }}>
                  <Text className="text-sm font-semibold text-foreground">Style</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {['realistic', 'artistic', 'cartoon', 'abstract'].map(style => (
                      <Pressable
                        key={style}
                        onPress={() => updateSettings({ style })}
                        className={`px-3 py-2 rounded-lg ${
                          settings.style === style ? 'bg-primary' : 'bg-border'
                        }`}
                      >
                        <Text className={settings.style === style ? 'text-primaryForeground text-xs font-semibold' : 'text-foreground text-xs'}>
                          {style.charAt(0).toUpperCase() + style.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Aspect Ratio */}
                <View className="rounded-lg p-4 gap-3" style={{ backgroundColor: colors.surface }}>
                  <Text className="text-sm font-semibold text-foreground">Aspect Ratio</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {['16:9', '9:16', '1:1', '4:3'].map(ratio => (
                      <Pressable
                        key={ratio}
                        onPress={() => updateSettings({ aspectRatio: ratio })}
                        className={`px-3 py-2 rounded-lg ${
                          settings.aspectRatio === ratio ? 'bg-primary' : 'bg-border'
                        }`}
                      >
                        <Text className={settings.aspectRatio === ratio ? 'text-primaryForeground text-xs font-semibold' : 'text-foreground text-xs'}>
                          {ratio}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Projects List */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-foreground">
                {activeTab === 'image' ? 'Image' : 'Video'} Projects
              </Text>
              <Pressable
                onPress={() => handleCreateProject(activeTab)}
                className="bg-primary rounded-lg px-3 py-2"
              >
                <Text className="text-primaryForeground text-xs font-semibold">+ New</Text>
              </Pressable>
            </View>

            {(activeTab === 'image' ? imageProjects : videoProjects).map(project => (
              <Pressable
                key={project.id}
                onPress={() => setCurrentProject(project)}
                className={`rounded-lg p-4 gap-2 border-2 ${
                  currentProject?.id === project.id ? 'border-primary' : 'border-border'
                }`}
                style={{ backgroundColor: colors.surface }}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-foreground flex-1">{project.name}</Text>
                  <Pressable
                    onPress={() => deleteProject(project.id)}
                    className="p-2"
                  >
                    <Text className="text-lg">🗑️</Text>
                  </Pressable>
                </View>
                <Text className={`text-xs ${
                  project.status === 'completed'
                    ? 'text-successText'
                    : project.status === 'failed'
                    ? 'text-errorText'
                    : 'text-muted'
                }`}>
                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </Text>
              </Pressable>
            ))}

            {(activeTab === 'image' ? imageProjects : videoProjects).length === 0 && (
              <View className="rounded-lg p-4 items-center gap-2" style={{ backgroundColor: colors.surface }}>
                <Text className="text-2xl">📭</Text>
                <Text className="text-sm text-muted">No {activeTab} projects yet</Text>
                <Pressable
                  onPress={() => handleCreateProject(activeTab)}
                  className="bg-primary rounded-lg px-4 py-2 mt-2"
                >
                  <Text className="text-primaryForeground text-sm font-semibold">Create First {activeTab}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
