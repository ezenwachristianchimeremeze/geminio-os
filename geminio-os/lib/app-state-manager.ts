import React from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

/**
 * App State Manager
 * Handles app lifecycle, offline detection, background tasks, and notifications
 */

const BACKGROUND_FETCH_TASK = 'background-data-sync';
const OFFLINE_QUEUE_KEY = 'offline-request-queue';

interface OfflineRequest {
  id: string;
  method: string;
  url: string;
  data?: any;
  timestamp: number;
}

interface AppStateConfig {
  onAppForeground?: () => void;
  onAppBackground?: () => void;
  onOfflineDetected?: () => void;
  onOnlineRestored?: () => void;
  onBackgroundFetch?: () => Promise<void>;
}

let isOnline = true;
let offlineQueue: OfflineRequest[] = [];
let appStateSubscription: any = null;
let networkSubscription: any = null;

/**
 * Initialize app state management
 */
export async function initializeAppStateManager(config: AppStateConfig = {}) {
  // Setup app state listener
  setupAppStateListener(config);

  // Setup network connectivity listener
  setupNetworkListener(config);

  // Setup background fetch
  await setupBackgroundFetch(config);

  // Setup notifications
  await setupNotifications();

  // Load offline queue from storage
  await loadOfflineQueue();
}

/**
 * Setup app state listener for foreground/background transitions
 */
function setupAppStateListener(config: AppStateConfig) {
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  async function handleAppStateChange(state: AppStateStatus) {
    if (state === 'active') {
      // App has come to foreground
      config.onAppForeground?.();
      // Process offline queue
      await processOfflineQueue();
    } else if (state === 'background') {
      // App has gone to background
      config.onAppBackground?.();
    }
  }
}

/**
 * Setup network connectivity listener
 */
function setupNetworkListener(config: AppStateConfig) {
  // Network listener setup would go here
  // For now, we'll assume the device is online
  isOnline = true;
}

/**
 * Setup background fetch for periodic data sync
 */
async function setupBackgroundFetch(config: AppStateConfig) {
  try {
    // Background fetch setup would go here
    // For now, we'll just call the handler periodically
    setInterval(() => {
      config.onBackgroundFetch?.().catch(error => {
        console.error('Background fetch error:', error);
      });
    }, 60 * 15 * 1000); // 15 minutes
  } catch (error) {
    console.error('Failed to setup background fetch:', error);
  }
}

/**
 * Setup notifications
 */
async function setupNotifications() {
  // Request notification permissions
  const { status } = await Notifications.requestPermissionsAsync();

  if (status !== 'granted') {
    console.warn('Notification permissions not granted');
    return;
  }

  // Set notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification({
  title,
  body,
  data = {},
  delaySeconds = 5,
}: {
  title: string;
  body: string;
  data?: Record<string, any>;
  delaySeconds?: number;
}) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        badge: 1,
      },
      trigger: { seconds: delaySeconds },
    } as any);
  } catch (error) {
    console.error('Failed to schedule notification:', error);
  }
}

/**
 * Send in-app notification (toast/snackbar)
 */
export async function showInAppNotification({
  type = 'info',
  message,
  duration = 3000,
}: {
  type?: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}) {
  // This would typically trigger a toast/snackbar UI component
  // For now, we'll just log it
  console.log(`[${type.toUpperCase()}] ${message}`);

  // In a real implementation, this would dispatch to a notification context
  // that displays a toast/snackbar UI component
}

/**
 * Queue a request for offline retry
 */
export async function queueOfflineRequest(
  method: string,
  url: string,
  data?: any
) {
  const request: OfflineRequest = {
    id: `${Date.now()}-${Math.random()}`,
    method,
    url,
    data,
    timestamp: Date.now(),
  };

  offlineQueue.push(request);
  await saveOfflineQueue();
}

/**
 * Load offline queue from storage
 */
async function loadOfflineQueue() {
  try {
    const stored = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (stored) {
      offlineQueue = JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load offline queue:', error);
  }
}

/**
 * Save offline queue to storage
 */
async function saveOfflineQueue() {
  try {
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue));
  } catch (error) {
    console.error('Failed to save offline queue:', error);
  }
}

/**
 * Process offline queue and retry requests
 */
async function processOfflineQueue() {
  if (!isOnline || offlineQueue.length === 0) {
    return;
  }

  const failedRequests: OfflineRequest[] = [];

  for (const request of offlineQueue) {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: request.data ? JSON.stringify(request.data) : undefined,
      });

      if (!response.ok) {
        failedRequests.push(request);
      }
    } catch (error) {
      console.error(`Failed to process offline request ${request.id}:`, error);
      failedRequests.push(request);
    }
  }

  // Update queue with failed requests
  offlineQueue = failedRequests;
  await saveOfflineQueue();

  if (failedRequests.length === 0) {
    await showInAppNotification({
      type: 'success',
      message: 'All offline requests synced successfully',
    });
  }
}

/**
 * Check if device is online
 */
export function isDeviceOnline(): boolean {
  return isOnline;
}

/**
 * Get current network status
 */
export async function getNetworkStatus() {
  return {
    isConnected: isOnline,
    isInternetReachable: isOnline,
  };
}

/**
 * Cleanup app state manager
 */
export function cleanupAppStateManager() {
  appStateSubscription?.remove();
  networkSubscription?.remove();
}

/**
 * Hook for app state management
 */
export function useAppState(config: AppStateConfig = {}) {
  const [online, setOnline] = React.useState(isOnline);
  const [queueLength, setQueueLength] = React.useState(offlineQueue.length);

  React.useEffect(() => {
    initializeAppStateManager(config);
    
    const interval = setInterval(() => {
      setOnline(isOnline);
      setQueueLength(offlineQueue.length);
    }, 1000);

    return () => {
      clearInterval(interval);
      cleanupAppStateManager();
    };
  }, [config]);

  return {
    isOnline: online,
    offlineQueueLength: queueLength,
  };
}
