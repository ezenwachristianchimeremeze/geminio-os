import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';

export default function AuthScreen() {
  const { authenticate, biometricsAvailable, authMethod } = useAuth();
  const router = useRouter();
  const colors = useColors();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleBiometricAuth = async (method: 'faceId' | 'fingerprint') => {
    setIsLoading(true);
    try {
      const success = await authenticate(method);
      if (!success) {
        Alert.alert('Authentication Failed', 'Please try again');
      }
      await Haptics.notificationAsync(
        success 
          ? Haptics.NotificationFeedbackType.Success 
          : Haptics.NotificationFeedbackType.Error
      );
    } catch (error) {
      Alert.alert('Error', 'Authentication error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSetup = async () => {
    if (pin.length < 4) {
      Alert.alert('Invalid PIN', 'PIN must be at least 4 digits');
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert('PIN Mismatch', 'PINs do not match');
      return;
    }
    setIsLoading(true);
    try {
      const success = await authenticate('pin', pin);
      if (success) {
        setShowPinSetup(false);
        setPin('');
        setConfirmPin('');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Error', 'Failed to set PIN');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipAuth = async () => {
    setIsLoading(true);
    try {
      await authenticate('none');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="flex-1 justify-center items-center px-6 gap-8">
          {/* Header */}
          <View className="items-center gap-3">
            <Text className="text-4xl font-bold text-foreground">Geminio OS</Text>
            <Text className="text-base text-muted text-center">
              Your Personal AI Operating System
            </Text>
          </View>

          {/* Authentication Options */}
          {!showPinSetup ? (
            <View className="w-full gap-4">
              <View className="gap-3">
                <Pressable onPress={() => router.push({ pathname: '/auth/[flow]', params: { flow: 'sign-in' } })} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]} className="bg-primary rounded-2xl p-4 items-center"><Text className="text-white font-semibold text-lg">Sign in with account</Text></Pressable>
                <Pressable onPress={() => router.push({ pathname: '/auth/[flow]', params: { flow: 'sign-up' } })} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]} className="border border-primary rounded-2xl p-4 items-center"><Text className="text-primary font-semibold text-lg">Create an account</Text></Pressable>
                <View className="flex-row justify-center gap-5">
                  <Pressable onPress={() => router.push({ pathname: '/auth/[flow]', params: { flow: 'recovery' } })}><Text className="text-primary font-medium">Recover access</Text></Pressable>
                  <Pressable onPress={() => router.push({ pathname: '/auth/[flow]', params: { flow: 'mfa' } })}><Text className="text-primary font-medium">Verify MFA</Text></Pressable>
                  <Pressable onPress={() => router.push({ pathname: '/auth/[flow]', params: { flow: 'link-account' } })}><Text className="text-primary font-medium">Link account</Text></Pressable>
                  <Pressable onPress={() => router.push({ pathname: '/auth/[flow]', params: { flow: 'onboarding' } })}><Text className="text-primary font-medium">Start setup</Text></Pressable>
                </View>
              </View>

              {/* Face ID */}
              {biometricsAvailable.faceId && (
                <Pressable
                  onPress={() => handleBiometricAuth('faceId')}
                  disabled={isLoading}
                  style={({ pressed }) => [
                    {
                      opacity: pressed ? 0.7 : 1,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                  className="bg-primary rounded-2xl p-4 items-center"
                >
                  <Text className="text-white font-semibold text-lg">
                    Authenticate with Face ID
                  </Text>
                </Pressable>
              )}

              {/* Fingerprint */}
              {biometricsAvailable.fingerprint && (
                <Pressable
                  onPress={() => handleBiometricAuth('fingerprint')}
                  disabled={isLoading}
                  style={({ pressed }) => [
                    {
                      opacity: pressed ? 0.7 : 1,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                  className="bg-accent rounded-2xl p-4 items-center"
                >
                  <Text className="text-white font-semibold text-lg">
                    Authenticate with Fingerprint
                  </Text>
                </Pressable>
              )}

              {/* PIN Setup */}
              <Pressable
                onPress={() => setShowPinSetup(true)}
                disabled={isLoading}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
                className="border-2 border-primary rounded-2xl p-4 items-center"
              >
                <Text className="text-primary font-semibold text-lg">
                  Use PIN Code
                </Text>
              </Pressable>

              {/* Skip Authentication */}
              <Pressable
                onPress={handleSkipAuth}
                disabled={isLoading}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
                className="p-4 items-center"
              >
                <Text className="text-muted font-medium">
                  Skip for now
                </Text>
              </Pressable>
            </View>
          ) : (
            /* PIN Setup Form */
            <View className="w-full gap-4">
              <Text className="text-2xl font-bold text-foreground text-center">
                Set Your PIN
              </Text>

              <TextInput
                placeholder="Enter 4-digit PIN"
                placeholderTextColor={colors.muted}
                secureTextEntry
                keyboardType="numeric"
                maxLength={6}
                value={pin}
                onChangeText={setPin}
                className="bg-surface border border-border rounded-xl p-4 text-foreground"
              />

              <TextInput
                placeholder="Confirm PIN"
                placeholderTextColor={colors.muted}
                secureTextEntry
                keyboardType="numeric"
                maxLength={6}
                value={confirmPin}
                onChangeText={setConfirmPin}
                className="bg-surface border border-border rounded-xl p-4 text-foreground"
              />

              <Pressable
                onPress={handlePinSetup}
                disabled={isLoading}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
                className="bg-primary rounded-2xl p-4 items-center"
              >
                <Text className="text-white font-semibold text-lg">
                  {isLoading ? 'Setting up...' : 'Set PIN'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowPinSetup(false);
                  setPin('');
                  setConfirmPin('');
                }}
                disabled={isLoading}
                className="p-4 items-center"
              >
                <Text className="text-muted font-medium">
                  Back
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
