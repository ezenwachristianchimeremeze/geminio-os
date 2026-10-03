import React, { useState } from 'react';
import { ScrollView, Text, View, Pressable, Switch } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { usePermissions } from '@/lib/permissions-context';
import { useColors } from '@/hooks/use-colors';

const CATEGORY_COLORS: Record<string, string> = {
  device: '#3B82F6',
  media: '#EC4899',
  location: '#F59E0B',
  contacts: '#8B5CF6',
  calendar: '#06B6D4',
  health: '#10B981',
};

const CATEGORY_ICONS: Record<string, string> = {
  device: '⚙️',
  media: '📷',
  location: '📍',
  contacts: '👥',
  calendar: '📅',
  health: '❤️',
};

export default function PermissionsScreen() {
  const colors = useColors();
  const { permissions, requestPermission, revokePermission, getPermissionsByCategory, auditLog } = usePermissions();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedPermission, setExpandedPermission] = useState<string | null>(null);

  const categories = ['device', 'media', 'location', 'contacts', 'calendar', 'health'];
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'granted':
        return 'text-success';
      case 'denied':
        return 'text-error';
      case 'blocked':
        return 'text-warning';
      default:
        return 'text-muted';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'granted':
        return 'bg-success/10';
      case 'denied':
        return 'bg-error/10';
      case 'blocked':
        return 'bg-warning/10';
      default:
        return 'bg-muted/10';
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Permissions</Text>
            <Text className="text-sm text-muted">Manage app access to device features</Text>
          </View>

          {/* Permission Categories */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">Categories</Text>
            <View className="flex-row flex-wrap gap-2">
              {categories.map(category => {
                const perms = getPermissionsByCategory(category as any);
                const grantedCount = perms.filter(p => p.status === 'granted').length;
                return (
                  <Pressable
                    key={category}
                    onPress={() => setSelectedCategory(selectedCategory === category ? null : category)}
                    className={`flex-1 min-w-[45%] rounded-lg p-3 gap-1 ${
                      selectedCategory === category ? 'border-2' : 'border border-border'
                    }`}
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: selectedCategory === category ? CATEGORY_COLORS[category] : undefined,
                    }}
                  >
                    <Text className="text-lg">{CATEGORY_ICONS[category]}</Text>
                    <Text className="text-xs font-semibold text-foreground capitalize">{category}</Text>
                    <Text className="text-xs text-muted">
                      {grantedCount}/{perms.length} granted
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Permissions List */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">All Permissions</Text>
            {permissions.map(permission => (
              <View key={permission.id} className="gap-2">
                <Pressable
                  onPress={() =>
                    setExpandedPermission(expandedPermission === permission.id ? null : permission.id)
                  }
                  className={`rounded-lg p-4 flex-row items-center justify-between ${getStatusBg(
                    permission.status
                  )}`}
                  style={{ backgroundColor: colors.surface }}
                >
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">{permission.name}</Text>
                    <Text className={`text-xs mt-1 ${getStatusColor(permission.status)}`}>
                      {permission.status.charAt(0).toUpperCase() + permission.status.slice(1)}
                      {permission.required && ' • Required'}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xs text-muted capitalize">{permission.category}</Text>
                    <Text className="text-lg">{CATEGORY_ICONS[permission.category]}</Text>
                  </View>
                </Pressable>

                {/* Expanded Details */}
                {expandedPermission === permission.id && (
                  <View className="rounded-lg p-4 gap-3" style={{ backgroundColor: colors.surface }}>
                    <Text className="text-sm text-muted">{permission.description}</Text>

                    {/* Permission Controls */}
                    <View className="flex-row gap-2">
                      {permission.status !== 'granted' && (
                        <Pressable
                          onPress={() => requestPermission(permission.id)}
                          className="flex-1 bg-primary rounded-lg py-2 items-center"
                          style={({ pressed }) => [pressed && { opacity: 0.8 }]}
                        >
                          <Text className="text-white text-sm font-semibold">Grant</Text>
                        </Pressable>
                      )}
                      {permission.status === 'granted' && (
                        <Pressable
                          onPress={() => revokePermission(permission.id)}
                          className="flex-1 bg-error rounded-lg py-2 items-center"
                          style={({ pressed }) => [pressed && { opacity: 0.8 }]}
                        >
                          <Text className="text-white text-sm font-semibold">Revoke</Text>
                        </Pressable>
                      )}
                    </View>

                    {/* Last Requested */}
                    {permission.lastRequested && (
                      <Text className="text-xs text-muted">
                        Last requested: {new Date(permission.lastRequested).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Audit Log */}
          {auditLog.length > 0 && (
            <View className="gap-3">
              <Text className="text-sm font-semibold text-foreground">Recent Activity</Text>
              <View className="gap-2">
                {auditLog.slice(-5).reverse().map((log, index) => (
                  <View
                    key={index}
                    className="rounded-lg p-3 gap-1"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-semibold text-foreground capitalize">
                        {log.permissionId}
                      </Text>
                      <Text className="text-xs text-muted">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                    <Text className="text-xs text-muted capitalize">{log.action}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Info */}
          <View
            className="rounded-lg p-4 gap-2"
            style={{ backgroundColor: colors.surface, borderLeftWidth: 4, borderLeftColor: colors.primary }}
          >
            <Text className="text-xs font-semibold text-foreground">🔒 Privacy</Text>
            <Text className="text-xs text-muted leading-relaxed">
              Geminio OS respects your privacy. All permission requests are logged and you have full control over what features can access.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
