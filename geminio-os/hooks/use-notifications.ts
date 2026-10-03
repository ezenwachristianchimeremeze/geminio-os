import { useState, useEffect, useCallback } from "react";
import * as Notifications from "expo-notifications";
import type { NotificationBehavior } from "expo-notifications";
import { Platform } from "react-native";

interface NotificationData {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  delay?: number; // milliseconds
  type: "task" | "goal" | "reminder" | "automation" | "message";
}

interface ScheduledNotification {
  id: string;
  identifier: string;
  title: string;
  body: string;
  type: string;
  scheduledTime: Date;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<ScheduledNotification[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<string>("undetermined");

  // Request notification permissions
  const requestPermissions = useCallback(async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPermissionStatus(status);
      return status === "granted";
    } catch (error) {
      console.error("Error requesting notification permissions:", error);
      return false;
    }
  }, []);

  // Check notification permissions
  const checkPermissions = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status);
      return status === "granted";
    } catch (error) {
      console.error("Error checking notification permissions:", error);
      return false;
    }
  }, []);

  // Schedule a notification
  const scheduleNotification = useCallback(
    async (notification: NotificationData) => {
      try {
        const hasPermission = await checkPermissions();
        if (!hasPermission) {
          const granted = await requestPermissions();
          if (!granted) return null;
        }

        // Configure notification handler
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        // Schedule notification
        const delay = notification.delay || 5000; // Default 5 seconds
        const identifier = await Notifications.scheduleNotificationAsync({
          content: {
            title: notification.title,
            body: notification.body,
            data: notification.data || { type: notification.type },
            sound: "default",
            badge: 1,
          },
          trigger: {
            seconds: Math.ceil(delay / 1000),
          } as any,
        });

        const scheduledNotif: ScheduledNotification = {
          id: notification.id,
          identifier,
          title: notification.title,
          body: notification.body,
          type: notification.type,
          scheduledTime: new Date(Date.now() + delay),
        };

        setNotifications((prev) => [scheduledNotif, ...prev]);
        return identifier;
      } catch (error) {
        console.error("Error scheduling notification:", error);
        return null;
      }
    },
    [checkPermissions, requestPermissions]
  );

  // Cancel a scheduled notification
  const cancelNotification = useCallback(async (identifier: string) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      setNotifications((prev) => prev.filter((n) => n.identifier !== identifier));
    } catch (error) {
      console.error("Error canceling notification:", error);
    }
  }, []);

  // Cancel all notifications
  const cancelAllNotifications = useCallback(async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      setNotifications([]);
    } catch (error) {
      console.error("Error canceling all notifications:", error);
    }
  }, []);

  // Get all scheduled notifications
  const getScheduledNotifications = useCallback(async () => {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      return scheduled;
    } catch (error) {
      console.error("Error getting scheduled notifications:", error);
      return [];
    }
  }, []);

  // Send immediate notification (for testing)
  const sendImmediateNotification = useCallback(
    async (notification: NotificationData) => {
      return scheduleNotification({
        ...notification,
        delay: 1000, // 1 second delay
      });
    },
    [scheduleNotification]
  );

  // Set up notification listeners
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification response:", response);
      // Handle notification tap/interaction
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return {
    notifications,
    permissionStatus,
    requestPermissions,
    checkPermissions,
    scheduleNotification,
    cancelNotification,
    cancelAllNotifications,
    getScheduledNotifications,
    sendImmediateNotification,
  };
}
