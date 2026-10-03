import { useState, useCallback } from "react";
import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  isAllDay: boolean;
  reminders?: number[]; // minutes before
  linkedItemId?: string; // Link to task/goal/event
  linkedItemType?: "task" | "goal" | "meeting";
}

export function useCalendarIntegration() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendarPermission, setCalendarPermission] = useState<string>("undetermined");
  const [linkedCalendarId, setLinkedCalendarId] = useState<string | null>(null);

  // Request calendar permissions
  const requestCalendarPermission = useCallback(async () => {
    if (Platform.OS === "web") {
      // Web doesn't have native calendar access
      return false;
    }

    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      setCalendarPermission(status);
      return status === "granted";
    } catch (error) {
      console.error("Error requesting calendar permission:", error);
      return false;
    }
  }, []);

  // Create calendar event
  const createEvent = useCallback(
    async (event: CalendarEvent) => {
      try {
        const hasPermission = await requestCalendarPermission();
        if (!hasPermission && Platform.OS !== "web") {
          return { success: false, error: "Calendar permission denied" };
        }

        // Save to local storage
        const updated = [...events, event];
        setEvents(updated);
        await AsyncStorage.setItem("calendar_events", JSON.stringify(updated));

        // If native calendar is available, create event there too
        if (Platform.OS !== "web" && linkedCalendarId) {
          try {
            const eventId = await Calendar.createEventAsync(linkedCalendarId, {
              title: event.title,
              startDate: event.startDate,
              endDate: event.endDate,
              notes: event.description,
              location: event.location,
              allDay: event.isAllDay,
              alarms: event.reminders?.map((minutes) => ({
                relativeOffset: -minutes,
              })),
            });

            return {
              success: true,
              event: { ...event, id: eventId },
            };
          } catch (error) {
            console.error("Error creating native calendar event:", error);
            // Still return success as event was saved locally
            return { success: true, event };
          }
        }

        return { success: true, event };
      } catch (error) {
        console.error("Create event error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to create event",
        };
      }
    },
    [events, linkedCalendarId, requestCalendarPermission]
  );

  // Update event
  const updateEvent = useCallback(
    async (eventId: string, updates: Partial<CalendarEvent>) => {
      try {
        const updated = events.map((e) => (e.id === eventId ? { ...e, ...updates } : e));
        setEvents(updated);
        await AsyncStorage.setItem("calendar_events", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Update event error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update event",
        };
      }
    },
    [events]
  );

  // Delete event
  const deleteEvent = useCallback(
    async (eventId: string) => {
      try {
        const updated = events.filter((e) => e.id !== eventId);
        setEvents(updated);
        await AsyncStorage.setItem("calendar_events", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Delete event error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to delete event",
        };
      }
    },
    [events]
  );

  // Get events for date range
  const getEventsInRange = useCallback(
    (startDate: Date, endDate: Date) => {
      return events.filter(
        (event) =>
          event.startDate >= startDate &&
          event.startDate <= endDate
      );
    },
    [events]
  );

  // Get events for specific date
  const getEventsForDate = useCallback(
    (date: Date) => {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return getEventsInRange(startOfDay, endOfDay);
    },
    [getEventsInRange]
  );

  // Link task/goal to calendar event
  const linkToItem = useCallback(
    async (eventId: string, itemId: string, itemType: "task" | "goal" | "meeting") => {
      try {
        const updated = events.map((e) =>
          e.id === eventId
            ? { ...e, linkedItemId: itemId, linkedItemType: itemType }
            : e
        );
        setEvents(updated);
        await AsyncStorage.setItem("calendar_events", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Link error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to link event",
        };
      }
    },
    [events]
  );

  // Set up default calendar
  const setupDefaultCalendar = useCallback(async () => {
    if (Platform.OS === "web") return;

    try {
      const calendars = await Calendar.getCalendarsAsync();
      const defaultCalendar = calendars.find((cal: any) => cal.isPrimary);

      if (defaultCalendar) {
        setLinkedCalendarId(defaultCalendar.id);
        await AsyncStorage.setItem("linked_calendar_id", defaultCalendar.id);
      }
    } catch (error) {
      console.error("Error setting up calendar:", error);
    }
  }, []);

  return {
    events,
    calendarPermission,
    linkedCalendarId,
    requestCalendarPermission,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventsInRange,
    getEventsForDate,
    linkToItem,
    setupDefaultCalendar,
  };
}
