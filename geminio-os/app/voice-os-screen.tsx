import React, { useState } from 'react';
import { ScrollView, Text, View, Pressable, Switch } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useVoiceOS } from '@/lib/voice-os-context';
import { useColors } from '@/hooks/use-colors';

export default function VoiceOSScreen() {
  const colors = useColors();
  const { settings, isListening, startListening, stopListening, updateSettings, getAvailableCommands } = useVoiceOS();
  const [showCommandList, setShowCommandList] = useState(false);

  const commands = getAvailableCommands();

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Voice Operating System</Text>
            <Text className="text-sm text-muted">Control your device with voice commands</Text>
          </View>

          {/* Voice Status */}
          <View
            className="rounded-2xl p-6 gap-4"
            style={{ backgroundColor: colors.surface }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-foreground">Voice Status</Text>
              <View
                className={`w-3 h-3 rounded-full ${isListening ? 'bg-success' : 'bg-muted'}`}
              />
            </View>
            <Text className="text-sm text-muted">
              {isListening ? 'Listening for commands...' : 'Voice OS is ready'}
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={startListening}
                className="flex-1 bg-primary rounded-lg py-3 items-center"
                style={({ pressed }) => [pressed && { opacity: 0.8 }]}
              >
                <Text className="text-primaryForeground font-semibold">Start Listening</Text>
              </Pressable>
              <Pressable
                onPress={stopListening}
                className="flex-1 bg-error rounded-lg py-3 items-center"
                style={({ pressed }) => [pressed && { opacity: 0.8 }]}
              >
                <Text className="text-errorForeground font-semibold">Stop</Text>
              </Pressable>
            </View>
          </View>

          {/* Settings */}
          <View className="gap-4">
            <Text className="text-lg font-semibold text-foreground">Settings</Text>

            {/* Voice Type */}
            <View
              className="rounded-xl p-4 gap-3"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-foreground">Voice Type</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => updateSettings({ voiceType: 'male' })}
                    className={`px-3 py-1 rounded-lg ${
                      settings.voiceType === 'male' ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    <Text className={settings.voiceType === 'male' ? 'text-primaryForeground' : 'text-foreground'}>
                      Male
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => updateSettings({ voiceType: 'female' })}
                    className={`px-3 py-1 rounded-lg ${
                      settings.voiceType === 'female' ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    <Text className={settings.voiceType === 'female' ? 'text-primaryForeground' : 'text-foreground'}>
                      Female
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Language */}
            <View
              className="rounded-xl p-4 gap-3"
              style={{ backgroundColor: colors.surface }}
            >
              <Text className="text-sm font-medium text-foreground">Language</Text>
              <View className="flex-row flex-wrap gap-2">
                {['en', 'fr', 'es', 'ar', 'zh'].map(lang => (
                  <Pressable
                    key={lang}
                    onPress={() => updateSettings({ language: lang as any })}
                    className={`px-3 py-2 rounded-lg ${
                      settings.language === lang ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    <Text className={settings.language === lang ? 'text-primaryForeground' : 'text-foreground'}>
                      {lang.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Offline Mode */}
            <View
              className="rounded-xl p-4 flex-row items-center justify-between"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">Offline Mode</Text>
                <Text className="text-xs text-muted mt-1">Use voice without internet</Text>
              </View>
              <Switch
                value={settings.offlineMode}
                onValueChange={(value) => updateSettings({ offlineMode: value })}
              />
            </View>

            {/* Auto Respond */}
            <View
              className="rounded-xl p-4 flex-row items-center justify-between"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">Auto Respond</Text>
                <Text className="text-xs text-muted mt-1">Voice feedback for commands</Text>
              </View>
              <Switch
                value={settings.autoRespond}
                onValueChange={(value) => updateSettings({ autoRespond: value })}
              />
            </View>
          </View>

          {/* Available Commands */}
          <View className="gap-3">
            <Pressable
              onPress={() => setShowCommandList(!showCommandList)}
              className="flex-row items-center justify-between"
            >
              <Text className="text-lg font-semibold text-foreground">Available Commands</Text>
              <Text className="text-sm text-primary font-semibold">{commands.length}</Text>
            </Pressable>

            {showCommandList && (
              <View className="gap-2">
                {commands.map(command => (
                  <View
                    key={command.id}
                    className="rounded-lg p-3 gap-1"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <Text className="text-sm font-semibold text-foreground">{command.name}</Text>
                    <Text className="text-xs text-muted">{command.description}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Info */}
          <View
            className="rounded-lg p-4 gap-2"
            style={{ backgroundColor: colors.surface, borderLeftWidth: 4, borderLeftColor: colors.primary }}
          >
            <Text className="text-xs font-semibold text-foreground">💡 Tip</Text>
            <Text className="text-xs text-muted leading-relaxed">
              Say &quot;Hey Geminio&quot; followed by a command to control your device. Example: &quot;Hey Geminio, open chat&quot; or &quot;Hey Geminio, read notifications&quot;
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
