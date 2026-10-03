import { useState, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;
  hits: number;
}

export function useCache<T = any>(namespace = "cache") {
  const [cache, setCache] = useState<Map<string, CacheEntry<T>>>(new Map());
  const cacheRef = useRef(cache);

  // Set cache entry
  const set = useCallback(
    async (key: string, value: T, ttl?: number) => {
      try {
        const entry: CacheEntry<T> = {
          key,
          value,
          timestamp: Date.now(),
          ttl,
          hits: 0,
        };

        cacheRef.current.set(key, entry);
        setCache(new Map(cacheRef.current));

        // Also save to AsyncStorage for persistence
        await AsyncStorage.setItem(
          `${namespace}:${key}`,
          JSON.stringify(entry)
        );

        return true;
      } catch (error) {
        console.error("Cache set error:", error);
        return false;
      }
    },
    [namespace]
  );

  // Get cache entry
  const get = useCallback(
    async (key: string): Promise<T | null> => {
      try {
        let entry = cacheRef.current.get(key);

        // If not in memory, try AsyncStorage
        if (!entry) {
          const stored = await AsyncStorage.getItem(`${namespace}:${key}`);
          if (stored) {
            entry = JSON.parse(stored) as CacheEntry<T>;
            cacheRef.current.set(key, entry);
          }
        }

        if (!entry) return null;

        // Check if expired
        if (entry.ttl) {
          const age = Date.now() - entry.timestamp;
          if (age > entry.ttl) {
            await remove(key);
            return null;
          }
        }

        // Increment hits
        entry.hits++;
        const updated: CacheEntry<T> = { ...entry };
        cacheRef.current.set(key, updated);
        setCache(new Map(cacheRef.current));

        return updated.value;
      } catch (error) {
        console.error("Cache get error:", error);
        return null;
      }
    },
    [namespace]
  );

  // Remove cache entry
  const remove = useCallback(
    async (key: string) => {
      try {
        cacheRef.current.delete(key);
        setCache(new Map(cacheRef.current));
        await AsyncStorage.removeItem(`${namespace}:${key}`);
        return true;
      } catch (error) {
        console.error("Cache remove error:", error);
        return false;
      }
    },
    [namespace]
  );

  // Clear all cache
  const clear = useCallback(async () => {
    try {
      cacheRef.current.clear();
      setCache(new Map());

      // Clear AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(`${namespace}:`));
      await AsyncStorage.multiRemove(cacheKeys);

      return true;
    } catch (error) {
      console.error("Cache clear error:", error);
      return false;
    }
  }, [namespace]);

  // Get or set (compute if not cached)
  const getOrSet = useCallback(
    async (key: string, compute: () => Promise<T>, ttl?: number) => {
      const cached = await get(key);
      if (cached !== null) return cached;

      const value = await compute();
      await set(key, value, ttl);
      return value;
    },
    [get, set]
  );

  // Get cache statistics
  const getStats = useCallback(() => {
    const entries = Array.from(cacheRef.current.values());
    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);
    const totalSize = entries.reduce(
      (sum, e) => sum + JSON.stringify(e.value).length,
      0
    );

    return {
      size: cacheRef.current.size,
      totalHits,
      averageHits: entries.length > 0 ? totalHits / entries.length : 0,
      totalSize,
      averageEntrySize: entries.length > 0 ? totalSize / entries.length : 0,
    };
  }, []);

  // Cleanup expired entries
  const cleanup = useCallback(async () => {
    try {
      const entries = Array.from(cacheRef.current.entries());
      let removed = 0;

      for (const [key, entry] of entries) {
        if (entry.ttl) {
          const age = Date.now() - entry.timestamp;
          if (age > entry.ttl) {
            await remove(key);
            removed++;
          }
        }
      }

      return { success: true, removed };
    } catch (error) {
      console.error("Cleanup error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Cleanup failed",
      };
    }
  }, [remove]);

  return {
    set,
    get,
    remove,
    clear,
    getOrSet,
    getStats,
    cleanup,
  };
}
