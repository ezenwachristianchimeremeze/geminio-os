import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';

export interface ModuleItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  onPress?: () => void;
}

interface ModuleHubProps {
  modules: ModuleItem[];
  title?: string;
  subtitle?: string;
  columns?: number;
}

export function ModuleHub({
  modules,
  title = 'Modules',
  subtitle,
  columns = 2,
}: ModuleHubProps) {
  const colors = useColors();

  const handleModulePress = (module: ModuleItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    module.onPress?.();
  };

  const ModuleCard = ({ module }: { module: ModuleItem }) => (
    <Pressable
      onPress={() => handleModulePress(module)}
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
      className="flex-1 bg-surface rounded-2xl p-4 border border-border items-center justify-center min-h-32 m-2"
    >
      <Text className="text-4xl mb-2">{module.icon}</Text>
      <Text className="text-sm font-bold text-foreground text-center">
        {module.title}
      </Text>
      {module.description && (
        <Text className="text-xs text-muted text-center mt-1">
          {module.description}
        </Text>
      )}
    </Pressable>
  );

  return (
    <View className="gap-4">
      {(title || subtitle) && (
        <View className="gap-1">
          {title && (
            <Text className="text-2xl font-bold text-foreground">
              {title}
            </Text>
          )}
          {subtitle && (
            <Text className="text-sm text-muted">
              {subtitle}
            </Text>
          )}
        </View>
      )}

      <View className="flex-row flex-wrap">
        {modules.map((module) => (
          <View key={module.id} style={{ width: `${100 / columns}%` }}>
            <ModuleCard module={module} />
          </View>
        ))}
      </View>
    </View>
  );
}
