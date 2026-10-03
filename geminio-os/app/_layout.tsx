import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform, Text, View } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { MemoryProvider } from "@/lib/memory-context";
import { DataProvider } from "@/lib/data-context";
import { ErrorBoundary } from "@/app/error-boundary";
import { VoiceOSProvider } from "@/lib/voice-os-context";
import { PermissionsProvider } from "@/lib/permissions-context";
import { MediaStudioProvider } from "@/lib/media-studio-context";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayoutContent({
  queryClient,
  trpcClient,
}: {
  queryClient: QueryClient;
  trpcClient: ReturnType<typeof createTRPCClient>;
}) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-foreground">Loading...</Text>
      </View>
    );
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="auth-screen" />
          <Stack.Screen name="auth/[flow]" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="oauth/callback" />
          <Stack.Screen name="workspace/[product]" />
          <Stack.Screen name="workspace/[product]/[section]" />
          <Stack.Screen name="module/[module]" />
          <Stack.Screen name="blueprint/[screen]" />
          <Stack.Screen name="wallet" />
          <Stack.Screen name="profile/credits" />
          <Stack.Screen name="profile/settings" />
        </Stack>
        <StatusBar style="auto" />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = <RootLayoutContent queryClient={queryClient} trpcClient={trpcClient} />;

  const shouldOverrideSafeArea = Platform.OS === "web";

  // CRITICAL FIX: GestureHandlerRootView MUST be at the top level for Android
  // It was previously nested inside providers, which caused gesture handlers to fail on Android
  if (shouldOverrideSafeArea) {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthProvider>
            <MemoryProvider>
              <DataProvider>
                <VoiceOSProvider>
                  <PermissionsProvider>
                    <MediaStudioProvider>
                      <ThemeProvider>
                        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
                          <SafeAreaFrameContext.Provider value={frame}>
                            <SafeAreaInsetsContext.Provider value={insets}>
                              {content}
                            </SafeAreaInsetsContext.Provider>
                          </SafeAreaFrameContext.Provider>
                        </SafeAreaProvider>
                      </ThemeProvider>
                    </MediaStudioProvider>
                  </PermissionsProvider>
                </VoiceOSProvider>
              </DataProvider>
            </MemoryProvider>
          </AuthProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <MemoryProvider>
            <DataProvider>
              <VoiceOSProvider>
                <PermissionsProvider>
                  <MediaStudioProvider>
                    <ThemeProvider>
                      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
                    </ThemeProvider>
                  </MediaStudioProvider>
                </PermissionsProvider>
              </VoiceOSProvider>
            </DataProvider>
          </MemoryProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
