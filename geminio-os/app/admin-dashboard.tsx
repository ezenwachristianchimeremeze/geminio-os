import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, Pressable, Alert, FlatList } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'creator' | 'moderator' | 'admin' | 'super_admin';
  status: 'active' | 'inactive' | 'suspended';
  joinDate: Date;
}

interface AuditLog {
  id: string;
  action: string;
  user: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error';
}

const SAMPLE_USERS: User[] = [
  {
    id: 'u1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin',
    status: 'active',
    joinDate: new Date(Date.now() - 180 * 86400000),
  },
  {
    id: 'u2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'creator',
    status: 'active',
    joinDate: new Date(Date.now() - 90 * 86400000),
  },
  {
    id: 'u3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    role: 'user',
    status: 'active',
    joinDate: new Date(Date.now() - 30 * 86400000),
  },
];

const SAMPLE_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'l1',
    action: 'User created',
    user: 'admin@system',
    timestamp: new Date(Date.now() - 3600000),
    status: 'success',
  },
  {
    id: 'l2',
    action: 'Content moderated',
    user: 'moderator@system',
    timestamp: new Date(Date.now() - 7200000),
    status: 'success',
  },
  {
    id: 'l3',
    action: 'Failed login attempt',
    user: 'unknown',
    timestamp: new Date(Date.now() - 10800000),
    status: 'error',
  },
];

export default function AdminDashboardScreen() {
  const [users, setUsers] = useState<User[]>(SAMPLE_USERS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(SAMPLE_AUDIT_LOGS);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'audit' | 'settings'>('overview');

  const activeUsers = users.filter(u => u.status === 'active').length;
  const totalUsers = users.length;
  const creatorCount = users.filter(u => u.role === 'creator').length;

  const handleSuspendUser = useCallback((userId: string) => {
    setUsers(users.map(u =>
      u.id === userId ? { ...u, status: 'suspended' } : u
    ));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [users]);

  const handlePromoteUser = useCallback((userId: string) => {
    Alert.alert('Promote User', 'Select new role');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleViewLogs = useCallback(() => {
    Alert.alert('Audit Logs', 'Viewing system audit logs...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const UserCard = ({ user }: { user: User }) => (
    <View className="bg-surface rounded-lg p-3 mb-2 border border-border">
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="font-semibold text-foreground">{user.name}</Text>
            <Text className="text-xs text-muted">{user.email}</Text>
          </View>
          <View className={`px-2 py-1 rounded ${
            user.status === 'active' ? 'bg-success/20' : 'bg-error/20'
          }`}>
            <Text className={`text-xs font-semibold ${
              user.status === 'active' ? 'text-successText' : 'text-errorText'
            }`}>
              {user.status}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-primary uppercase">{user.role}</Text>
          <View className="flex-row gap-1">
            <Pressable
              onPress={() => handlePromoteUser(user.id)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className="bg-primary/20 rounded px-2 py-1"
            >
              <Text className="text-primary font-semibold text-xs">Edit</Text>
            </Pressable>
            {user.status === 'active' && (
              <Pressable
                onPress={() => handleSuspendUser(user.id)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="bg-error/20 rounded px-2 py-1"
              >
                <Text className="text-errorText font-semibold text-xs">Suspend</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  const AuditLogCard = ({ log }: { log: AuditLog }) => (
    <View className="bg-surface rounded-lg p-3 mb-2 border border-border flex-row items-center gap-3">
      <View className={`w-8 h-8 rounded-full items-center justify-center ${
        log.status === 'success' ? 'bg-success/20' : log.status === 'warning' ? 'bg-warning/20' : 'bg-error/20'
      }`}>
        <Text className={`font-bold ${
          log.status === 'success' ? 'text-successText' : log.status === 'warning' ? 'text-warningText' : 'text-errorText'
        }`}>
          {log.status === 'success' ? '✓' : '!'}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-foreground">{log.action}</Text>
        <Text className="text-xs text-muted">{log.user}</Text>
      </View>
      <Text className="text-xs text-muted">{log.timestamp.toLocaleTimeString()}</Text>
    </View>
  );

  return (
    <ScreenContainer className="p-0">
      <View className="flex-1">
        {/* Tabs */}
        <View className="flex-row border-b border-border">
          {(['overview', 'users', 'audit', 'settings'] as const).map(tab => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className={`flex-1 py-4 items-center border-b-2 ${
                activeTab === tab ? 'border-primary' : 'border-transparent'
              }`}
            >
              <Text className={`font-semibold text-xs ${activeTab === tab ? 'text-primary' : 'text-muted'}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content */}
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
          <View className="px-6 pt-6 pb-8 gap-4">
            {activeTab === 'overview' ? (
              <>
                {/* Stats */}
                <View className="gap-2">
                  <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20">
                    <Text className="text-sm text-muted mb-1">Total Users</Text>
                    <Text className="text-3xl font-bold text-primary">{totalUsers}</Text>
                  </View>
                  <View className="bg-success/10 rounded-2xl p-4 border border-success/20">
                    <Text className="text-sm text-muted mb-1">Active Users</Text>
                    <Text className="text-3xl font-bold text-successText">{activeUsers}</Text>
                  </View>
                  <View className="bg-accent/10 rounded-2xl p-4 border border-accent/20">
                    <Text className="text-sm text-muted mb-1">Creators</Text>
                    <Text className="text-3xl font-bold text-accentText">{creatorCount}</Text>
                  </View>
                </View>

                {/* System Health */}
                <View className="bg-surface rounded-2xl p-4 border border-border gap-2">
                  <Text className="font-semibold text-foreground">System Health</Text>
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-muted">Server Status</Text>
                      <Text className="text-successText font-bold">✓ Healthy</Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-muted">Database</Text>
                      <Text className="text-successText font-bold">✓ Connected</Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-muted">API</Text>
                      <Text className="text-successText font-bold">✓ Running</Text>
                    </View>
                  </View>
                </View>
              </>
            ) : activeTab === 'users' ? (
              <>
                <View className="gap-2">
                  <Text className="text-lg font-bold text-foreground">User Management</Text>
                  {users.map(user => (
                    <UserCard key={user.id} user={user} />
                  ))}
                </View>
              </>
            ) : activeTab === 'audit' ? (
              <>
                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-lg font-bold text-foreground">Audit Logs</Text>
                    <Pressable
                      onPress={handleViewLogs}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                      className="bg-primary rounded-lg px-3 py-1"
                    >
                      <Text className="text-primaryForeground font-semibold text-sm">Export</Text>
                    </Pressable>
                  </View>
                  {auditLogs.map(log => (
                    <AuditLogCard key={log.id} log={log} />
                  ))}
                </View>
              </>
            ) : (
              <>
                <View className="gap-3">
                  <Text className="text-lg font-bold text-foreground">Settings</Text>
                  
                  <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
                    <Pressable
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                      className="flex-row items-center justify-between py-2"
                    >
                      <Text className="font-semibold text-foreground">Feature Flags</Text>
                      <Text className="text-primary">→</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                      className="flex-row items-center justify-between py-2 border-t border-border pt-2"
                    >
                      <Text className="font-semibold text-foreground">Moderation Tools</Text>
                      <Text className="text-primary">→</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                      className="flex-row items-center justify-between py-2 border-t border-border pt-2"
                    >
                      <Text className="font-semibold text-foreground">System Configuration</Text>
                      <Text className="text-primary">→</Text>
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
