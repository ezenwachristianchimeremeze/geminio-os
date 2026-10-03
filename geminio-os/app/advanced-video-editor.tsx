import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, Pressable, Alert, FlatList, Modal, TextInput } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';

interface Video {
  id: string;
  name: string;
  duration: number;
  thumbnail: string;
  scenes: Scene[];
  highlights: Highlight[];
  clips: Clip[];
}

interface Scene {
  id: string;
  startTime: number;
  endTime: number;
  type: 'action' | 'dialogue' | 'landscape' | 'transition';
  confidence: number;
}

interface Highlight {
  id: string;
  startTime: number;
  endTime: number;
  score: number;
  reason: string;
}

interface Clip {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'twitter';
  aspectRatio: string;
}

const EXPORT_PLATFORMS = [
  { id: 'tiktok', name: 'TikTok', icon: '🎵', ratio: '9:16', maxDuration: 10 },
  { id: 'instagram', name: 'Instagram Reels', icon: '📱', ratio: '9:16', maxDuration: 90 },
  { id: 'youtube', name: 'YouTube Shorts', icon: '📺', ratio: '9:16', maxDuration: 60 },
  { id: 'facebook', name: 'Facebook', icon: '👍', ratio: '16:9', maxDuration: 240 },
  { id: 'twitter', name: 'X (Twitter)', icon: '𝕏', ratio: '16:9', maxDuration: 140 },
];

const SAMPLE_VIDEO: Video = {
  id: 'vid-1',
  name: 'Sample Video',
  duration: 300,
  thumbnail: '🎬',
  scenes: [
    { id: 's1', startTime: 0, endTime: 45, type: 'action', confidence: 0.95 },
    { id: 's2', startTime: 45, endTime: 120, type: 'dialogue', confidence: 0.88 },
    { id: 's3', startTime: 120, endTime: 180, type: 'landscape', confidence: 0.92 },
  ],
  highlights: [
    { id: 'h1', startTime: 15, endTime: 35, score: 0.98, reason: 'High action intensity' },
    { id: 'h2', startTime: 90, endTime: 110, score: 0.85, reason: 'Emotional moment' },
  ],
  clips: [],
};

