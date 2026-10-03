import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Shortcut {
  id: string;
  name: string;
  description?: string;
  action: string;
  params?: Record<string, any>;
  icon?: string;
  color?: string;
  pinned: boolean;
  usageCount: number;
  createdAt: Date;
  lastUsedAt?: Date;
}

export function useShortcuts() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);

  // Create shortcut
  const createShortcut = useCallback(
    async (
      name: string,
      action: string,
      params?: Record<string, any>,
      icon?: string
    ) => {
      try {
        const shortcut: Shortcut = {
          id: `shortcut-${Date.now()}`,
          name,
          action,
          params,
          icon,
          pinned: false,
          usageCount: 0,
          createdAt: new Date(),
        };

        setShortcuts((prev) => [shortcut, ...prev]);

        const stored = await AsyncStorage.getItem("shortcuts");
        const allShortcuts = stored ? JSON.parse(stored) : [];
        await AsyncStorage.setItem(
          "shortcuts",
          JSON.stringify([...allShortcuts, shortcut])
        );

        return { success: true, shortcut };
      } catch (error) {
        console.error("Create shortcut error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to create shortcut",
        };
      }
    },
    []
  );

  // Execute shortcut
  const executeShortcut = useCallback(
    async (shortcutId: string) => {
      try {
        const shortcut = shortcuts.find((s) => s.id === shortcutId);
        if (!shortcut) {
          return { success: false, error: "Shortcut not found" };
        }

        // Update usage
        const updated = shortcuts.map((s) =>
          s.id === shortcutId
            ? {
                ...s,
                usageCount: s.usageCount + 1,
                lastUsedAt: new Date(),
              }
            : s
        );

        setShortcuts(updated);
        await AsyncStorage.setItem("shortcuts", JSON.stringify(updated));

        return {
          success: true,
          action: shortcut.action,
          params: shortcut.params,
        };
      } catch (error) {
        console.error("Execute shortcut error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to execute shortcut",
        };
      }
    },
    [shortcuts]
  );

  // Pin shortcut
  const pinShortcut = useCallback(
    async (shortcutId: string) => {
      try {
        const updated = shortcuts.map((s) =>
          s.id === shortcutId ? { ...s, pinned: true } : s
        );

        setShortcuts(updated);
        await AsyncStorage.setItem("shortcuts", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Pin shortcut error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to pin shortcut",
        };
      }
    },
    [shortcuts]
  );

  // Unpin shortcut
  const unpinShortcut = useCallback(
    async (shortcutId: string) => {
      try {
        const updated = shortcuts.map((s) =>
          s.id === shortcutId ? { ...s, pinned: false } : s
        );

        setShortcuts(updated);
        await AsyncStorage.setItem("shortcuts", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Unpin shortcut error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to unpin shortcut",
        };
      }
    },
    [shortcuts]
  );

  // Delete shortcut
  const deleteShortcut = useCallback(
    async (shortcutId: string) => {
      try {
        const updated = shortcuts.filter((s) => s.id !== shortcutId);
        setShortcuts(updated);
        await AsyncStorage.setItem("shortcuts", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Delete shortcut error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to delete shortcut",
        };
      }
    },
    [shortcuts]
  );

  // Get pinned shortcuts
  const getPinnedShortcuts = useCallback(() => {
    return shortcuts.filter((s) => s.pinned);
  }, [shortcuts]);

  // Get frequently used shortcuts
  const getFrequentlyUsed = useCallback((limit = 5) => {
    return shortcuts
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }, [shortcuts]);

  // Get recently used shortcuts
  const getRecentlyUsed = useCallback((limit = 5) => {
    return shortcuts
      .filter((s) => s.lastUsedAt)
      .sort((a, b) => (b.lastUsedAt?.getTime() || 0) - (a.lastUsedAt?.getTime() || 0))
      .slice(0, limit);
  }, [shortcuts]);

  return {
    shortcuts,
    createShortcut,
    executeShortcut,
    pinShortcut,
    unpinShortcut,
    deleteShortcut,
    getPinnedShortcuts,
    getFrequentlyUsed,
    getRecentlyUsed,
  };
}
