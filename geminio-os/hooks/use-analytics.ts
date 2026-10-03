import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface AnalyticsEvent {
  id: string;
  name: string;
  category: string;
  timestamp: number;
  data?: Record<string, any>;
}

export interface AnalyticsReport {
  period: "day" | "week" | "month";
  startDate: Date;
  endDate: Date;
  events: AnalyticsEvent[];
  summary: Record<string, any>;
}

export function useAnalytics() {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(true);

  // Track event
  const trackEvent = useCallback(
    async (
      name: string,
      category: string,
      data?: Record<string, any>
    ) => {
      if (!isTrackingEnabled) return;

      try {
        const event: AnalyticsEvent = {
          id: `${Date.now()}-${Math.random()}`,
          name,
          category,
          timestamp: Date.now(),
          data,
        };

        setEvents((prev) => [...prev, event]);

        // Save to storage
        const stored = await AsyncStorage.getItem("analytics_events");
        const allEvents = stored ? JSON.parse(stored) : [];
        await AsyncStorage.setItem(
          "analytics_events",
          JSON.stringify([...allEvents, event])
        );

        return event;
      } catch (error) {
        console.error("Track event error:", error);
        return null;
      }
    },
    [isTrackingEnabled]
  );

  // Track page view
  const trackPageView = useCallback(
    (pageName: string, properties?: Record<string, any>) => {
      return trackEvent("page_view", "navigation", {
        page: pageName,
        ...properties,
      });
    },
    [trackEvent]
  );

  // Track user action
  const trackUserAction = useCallback(
    (action: string, properties?: Record<string, any>) => {
      return trackEvent("user_action", "engagement", {
        action,
        ...properties,
      });
    },
    [trackEvent]
  );

  // Track error
  const trackError = useCallback(
    (errorName: string, errorMessage: string, stackTrace?: string) => {
      return trackEvent("error", "error", {
        errorName,
        errorMessage,
        stackTrace,
      });
    },
    [trackEvent]
  );

  // Get events for date range
  const getEventsInRange = useCallback(
    (startDate: Date, endDate: Date) => {
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();

      return events.filter(
        (event) => event.timestamp >= startTime && event.timestamp <= endTime
      );
    },
    [events]
  );

  // Get events by category
  const getEventsByCategory = useCallback(
    (category: string) => {
      return events.filter((event) => event.category === category);
    },
    [events]
  );

  // Generate report
  const generateReport = useCallback(
    (period: "day" | "week" | "month" = "week"): AnalyticsReport => {
      const now = new Date();
      let startDate = new Date();

      switch (period) {
        case "day":
          startDate.setDate(now.getDate() - 1);
          break;
        case "week":
          startDate.setDate(now.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(now.getMonth() - 1);
          break;
      }

      const rangeEvents = getEventsInRange(startDate, now);

      // Calculate summary
      const summary: Record<string, any> = {
        totalEvents: rangeEvents.length,
        eventsByCategory: {},
        eventsByName: {},
        topEvents: [],
      };

      rangeEvents.forEach((event) => {
        // Count by category
        summary.eventsByCategory[event.category] =
          (summary.eventsByCategory[event.category] || 0) + 1;

        // Count by name
        summary.eventsByName[event.name] =
          (summary.eventsByName[event.name] || 0) + 1;
      });

      // Get top events
      summary.topEvents = Object.entries(summary.eventsByName)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

      return {
        period,
        startDate,
        endDate: now,
        events: rangeEvents,
        summary,
      };
    },
    [getEventsInRange]
  );

  // Get productivity metrics
  const getProductivityMetrics = useCallback(() => {
    const report = generateReport("week");

    const metrics = {
      tasksCompleted: report.summary.eventsByName["task_completed"] || 0,
      goalsUpdated: report.summary.eventsByName["goal_updated"] || 0,
      notesCreated: report.summary.eventsByName["note_created"] || 0,
      chatMessages: report.summary.eventsByName["chat_message"] || 0,
      averageSessionDuration: 0,
    };

    // Calculate average session duration
    const sessionEvents = report.events.filter(
      (e) => e.category === "session"
    );
    if (sessionEvents.length > 0) {
      const totalDuration = sessionEvents.reduce(
        (sum, e) => sum + (e.data?.duration || 0),
        0
      );
      metrics.averageSessionDuration = totalDuration / sessionEvents.length;
    }

    return metrics;
  }, [generateReport]);

  // Export analytics
  const exportAnalytics = useCallback(
    (format: "json" | "csv" = "json") => {
      const report = generateReport("month");

      if (format === "json") {
        return JSON.stringify(report, null, 2);
      }

      // CSV format
      const headers = ["ID", "Name", "Category", "Timestamp"];
      const rows = report.events.map((event) => [
        event.id,
        event.name,
        event.category,
        new Date(event.timestamp).toISOString(),
      ]);

      const csv = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");

      return csv;
    },
    [generateReport]
  );

  // Clear analytics
  const clearAnalytics = useCallback(async () => {
    setEvents([]);
    await AsyncStorage.removeItem("analytics_events");
  }, []);

  // Toggle tracking
  const toggleTracking = useCallback((enabled: boolean) => {
    setIsTrackingEnabled(enabled);
  }, []);

  return {
    events,
    isTrackingEnabled,
    trackEvent,
    trackPageView,
    trackUserAction,
    trackError,
    getEventsInRange,
    getEventsByCategory,
    generateReport,
    getProductivityMetrics,
    exportAnalytics,
    clearAnalytics,
    toggleTracking,
  };
}