export default function AdvancedVideoEditorScreen() {
  const [videos, setVideos] = useState<Video[]>([SAMPLE_VIDEO]);
  const [selectedVideo, setSelectedVideo] = useState<Video>(SAMPLE_VIDEO);
  const [showClipModal, setShowClipModal] = useState(false);
  const [clipName, setClipName] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'twitter'>('tiktok');

  const handleDetectScenes = useCallback(() => {
    Alert.alert('Scene Detection', 'Analyzing video scenes with AI...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleDetectHighlights = useCallback(() => {
    Alert.alert('Highlight Detection', 'Finding best moments in your video...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleGenerateClips = useCallback(() => {
    setShowClipModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleCreateClip = useCallback(() => {
    if (!clipName.trim()) {
      Alert.alert('Error', 'Please enter a clip name');
      return;
    }

    const platform = EXPORT_PLATFORMS.find(p => p.id === selectedPlatform);
    if (!platform) return;

    const newClip: Clip = {
      id: `clip-${Date.now()}`,
      name: clipName,
      startTime: 0,
      endTime: Math.min(30, selectedVideo.duration),
      platform: selectedPlatform,
      aspectRatio: platform.ratio,
    };

    const updated = videos.map(v =>
      v.id === selectedVideo.id
        ? { ...v, clips: [...v.clips, newClip] }
        : v
    );
    setVideos(updated);
    setSelectedVideo({ ...selectedVideo, clips: [...selectedVideo.clips, newClip] });
    setClipName('');
    setShowClipModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [clipName, selectedPlatform, selectedVideo, videos]);

  const handleExportClip = useCallback((clipId: string) => {
    const clip = selectedVideo.clips.find(c => c.id === clipId);
    if (!clip) return;

    const platform = EXPORT_PLATFORMS.find(p => p.id === clip.platform);
    Alert.alert('Exporting', `Exporting to ${platform?.name}...`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [selectedVideo]);

  const handleRemoveNoise = useCallback(() => {
    Alert.alert('Noise Removal', 'Removing background noise from audio...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleEnhanceVoice = useCallback(() => {
    Alert.alert('Voice Enhancement', 'Enhancing voice clarity and volume...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const SceneCard = ({ scene }: { scene: Scene }) => (
    <View className="bg-surface rounded-lg p-3 mb-2 border border-border">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="font-semibold text-foreground capitalize">{scene.type}</Text>
          <Text className="text-xs text-muted">
            {Math.floor(scene.startTime)}s - {Math.floor(scene.endTime)}s
          </Text>
        </View>
        <View className="bg-primary/20 rounded px-2 py-1">
          <Text className="text-xs text-primary font-semibold">
            {Math.round(scene.confidence * 100)}%
          </Text>
        </View>
      </View>
    </View>
  );

  const HighlightCard = ({ highlight }: { highlight: Highlight }) => (
    <View className="bg-surface rounded-lg p-3 mb-2 border border-border">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="font-semibold text-foreground">{highlight.reason}</Text>
          <Text className="text-xs text-muted">
            {Math.floor(highlight.startTime)}s - {Math.floor(highlight.endTime)}s
          </Text>
        </View>
        <View className="bg-success/20 rounded px-2 py-1">
          <Text className="text-xs text-success font-semibold">
            {Math.round(highlight.score * 100)}%
          </Text>
        </View>
      </View>
    </View>
  );

  const ClipCard = ({ clip }: { clip: Clip }) => (
    <View className="bg-surface rounded-lg p-3 mb-2 border border-border">
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="font-semibold text-foreground">{clip.name}</Text>
            <Text className="text-xs text-muted">
              {EXPORT_PLATFORMS.find(p => p.id === clip.platform)?.name}
            </Text>
          </View>
          <Text className="text-xs text-primary font-semibold">{clip.aspectRatio}</Text>
        </View>
        <Pressable
          onPress={() => handleExportClip(clip.id)}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          className="bg-primary rounded-lg py-2 items-center"
        >
          <Text className="text-white font-semibold text-sm">Export</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="px-6 pt-6 pb-8 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Advanced Video Editor</Text>
            <Text className="text-base text-muted">AI-powered video editing and export</Text>
          </View>

          {/* Current Video */}
          {selectedVideo && (
            <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
              <View className="flex-row items-center gap-3">
                <Text className="text-4xl">{selectedVideo.thumbnail}</Text>
                <View className="flex-1">
                  <Text className="text-lg font-bold text-foreground">{selectedVideo.name}</Text>
                  <Text className="text-xs text-muted">{Math.floor(selectedVideo.duration / 60)}m {selectedVideo.duration % 60}s</Text>
                </View>
              </View>
            </View>
          )}

          {/* AI Analysis Tools */}
          <View className="gap-3">
            <Text className="text-lg font-bold text-foreground">AI Analysis</Text>
            <Pressable
              onPress={handleDetectScenes}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className="bg-primary rounded-lg p-4 flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">🎬</Text>
                <View>
                  <Text className="font-semibold text-white">Scene Detection</Text>
                  <Text className="text-xs text-white/80">Identify video scenes</Text>
                </View>
              </View>
              <Text className="text-white">→</Text>
            </Pressable>

            <Pressable
              onPress={handleDetectHighlights}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className="bg-primary rounded-lg p-4 flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">⭐</Text>
                <View>
                  <Text className="font-semibold text-white">Highlight Detection</Text>
                  <Text className="text-xs text-white/80">Find best moments</Text>
                </View>
              </View>
              <Text className="text-white">→</Text>
            </Pressable>
          </View>

          {/* Detected Scenes */}
          {selectedVideo.scenes.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-bold text-foreground">Detected Scenes ({selectedVideo.scenes.length})</Text>
              {selectedVideo.scenes.map(scene => (
                <SceneCard key={scene.id} scene={scene} />
              ))}
            </View>
          )}

          {/* Highlights */}
          {selectedVideo.highlights.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-bold text-foreground">Highlights ({selectedVideo.highlights.length})</Text>
              {selectedVideo.highlights.map(highlight => (
                <HighlightCard key={highlight.id} highlight={highlight} />
              ))}
            </View>
          )}

          {/* Clip Generation */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">Generated Clips</Text>
              <Pressable
                onPress={handleGenerateClips}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="bg-primary rounded-lg px-3 py-1"
              >
                <Text className="text-white font-semibold text-sm">+ New</Text>
              </Pressable>
            </View>
            {selectedVideo.clips.length === 0 ? (
              <Text className="text-sm text-muted text-center py-4">No clips yet</Text>
            ) : (
              selectedVideo.clips.map(clip => (
                <ClipCard key={clip.id} clip={clip} />
              ))
            )}
          </View>

          {/* Audio Tools */}
          <View className="gap-3">
            <Text className="text-lg font-bold text-foreground">Audio Enhancement</Text>
            <Pressable
              onPress={handleRemoveNoise}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className="bg-surface rounded-lg p-4 border border-border flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">🔊</Text>
                <View>
                  <Text className="font-semibold text-foreground">Noise Removal</Text>
                  <Text className="text-xs text-muted">Remove background noise</Text>
                </View>
              </View>
              <Text className="text-primary">→</Text>
            </Pressable>

            <Pressable
              onPress={handleEnhanceVoice}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className="bg-surface rounded-lg p-4 border border-border flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">🎤</Text>
                <View>
                  <Text className="font-semibold text-foreground">Voice Enhancement</Text>
                  <Text className="text-xs text-muted">Improve voice clarity</Text>
                </View>
              </View>
              <Text className="text-primary">→</Text>
            </Pressable>
          </View>

          {/* Supported Platforms */}
          <View className="gap-3">
            <Text className="text-lg font-bold text-foreground">Export Platforms</Text>
            <View className="flex-row flex-wrap gap-2">
              {EXPORT_PLATFORMS.map(platform => (
                <View key={platform.id} className="bg-surface rounded-lg px-3 py-2 border border-border flex-row items-center gap-2">
                  <Text className="text-lg">{platform.icon}</Text>
                  <View>
                    <Text className="text-xs font-semibold text-foreground">{platform.name}</Text>
                    <Text className="text-xs text-muted">{platform.ratio}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Clip Creation Modal */}
      <Modal visible={showClipModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 items-center justify-center">
          <View className="bg-background rounded-3xl p-6 w-5/6 gap-4">
            <Text className="text-xl font-bold text-foreground">Create New Clip</Text>
            <TextInput
              placeholder="Enter clip name"
              value={clipName}
              onChangeText={setClipName}
              className="bg-surface border border-border rounded-lg p-3 text-foreground"
              placeholderTextColor="#999"
            />
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">Platform</Text>
              <View className="flex-row flex-wrap gap-2">
                {EXPORT_PLATFORMS.map(platform => (
                  <Pressable
                    key={platform.id}
                    onPress={() => setSelectedPlatform(platform.id as any)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className={`rounded-lg py-2 px-3 border ${
                      selectedPlatform === platform.id ? 'bg-primary border-primary' : 'bg-surface border-border'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${selectedPlatform === platform.id ? 'text-white' : 'text-foreground'}`}>
                      {platform.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setClipName('');
                  setShowClipModal(false);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-1 bg-surface border border-border rounded-lg py-3 items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateClip}
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
