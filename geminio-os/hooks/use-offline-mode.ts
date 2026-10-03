import { useState, useEffect, useCallback } from "react";
import { useNetInfo } from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface OfflineAction {
  id: string;
  type: "create" | "update" | "delete";
  module: string;
  data: any;
  timestamp: number;
  synced: boolean;
}

export function useOfflineMode() {
  const netInfo = useNetInfo();
  const [isOnline, setIsOnline] = useState(netInfo.isConnected ?? true);
  const [offlineActions, setOfflineActions] = useState<OfflineAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Update online status
  useEffect(() => {
    setIsOnline(netInfo.isConnected ?? true);
  }, [netInfo.isConnected]);

  // Load offline actions from storage
  useEffect(() => {
    const loadOfflineActions = async () => {
      try {
        const stored = await AsyncStorage.getItem("offline_actions");
        if (stored) {
          setOfflineActions(JSON.parse(stored));
        }
      } catch (error) {
        console.error("Error loading offline actions:", error);
      }
    };

    loadOfflineActions();
  }, []);

  // Save offline actions to storage
  const saveOfflineActions = useCallback(async (actions: OfflineAction[]) => {
    try {
      await AsyncStorage.setItem("offline_actions", JSON.stringify(actions));
      setOfflineActions(actions);
    } catch (error) {
      console.error("Error saving offline actions:", error);
    }
  }, []);

  // Queue an action for offline mode
  const queueAction = useCallback(
    async (type: "create" | "update" | "delete", module: string, data: any) => {
      const action: OfflineAction = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        module,
        data,
        timestamp: Date.now(),
        synced: false,
      };

      const updated = [...offlineActions, action];
      await saveOfflineActions(updated);

      return action;
    },
    [offlineActions, saveOfflineActions]
  );

  // Sync offline actions when back online
  const syncOfflineActions = useCallback(async () => {
    if (!isOnline || offlineActions.length === 0) return;

    setIsSyncing(true);

    try {
      // Simulate syncing - in production, this would call your backend
      const syncedActions = offlineActions.map((action) => ({
        ...action,
        synced: true,
      }));

      // Wait for simulated sync
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Clear synced actions
      const remaining = syncedActions.filter((a) => !a.synced);
      await saveOfflineActions(remaining);

      return {
        success: true,
        syncedCount: syncedActions.filter((a) => a.synced).length,
      };
    } catch (error) {
      console.error("Sync error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      };
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, offlineActions, saveOfflineActions]);

  // Auto-sync when connection is restored
  useEffect(() => {
    if (isOnline && offlineActions.some((a) => !a.synced)) {
      syncOfflineActions();
    }
  }, [isOnline, offlineActions, syncOfflineActions]);

  // Get local data (cached version)
  const getLocalData = useCallback(
    async (module: string, key: string) => {
      try {
        const stored = await AsyncStorage.getItem(`${module}:${key}`);
        return stored ? JSON.parse(stored) : null;
      } catch (error) {
        console.error("Error getting local data:", error);
        return null;
      }
    },
    []
  );

  // Save local data (cache)
  const saveLocalData = useCallback(
    async (module: string, key: string, data: any) => {
      try {
        await AsyncStorage.setItem(`${module}:${key}`, JSON.stringify(data));
        return true;
      } catch (error) {
        console.error("Error saving local data:", error);
        return false;
      }
    },
    []
  );

  // Clear offline actions
  const clearOfflineActions = useCallback(async () => {
    await saveOfflineActions([]);
  }, [saveOfflineActions]);

  return {
    isOnline,
    offlineActions,
    isSyncing,
    queueAction,
    syncOfflineActions,
    getLocalData,
    saveLocalData,
    clearOfflineActions,
  };
}
