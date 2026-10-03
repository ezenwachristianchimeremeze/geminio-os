import { useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";

export interface SyncData {
  id: string;
  type: "task" | "goal" | "note" | "conversation" | "setting";
  data: any;
  lastModified: number;
  deviceId: string;
  synced: boolean;
}

export function useCloudSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<SyncData[]>([]);

  // Get unique device ID
  const getDeviceId = useCallback(async () => {
    try {
      let deviceId = await AsyncStorage.getItem("device_id");
      if (!deviceId) {
        deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem("device_id", deviceId);
      }
      return deviceId;
    } catch (error) {
      console.error("Error getting device ID:", error);
      return "unknown-device";
    }
  }, []);

  // Queue data for sync
  const queueSync = useCallback(
    async (type: SyncData["type"], data: any) => {
      try {
        const deviceId = await getDeviceId();
        const syncData: SyncData = {
          id: `${Date.now()}-${Math.random()}`,
          type,
          data,
          lastModified: Date.now(),
          deviceId,
          synced: false,
        };

        setPendingChanges((prev) => [...prev, syncData]);

        // Save to local storage
        const stored = await AsyncStorage.getItem("pending_sync");
        const pending = stored ? JSON.parse(stored) : [];
        await AsyncStorage.setItem("pending_sync", JSON.stringify([...pending, syncData]));

        return syncData;
      } catch (error) {
        console.error("Queue sync error:", error);
        return null;
      }
    },
    [getDeviceId]
  );

  // Sync with backend
  const syncWithBackend = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncStatus("syncing");
    setSyncError(null);

    try {
      // Get pending changes
      const stored = await AsyncStorage.getItem("pending_sync");
      const pending: SyncData[] = stored ? JSON.parse(stored) : [];

      if (pending.length === 0) {
        setSyncStatus("success");
        setLastSyncTime(Date.now());
        setIsSyncing(false);
        return { success: true, syncedCount: 0 };
      }

      // In production, this would call your backend API
      // For now, we'll simulate syncing
      const syncedData = pending.map((item) => ({
        ...item,
        synced: true,
      }));

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Clear synced items
      await AsyncStorage.setItem("pending_sync", JSON.stringify([]));
      setPendingChanges([]);

      setSyncStatus("success");
      setLastSyncTime(Date.now());

      return {
        success: true,
        syncedCount: syncedData.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sync failed";
      setSyncError(errorMessage);
      setSyncStatus("error");

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // Pull changes from backend
  const pullChanges = useCallback(async () => {
    try {
      // In production, this would fetch from backend
      // For now, return empty array
      return {
        success: true,
        changes: [],
      };
    } catch (error) {
      console.error("Pull changes error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Pull failed",
      };
    }
  }, []);

  // Resolve conflicts
  const resolveConflict = useCallback(
    async (
      itemId: string,
      localVersion: any,
      remoteVersion: any,
      resolution: "local" | "remote" | "merge"
    ) => {
      try {
        let resolved = localVersion;

        if (resolution === "remote") {
          resolved = remoteVersion;
        } else if (resolution === "merge") {
          // Simple merge: combine properties
          resolved = {
            ...remoteVersion,
            ...localVersion,
            mergedAt: Date.now(),
          };
        }

        // Queue the resolved version for sync
        await queueSync("note", resolved);

        return { success: true, resolved };
      } catch (error) {
        console.error("Conflict resolution error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Resolution failed",
        };
      }
    },
    [queueSync]
  );

  // Auto-sync periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingChanges.length > 0) {
        syncWithBackend();
      }
    }, 30000); // Sync every 30 seconds if there are pending changes

    return () => clearInterval(interval);
  }, [pendingChanges, syncWithBackend]);

  // Get sync statistics
  const getSyncStats = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("pending_sync");
      const pending: SyncData[] = stored ? JSON.parse(stored) : [];

      return {
        pendingChanges: pending.length,
        lastSyncTime,
        syncStatus,
        isSyncing,
      };
    } catch (error) {
      console.error("Error getting sync stats:", error);
      return {
        pendingChanges: 0,
        lastSyncTime,
        syncStatus,
        isSyncing,
      };
    }
  }, [lastSyncTime, syncStatus, isSyncing]);

  return {
    isSyncing,
    syncStatus,
    lastSyncTime,
    syncError,
    pendingChanges,
    queueSync,
    syncWithBackend,
    pullChanges,
    resolveConflict,
    getSyncStats,
  };
}
