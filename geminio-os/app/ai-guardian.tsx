import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, Pressable, Alert, FlatList } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';

interface ThreatAlert {
  id: string;
  type: 'scam' | 'fraud' | 'phishing' | 'malware' | 'suspicious';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  timestamp: Date;
  resolved: boolean;
}

interface SecurityAuditLog {
  id: string;
  action: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'failure';
}

const SAMPLE_ALERTS: ThreatAlert[] = [
  {
    id: 'alert-1',
    type: 'phishing',
    severity: 'high',
    title: 'Suspicious Email Detected',
    description: 'Email claiming to be from your bank with suspicious links',
    timestamp: new Date(Date.now() - 3600000),
    resolved: false,
  },
  {
    id: 'alert-2',
    type: 'scam',
    severity: 'critical',
    title: 'Scam Website Detected',
    description: 'Website mimicking a legitimate service',
    timestamp: new Date(Date.now() - 7200000),
    resolved: true,
  },
];

export default function AIGuardianScreen() {
  const [alerts, setAlerts] = useState<ThreatAlert[]>(SAMPLE_ALERTS);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([]);
  const [securityScore, setSecurityScore] = useState(92);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<ThreatAlert | null>(null);

  const handleRunScan = useCallback(() => {
    Alert.alert('Security Scan', 'Running comprehensive security scan...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleResolveAlert = useCallback((alertId: string) => {
    setAlerts(alerts.map(a =>
      a.id === alertId ? { ...a, resolved: true } : a
    ));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [alerts]);

  const handleViewDetails = useCallback((alert: ThreatAlert) => {
    setSelectedAlert(alert);
    setShowDetails(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-error/20';
      case 'high':
        return 'bg-warning/20';
      case 'medium':
        return 'bg-primary/20';
      default:
        return 'bg-success/20';
    }
  };

  const getSeverityTextColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-error';
      case 'high':
        return 'text-warning';
      case 'medium':
        return 'text-primary';
      default:
        return 'text-success';
    }
  };

  const AlertCard = ({ alert }: { alert: ThreatAlert }) => (
    <Pressable
      onPress={() => handleViewDetails(alert)}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      className={`rounded-2xl p-4 mb-3 border border-border ${alert.resolved ? 'bg-surface/50' : 'bg-surface'}`}
    >
      <View className="gap-2">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className={`text-lg font-bold ${alert.resolved ? 'text-muted' : 'text-foreground'}`}>
              {alert.title}
            </Text>
            <Text className={`text-xs mt-1 uppercase font-semibold ${getSeverityTextColor(alert.severity)}`}>
              {alert.severity} - {alert.type}
            </Text>
          </View>
          <View className={`rounded-full px-3 py-1 ${getSeverityColor(alert.severity)}`}>
            <Text className={`text-xs font-bold ${getSeverityTextColor(alert.severity)}`}>
              {alert.resolved ? '✓' : '!'}
            </Text>
          </View>
        </View>
        <Text className="text-sm text-muted">{alert.description}</Text>
        {!alert.resolved && (
          <Pressable
            onPress={() => handleResolveAlert(alert.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className="bg-primary rounded-lg py-2 items-center mt-2"
          >
            <Text className="text-white font-semibold text-sm">Mark as Resolved</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );

  const activeAlerts = alerts.filter(a => !a.resolved);
  const resolvedAlerts = alerts.filter(a => a.resolved);

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="px-6 pt-6 pb-8 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">AI Guardian</Text>
            <Text className="text-base text-muted">Your personal security watchdog</Text>
          </View>

          {/* Security Score */}
          <View className="bg-gradient-to-br from-success/10 to-primary/10 rounded-2xl p-6 border border-success/20 gap-3 items-center">
            <View className="w-24 h-24 rounded-full bg-success/20 items-center justify-center">
              <Text className="text-4xl font-bold text-success">{securityScore}</Text>
            </View>
            <View className="items-center gap-1">
              <Text className="text-lg font-bold text-foreground">Security Score</Text>
              <Text className="text-sm text-muted">Your system is well protected</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={handleRunScan}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className="flex-1 bg-primary rounded-lg py-3 items-center"
            >
              <Text className="text-white font-semibold">Run Scan</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className="flex-1 bg-primary/20 rounded-lg py-3 items-center"
            >
              <Text className="text-primary font-semibold">Settings</Text>
            </Pressable>
          </View>

          {/* Active Threats */}
          {activeAlerts.length > 0 && (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-bold text-foreground">Active Threats</Text>
                <View className="bg-error/20 rounded-full px-2 py-1">
                  <Text className="text-xs text-error font-bold">{activeAlerts.length}</Text>
                </View>
              </View>
              {activeAlerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </View>
          )}

          {/* Resolved Alerts */}
          {resolvedAlerts.length > 0 && (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-bold text-foreground">Resolved</Text>
                <View className="bg-success/20 rounded-full px-2 py-1">
                  <Text className="text-xs text-success font-bold">{resolvedAlerts.length}</Text>
                </View>
              </View>
              {resolvedAlerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </View>
          )}

          {/* Security Features */}
          <View className="gap-3">
            <Text className="text-lg font-bold text-foreground">Protection Features</Text>
            <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">🔍</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">Scam Detection</Text>
                  <Text className="text-xs text-muted">Identifies fraudulent schemes</Text>
                </View>
                <Text className="text-success font-bold">✓</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">🎣</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">Phishing Detection</Text>
                  <Text className="text-xs text-muted">Blocks phishing attempts</Text>
                </View>
                <Text className="text-success font-bold">✓</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">🦠</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">Malware Protection</Text>
                  <Text className="text-xs text-muted">Detects malicious files</Text>
                </View>
                <Text className="text-success font-bold">✓</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">🔐</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">Encryption</Text>
                  <Text className="text-xs text-muted">AES-256 data protection</Text>
                </View>
                <Text className="text-success font-bold">✓</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl">📋</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">Audit Logging</Text>
                  <Text className="text-xs text-muted">Track all activities</Text>
                </View>
                <Text className="text-success font-bold">✓</Text>
              </View>
            </View>
          </View>

          {/* Tips */}
          <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20 gap-2">
            <Text className="font-semibold text-primary">💡 Security Tips</Text>
            <Text className="text-sm text-foreground">
              • Keep your system updated
              • Use strong passwords
              • Enable biometric authentication
              • Review permissions regularly
              • Do not click suspicious links
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
