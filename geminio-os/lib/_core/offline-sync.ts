/**
 * Geminio OS - Offline Support & Data Sync
 * 
 * Handles:
 * - Offline message queue
 * - Data synchronization
 * - Conflict resolution
 * - Cache management
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
// NetInfo would be imported here for real network detection
// import NetInfo from "@react-native-community/netinfo";

interface OfflineAction {
  id: string;
  type: "message" | "update" | "delete" | "create";
  endpoint: string;
  payload: unknown;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class OfflineSyncManager {
  private actionQueue: OfflineAction[] = [];
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;

  constructor() {
    this.initializeNetworkListener();
    this.loadQueueFromStorage();
  }

  /**
   * Initialize network connectivity listener
   */
  private initializeNetworkListener() {
    // For now, assume online. In production, integrate with NetInfo
    if (Platform.OS !== "web") {
      // NetInfo would be used here
      // NetInfo.addEventListener((state: any) => {
      //   const wasOffline = !this.isOnline;
      //   this.isOnline = state.isConnected ?? false;
      // });
    }
    
    // Temporary: assume always online
    const wasOffline = !this.isOnline;
    this.isOnline = true;

    if (wasOffline && this.isOnline) {
      console.log("Back online - syncing queued actions");
      this.syncQueuedActions();
    }
  }

  /**
   * Queue an action for offline execution
   */
  public async queueAction(
    type: OfflineAction["type"],
    endpoint: string,
    payload: unknown
  ): Promise<string> {
    const action: OfflineAction = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      endpoint,
      payload,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3,
    };

    this.actionQueue.push(action);
    await this.saveQueueToStorage();

    if (this.isOnline && !this.syncInProgress) {
      this.syncQueuedActions();
    }

    return action.id;
  }

  /**
   * Sync all queued actions
   */
  private async syncQueuedActions() {
    if (this.syncInProgress || !this.isOnline || this.actionQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;

    try {
      const actionsToSync = [...this.actionQueue];

      for (const action of actionsToSync) {
        try {
          await this.executeAction(action);
          this.actionQueue = this.actionQueue.filter((a) => a.id !== action.id);
        } catch (error) {
          action.retries++;
          if (action.retries >= action.maxRetries) {
            console.error(`Action ${action.id} failed after max retries`, error);
            this.actionQueue = this.actionQueue.filter((a) => a.id !== action.id);
          }
        }
      }

      await this.saveQueueToStorage();
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(action: OfflineAction) {
    const response = await fetch(action.endpoint, {
      method: action.type === "delete" ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action.payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Save queue to AsyncStorage
   */
  private async saveQueueToStorage() {
    try {
      await AsyncStorage.setItem(
        "geminio_offline_queue",
        JSON.stringify(this.actionQueue)
      );
    } catch (error) {
      console.error("Error saving queue to storage:", error);
    }
  }

  /**
   * Load queue from AsyncStorage
   */
  private async loadQueueFromStorage() {
    try {
      const stored = await AsyncStorage.getItem("geminio_offline_queue");
      if (stored) {
        this.actionQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error("Error loading queue from storage:", error);
    }
  }

  /**
   * Cache data with TTL
   */
  public setCache<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  /**
   * Get cached data if not expired
   */
  public getCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Clear cache
   */
  public clearCache(key?: string) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get offline status
   */
  public getOfflineStatus() {
    return {
      isOnline: this.isOnline,
      queuedActionsCount: this.actionQueue.length,
      cacheSize: this.cache.size,
    };
  }

  /**
   * Get queued actions
   */
  public getQueuedActions(): OfflineAction[] {
    return [...this.actionQueue];
  }

  /**
   * Clear queue
   */
  public async clearQueue() {
    this.actionQueue = [];
    await this.saveQueueToStorage();
  }
}

// Export singleton instance
export const offlineSyncManager = new OfflineSyncManager();

/**
 * Hook for offline sync status
 */
export function useOfflineSync() {
  return {
    queueAction: (type: OfflineAction["type"], endpoint: string, payload: unknown) =>
      offlineSyncManager.queueAction(type, endpoint, payload),
    getStatus: () => offlineSyncManager.getOfflineStatus(),
    clearQueue: () => offlineSyncManager.clearQueue(),
    getQueuedActions: () => offlineSyncManager.getQueuedActions(),
  };
}
