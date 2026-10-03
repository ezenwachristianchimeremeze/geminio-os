import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

export interface BackupData {
  id: string;
  timestamp: number;
  size: number;
  itemCount: number;
  version: string;
  data: Record<string, any>;
}

export function useBackup() {
  const [backups, setBackups] = useState<BackupData[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Create backup
  const createBackup = useCallback(async () => {
    try {
      setIsBackingUp(true);

      // Collect all data
      const keys = await AsyncStorage.getAllKeys();
      const data: Record<string, any> = {};
      let itemCount = 0;

      for (const key of keys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            data[key] = JSON.parse(value);
            itemCount++;
          }
        } catch (error) {
          console.error(`Error reading key ${key}:`, error);
        }
      }

      // Create backup object
      const backup: BackupData = {
        id: `backup-${Date.now()}`,
        timestamp: Date.now(),
        size: JSON.stringify(data).length,
        itemCount,
        version: "1.0.0",
        data,
      };

      setBackups((prev) => [backup, ...prev]);

      // Save backup to file
      const filename = `geminio-backup-${new Date().toISOString().split("T")[0]}.json`;
      const filepath = `${FileSystem.documentDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(filepath, JSON.stringify(backup, null, 2), {
        encoding: "utf8" as any,
      });

      return {
        success: true,
        backup,
        filepath,
        filename,
      };
    } catch (error) {
      console.error("Backup error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Backup failed",
      };
    } finally {
      setIsBackingUp(false);
    }
  }, []);

  // Restore backup
  const restoreBackup = useCallback(async (backup: BackupData) => {
    try {
      setIsRestoring(true);

      // Restore all data
      for (const [key, value] of Object.entries(backup.data)) {
        try {
          await AsyncStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
          console.error(`Error restoring key ${key}:`, error);
        }
      }

      return {
        success: true,
        restoredItems: backup.itemCount,
      };
    } catch (error) {
      console.error("Restore error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Restore failed",
      };
    } finally {
      setIsRestoring(false);
    }
  }, []);

  // Schedule automatic backups
  const scheduleAutoBackup = useCallback(
    (intervalMinutes = 60) => {
      const interval = setInterval(() => {
        createBackup();
      }, intervalMinutes * 60 * 1000);

      return () => clearInterval(interval);
    },
    [createBackup]
  );

  // Delete backup
  const deleteBackup = useCallback((backupId: string) => {
    setBackups((prev) => prev.filter((b) => b.id !== backupId));
  }, []);

  // Get backup size
  const getBackupSize = useCallback((backup: BackupData) => {
    const bytes = backup.size;
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }, []);

  // Export backup
  const exportBackup = useCallback(async (backup: BackupData) => {
    try {
      const filename = `geminio-backup-${new Date(backup.timestamp).toISOString().split("T")[0]}.json`;
      const filepath = `${FileSystem.documentDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(filepath, JSON.stringify(backup, null, 2), {
        encoding: "utf8" as any,
      });

      return {
        success: true,
        filepath,
        filename,
      };
    } catch (error) {
      console.error("Export error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Export failed",
      };
    }
  }, []);

  // Import backup
  const importBackup = useCallback(async (filepath: string) => {
    try {
      const content = await FileSystem.readAsStringAsync(filepath);
      const backup: BackupData = JSON.parse(content);

      // Validate backup
      if (!backup.id || !backup.timestamp || !backup.data) {
        return {
          success: false,
          error: "Invalid backup file",
        };
      }

      setBackups((prev) => [backup, ...prev]);

      return {
        success: true,
        backup,
      };
    } catch (error) {
      console.error("Import error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Import failed",
      };
    }
  }, []);

  // Get backup statistics
  const getBackupStats = useCallback(() => {
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    const oldestBackup = backups[backups.length - 1];
    const newestBackup = backups[0];

    return {
      backupCount: backups.length,
      totalSize,
      oldestBackup: oldestBackup?.timestamp,
      newestBackup: newestBackup?.timestamp,
      averageSize: backups.length > 0 ? totalSize / backups.length : 0,
    };
  }, [backups]);

  // Clean old backups
  const cleanOldBackups = useCallback((keepCount = 5) => {
    const toDelete = backups.slice(keepCount);
    setBackups((prev) => prev.slice(0, keepCount));
    return toDelete;
  }, [backups]);

  return {
    backups,
    isBackingUp,
    isRestoring,
    createBackup,
    restoreBackup,
    scheduleAutoBackup,
    deleteBackup,
    getBackupSize,
    exportBackup,
    importBackup,
    getBackupStats,
    cleanOldBackups,
  };
}
