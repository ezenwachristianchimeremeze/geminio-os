import { useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type RecurrencePattern = "daily" | "weekly" | "monthly" | "yearly" | "custom";

export interface ScheduledTask {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  recurrence?: {
    pattern: RecurrencePattern;
    interval: number; // every N days/weeks/months
    endDate?: Date;
    daysOfWeek?: number[]; // 0-6 for weekly
  };
  reminders?: number[]; // minutes before
  priority: "low" | "medium" | "high";
  completed: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function useAdvancedScheduling() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<ScheduledTask[]>([]);

  // Create scheduled task
  const createScheduledTask = useCallback(
    async (task: Omit<ScheduledTask, "id" | "createdAt" | "updatedAt">) => {
      try {
        const newTask: ScheduledTask = {
          ...task,
          id: `task-${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        setTasks((prev) => [newTask, ...prev]);

        // Save to storage
        const stored = await AsyncStorage.getItem("scheduled_tasks");
        const allTasks = stored ? JSON.parse(stored) : [];
        await AsyncStorage.setItem(
          "scheduled_tasks",
          JSON.stringify([...allTasks, newTask])
        );

        return { success: true, task: newTask };
      } catch (error) {
        console.error("Create task error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to create task",
        };
      }
    },
    []
  );

  // Update scheduled task
  const updateScheduledTask = useCallback(
    async (taskId: string, updates: Partial<ScheduledTask>) => {
      try {
        const updated = tasks.map((t) =>
          t.id === taskId
            ? { ...t, ...updates, updatedAt: new Date() }
            : t
        );

        setTasks(updated);

        // Save to storage
        await AsyncStorage.setItem("scheduled_tasks", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Update task error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update task",
        };
      }
    },
    [tasks]
  );

  // Complete task
  const completeTask = useCallback(
    (taskId: string) => {
      return updateScheduledTask(taskId, {
        completed: true,
        completedAt: new Date(),
      });
    },
    [updateScheduledTask]
  );

  // Delete task
  const deleteTask = useCallback(
    async (taskId: string) => {
      try {
        const updated = tasks.filter((t) => t.id !== taskId);
        setTasks(updated);

        await AsyncStorage.setItem("scheduled_tasks", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Delete task error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to delete task",
        };
      }
    },
    [tasks]
  );

  // Get upcoming tasks
  const getUpcomingTasks = useCallback((days = 7) => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return tasks.filter(
      (t) =>
        !t.completed &&
        t.dueDate >= now &&
        t.dueDate <= futureDate
    );
  }, [tasks]);

  // Get overdue tasks
  const getOverdueTasks = useCallback(() => {
    const now = new Date();

    return tasks.filter((t) => !t.completed && t.dueDate < now);
  }, [tasks]);

  // Get tasks by priority
  const getTasksByPriority = useCallback(
    (priority: ScheduledTask["priority"]) => {
      return tasks.filter((t) => t.priority === priority && !t.completed);
    },
    [tasks]
  );

  // Calculate next occurrence
  const getNextOccurrence = useCallback((task: ScheduledTask): Date | null => {
    if (!task.recurrence) return null;

    const { pattern, interval, endDate } = task.recurrence;
    let nextDate = new Date(task.dueDate);

    switch (pattern) {
      case "daily":
        nextDate.setDate(nextDate.getDate() + interval);
        break;
      case "weekly":
        nextDate.setDate(nextDate.getDate() + interval * 7);
        break;
      case "monthly":
        nextDate.setMonth(nextDate.getMonth() + interval);
        break;
      case "yearly":
        nextDate.setFullYear(nextDate.getFullYear() + interval);
        break;
    }

    if (endDate && nextDate > endDate) {
      return null;
    }

    return nextDate;
  }, []);

  // Get task statistics
  const getTaskStats = useCallback(() => {
    const completed = tasks.filter((t) => t.completed).length;
    const pending = tasks.filter((t) => !t.completed).length;
    const overdue = getOverdueTasks().length;

    return {
      total: tasks.length,
      completed,
      pending,
      overdue,
      completionRate: tasks.length > 0 ? (completed / tasks.length) * 100 : 0,
    };
  }, [tasks, getOverdueTasks]);

  // Update upcoming tasks
  useEffect(() => {
    setUpcomingTasks(getUpcomingTasks());
  }, [tasks, getUpcomingTasks]);

  return {
    tasks,
    upcomingTasks,
    createScheduledTask,
    updateScheduledTask,
    completeTask,
    deleteTask,
    getUpcomingTasks,
    getOverdueTasks,
    getTasksByPriority,
    getNextOccurrence,
    getTaskStats,
  };
}
