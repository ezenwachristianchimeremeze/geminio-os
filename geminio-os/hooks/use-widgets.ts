import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Widget {
  id: string;
  type: "stats" | "chart" | "list" | "calendar" | "weather" | "notes" | "shortcuts" | "custom";
  title: string;
  size: "small" | "medium" | "large";
  position: { row: number; column: number };
  enabled: boolean;
  refreshInterval?: number;
  data?: Record<string, any>;
  createdAt: Date;
}

export function useWidgets() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [layout, setLayout] = useState<"grid" | "list" | "custom">("grid");

  // Create widget
  const createWidget = useCallback(
    async (
      type: Widget["type"],
      title: string,
      size: Widget["size"] = "medium"
    ) => {
      try {
        const widget: Widget = {
          id: `widget-${Date.now()}`,
          type,
          title,
          size,
          position: { row: 0, column: 0 },
          enabled: true,
          createdAt: new Date(),
        };

        setWidgets((prev) => [widget, ...prev]);

        const stored = await AsyncStorage.getItem("widgets");
        const allWidgets = stored ? JSON.parse(stored) : [];
        await AsyncStorage.setItem(
          "widgets",
          JSON.stringify([...allWidgets, widget])
        );

        return { success: true, widget };
      } catch (error) {
        console.error("Create widget error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to create widget",
        };
      }
    },
    []
  );

  // Update widget position
  const updateWidgetPosition = useCallback(
    async (widgetId: string, row: number, column: number) => {
      try {
        const updated = widgets.map((w) =>
          w.id === widgetId
            ? { ...w, position: { row, column } }
            : w
        );

        setWidgets(updated);
        await AsyncStorage.setItem("widgets", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Update position error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update position",
        };
      }
    },
    [widgets]
  );

  // Toggle widget
  const toggleWidget = useCallback(
    async (widgetId: string) => {
      try {
        const updated = widgets.map((w) =>
          w.id === widgetId ? { ...w, enabled: !w.enabled } : w
        );

        setWidgets(updated);
        await AsyncStorage.setItem("widgets", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Toggle widget error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to toggle widget",
        };
      }
    },
    [widgets]
  );

  // Delete widget
  const deleteWidget = useCallback(
    async (widgetId: string) => {
      try {
        const updated = widgets.filter((w) => w.id !== widgetId);
        setWidgets(updated);
        await AsyncStorage.setItem("widgets", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Delete widget error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to delete widget",
        };
      }
    },
    [widgets]
  );

  // Update widget data
  const updateWidgetData = useCallback(
    async (widgetId: string, data: Record<string, any>) => {
      try {
        const updated = widgets.map((w) =>
          w.id === widgetId ? { ...w, data } : w
        );

        setWidgets(updated);
        await AsyncStorage.setItem("widgets", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Update data error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update data",
        };
      }
    },
    [widgets]
  );

  // Get enabled widgets
  const getEnabledWidgets = useCallback(() => {
    return widgets.filter((w) => w.enabled).sort((a, b) => {
      if (a.position.row !== b.position.row) {
        return a.position.row - b.position.row;
      }
      return a.position.column - b.position.column;
    });
  }, [widgets]);

  // Set layout
  const setLayoutType = useCallback(
    async (layoutType: "grid" | "list" | "custom") => {
      try {
        setLayout(layoutType);
        await AsyncStorage.setItem("widget_layout", layoutType);
        return { success: true };
      } catch (error) {
        console.error("Set layout error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to set layout",
        };
      }
    },
    []
  );

  // Reset to default layout
  const resetToDefault = useCallback(async () => {
    try {
      const defaultWidgets: Widget[] = [
        {
          id: "widget-stats",
          type: "stats",
          title: "Today's Stats",
          size: "medium",
          position: { row: 0, column: 0 },
          enabled: true,
          createdAt: new Date(),
        },
        {
          id: "widget-calendar",
          type: "calendar",
          title: "Calendar",
          size: "large",
          position: { row: 1, column: 0 },
          enabled: true,
          createdAt: new Date(),
        },
        {
          id: "widget-shortcuts",
          type: "shortcuts",
          title: "Quick Actions",
          size: "medium",
          position: { row: 2, column: 0 },
          enabled: true,
          createdAt: new Date(),
        },
      ];

      setWidgets(defaultWidgets);
      setLayout("grid");
      await AsyncStorage.setItem("widgets", JSON.stringify(defaultWidgets));
      await AsyncStorage.setItem("widget_layout", "grid");

      return { success: true };
    } catch (error) {
      console.error("Reset error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reset",
      };
    }
  }, []);

  return {
    widgets,
    layout,
    createWidget,
    updateWidgetPosition,
    toggleWidget,
    deleteWidget,
    updateWidgetData,
    getEnabledWidgets,
    setLayoutType,
    resetToDefault,
  };
}
