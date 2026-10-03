import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ActivityLog {
  id: string;
  action: string;
  category: "task" | "goal" | "note" | "chat" | "setting" | "auth" | "system";
  userId?: string;
  itemId?: string;
  details?: Record<string, any>;
  timestamp: number;
  duration?: number;
  status: "success" | "failure" | "pending";
  ipAddress?: string;
  deviceInfo?: string;
}

export function useActivityLogging() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  // Log activity
  const logActivity = useCallback(
    async (
      action: string,
      category: ActivityLog["category"],
      details?: Record<string, any>,
      status: ActivityLog["status"] = "success"
    ) => {
      try {
        const log: ActivityLog = {
          id: `log-${Date.now()}`,
          action,
          category,
          details,
          timestamp: Date.now(),
          status,
        };

        setLogs((prev) => [log, ...prev]);

        // Save to storage
        const stored = await AsyncStorage.getItem("activity_logs");
        const allLogs = stored ? JSON.parse(stored) : [];
        await AsyncStorage.setItem(
          "activity_logs",
          JSON.stringify([...allLogs, log])
        );

        return log;
      } catch (error) {
        console.error("Log activity error:", error);
        return null;
      }
    },
    []
  );

  // Get logs by category
  const getLogsByCategory = useCallback(
    (category: ActivityLog["category"]) => {
      return logs.filter((log) => log.category === category);
    },
    [logs]
  );

  // Get logs by action
  const getLogsByAction = useCallback(
    (action: string) => {
      return logs.filter((log) => log.action === action);
    },
    [logs]
  );

  // Get logs for date range
  const getLogsInRange = useCallback(
    (startDate: Date, endDate: Date) => {
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();

      return logs.filter(
        (log) => log.timestamp >= startTime && log.timestamp <= endTime
      );
    },
    [logs]
  );

  // Get user activity timeline
  const getActivityTimeline = useCallback(
    (limit = 50) => {
      return logs.slice(0, limit);
    },
    [logs]
  );

  // Get activity statistics
  const getActivityStats = useCallback(() => {
    const stats = {
      totalActivities: logs.length,
      successCount: logs.filter((l) => l.status === "success").length,
      failureCount: logs.filter((l) => l.status === "failure").length,
      pendingCount: logs.filter((l) => l.status === "pending").length,
      byCategory: {} as Record<string, number>,
      byAction: {} as Record<string, number>,
    };

    logs.forEach((log) => {
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
    });

    return stats;
  }, [logs]);

  // Get most active times
  const getMostActiveTimes = useCallback(() => {
    const hourCounts = new Array(24).fill(0);

    logs.forEach((log) => {
      const hour = new Date(log.timestamp).getHours();
      hourCounts[hour]++;
    });

    return hourCounts;
  }, [logs]);

  // Export activity logs
  const exportLogs = useCallback(
    (format: "json" | "csv" = "json") => {
      if (format === "json") {
        return JSON.stringify(logs, null, 2);
      }

      // CSV format
      const headers = ["ID", "Action", "Category", "Status", "Timestamp"];
      const rows = logs.map((log) => [
        log.id,
        log.action,
        log.category,
        log.status,
        new Date(log.timestamp).toISOString(),
      ]);

      const csv = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");

      return csv;
    },
    [logs]
  );

  // Clear old logs
  const clearOldLogs = useCallback(
    async (daysOld = 30) => {
      try {
        const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
        const updated = logs.filter((log) => log.timestamp > cutoffTime);

        setLogs(updated);

        await AsyncStorage.setItem("activity_logs", JSON.stringify(updated));

        return {
          success: true,
          removed: logs.length - updated.length,
        };
      } catch (error) {
        console.error("Clear old logs error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to clear logs",
        };
      }
    },
    [logs]
  );

  // Search logs
  const searchLogs = useCallback(
    (query: string) => {
      return logs.filter(
        (log) =>
          log.action.toLowerCase().includes(query.toLowerCase()) ||
          log.category.toLowerCase().includes(query.toLowerCase())
      );
    },
    [logs]
  );

  return {
    logs,
    logActivity,
    getLogsByCategory,
    getLogsByAction,
    getLogsInRange,
    getActivityTimeline,
    getActivityStats,
    getMostActiveTimes,
    exportLogs,
    clearOldLogs,
    searchLogs,
  };
}
