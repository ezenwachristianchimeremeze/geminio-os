/**
 * Geminio OS - Database Persistence Layer
 * 
 * Provides ORM queries for:
 * - Chat messages and conversations
 * - User preferences and settings
 * - Job applications and tracking
 * - Financial transactions
 * - Automation workflows
 * - User data and profiles
 */

import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import {
  users,
  conversations,
  messages,
  applications,
  transactions,
  workflows,
  preferences,
  jobs,
  documents,
  notifications,
  InsertUser,
  InsertConversation,
  InsertMessage,
  InsertApplication,
  InsertTransaction,
  InsertWorkflow,
  InsertPreference,
} from "@/drizzle/schema";

// Database instance will be initialized from server/db.ts
let db: any = null;

export function setDatabase(database: any) {
  db = database;
}

/**
 * User Management
 */
export const userDatabase = {
  async createUser(data: {
    email: string;
    name: string;
    avatar?: string;
    openId?: string;
  }) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db
        .insert(users)
        .values({
          email: data.email,
          name: data.name,
          avatar: data.avatar,
          openId: data.openId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      console.error("Create user error:", error);
      throw error;
    }
  },

  async getUserById(userId: number) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      return result;
    } catch (error) {
      console.error("Get user error:", error);
      throw error;
    }
  },

  async getUserByOpenId(openId: string) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db.query.users.findFirst({
        where: eq(users.openId, openId),
      });
      return result;
    } catch (error) {
      console.error("Get user by openId error:", error);
      throw error;
    }
  },

  async updateUser(userId: number, data: Partial<typeof users.$inferInsert>) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Update user error:", error);
      throw error;
    }
  },
};

/**
 * Chat Management
 */
export const chatDatabase = {
  async createConversation(userId: number, title?: string) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db
        .insert(conversations)
        .values({
          userId,
          title: title || "New Conversation",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      console.error("Create conversation error:", error);
      throw error;
    }
  },

  async getConversations(userId: number) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db.query.conversations.findMany({
        where: eq(conversations.userId, userId),
        orderBy: desc(conversations.createdAt),
      });
      return result;
    } catch (error) {
      console.error("Get conversations error:", error);
      throw error;
    }
  },

  async addMessage(
    conversationId: number,
    userId: number,
    content: string,
    role: "user" | "assistant"
  ) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db
        .insert(messages)
        .values({
          conversationId,
          userId,
          content,
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      console.error("Add message error:", error);
      throw error;
    }
  },

  async getMessages(conversationId: number) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        orderBy: desc(messages.createdAt),
      });
      return result.reverse();
    } catch (error) {
      console.error("Get messages error:", error);
      throw error;
    }
  },

  async updateConversation(conversationId: number, title: string, summary?: string) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db
        .update(conversations)
        .set({ title, summary, updatedAt: new Date() })
        .where(eq(conversations.id, conversationId))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Update conversation error:", error);
      throw error;
    }
  },
};

/**
 * Job Management
 */
export const jobDatabase = {
  async createJob(userId: number, data: typeof jobs.$inferInsert) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db
        .insert(jobs)
        .values({
          ...data,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      console.error("Create job error:", error);
      throw error;
    }
  },

  async getJobs(userId: number) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db.query.jobs.findMany({
        where: eq(jobs.userId, userId),
        orderBy: desc(jobs.createdAt),
      });
      return result;
    } catch (error) {
      console.error("Get jobs error:", error);
      throw error;
    }
  },

  async createApplication(
    userId: number,
    jobId: number,
    data: { resume?: string; coverLetter?: string; status: string }
  ) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db
        .insert(applications)
        .values({
          userId,
          jobId,
          resume: data.resume,
          coverLetter: data.coverLetter,
          status: data.status,
          appliedAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      console.error("Create application error:", error);
      throw error;
    }
  },

  async getApplications(userId: number) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db.query.applications.findMany({
        where: eq(applications.userId, userId),
        orderBy: desc(applications.appliedAt),
      });
      return result;
    } catch (error) {
      console.error("Get applications error:", error);
      throw error;
    }
  },
};

/**
 * Finance Management
 */
export const financeDatabase = {
  async addTransaction(
    userId: number,
    data: {
      description: string;
      amount: string;
      category: string;
      type: "income" | "expense";
      date?: Date;
    }
  ) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db
        .insert(transactions)
        .values({
          userId,
          description: data.description,
          amount: data.amount,
          category: data.category,
          type: data.type,
          date: data.date || new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      console.error("Add transaction error:", error);
      throw error;
    }
  },

  async getTransactions(userId: number, startDate?: Date, endDate?: Date) {
    try {
      if (!db) throw new Error("Database not initialized");
      const conditions = [eq(transactions.userId, userId)];
      if (startDate) conditions.push(gte(transactions.date, startDate));
      if (endDate) conditions.push(lte(transactions.date, endDate));

      const result = await db.query.transactions.findMany({
        where: and(...conditions),
        orderBy: desc(transactions.date),
      });
      return result;
    } catch (error) {
      console.error("Get transactions error:", error);
      throw error;
    }
  },

  async getTransactionStats(userId: number) {
    try {
      if (!db) throw new Error("Database not initialized");
      const allTransactions = await db.query.transactions.findMany({
        where: eq(transactions.userId, userId),
      });

      const income = allTransactions
        .filter((t: any) => t.type === "income")
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

      const expenses = allTransactions
        .filter((t: any) => t.type === "expense")
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

      return {
        totalIncome: income,
        totalExpenses: expenses,
        balance: income - expenses,
        transactionCount: allTransactions.length,
      };
    } catch (error) {
      console.error("Get transaction stats error:", error);
      throw error;
    }
  },
};

/**
 * Workflow Management
 */
export const workflowDatabase = {
  async createWorkflow(
    userId: number,
    data: {
      name: string;
      description?: string;
      trigger: string;
      actions: any;
      conditions?: any;
      enabled?: boolean;
    }
  ) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db
        .insert(workflows)
        .values({
          userId,
          name: data.name,
          description: data.description,
          trigger: data.trigger,
          actions: data.actions,
          conditions: data.conditions,
          enabled: data.enabled ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      console.error("Create workflow error:", error);
      throw error;
    }
  },

  async getWorkflows(userId: number) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db.query.workflows.findMany({
        where: eq(workflows.userId, userId),
        orderBy: desc(workflows.createdAt),
      });
      return result;
    } catch (error) {
      console.error("Get workflows error:", error);
      throw error;
    }
  },

  async updateWorkflow(
    workflowId: number,
    data: Partial<typeof workflows.$inferInsert>
  ) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db
        .update(workflows)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(workflows.id, workflowId))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Update workflow error:", error);
      throw error;
    }
  },

  async deleteWorkflow(workflowId: number) {
    try {
      if (!db) throw new Error("Database not initialized");
      await db.delete(workflows).where(eq(workflows.id, workflowId));
      return true;
    } catch (error) {
      console.error("Delete workflow error:", error);
      throw error;
    }
  },
};

/**
 * Preferences Management
 */
export const preferencesDatabase = {
  async getPreferences(userId: number) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db.query.preferences.findFirst({
        where: eq(preferences.userId, userId),
      });
      return result;
    } catch (error) {
      console.error("Get preferences error:", error);
      throw error;
    }
  },

  async updatePreferences(userId: number, data: Partial<typeof preferences.$inferInsert>) {
    try {
      if (!db) throw new Error("Database not initialized");
      const existing = await this.getPreferences(userId);

      if (existing) {
        const result = await db
          .update(preferences)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(preferences.userId, userId))
          .returning();
        return result[0];
      } else {
        const result = await db
          .insert(preferences)
          .values({
            userId,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        return result[0];
      }
    } catch (error) {
      console.error("Update preferences error:", error);
      throw error;
    }
  },
};

/**
 * Notifications Management
 */
export const notificationsDatabase = {
  async createNotification(
    userId: number,
    data: {
      title: string;
      message: string;
      type: string;
      actionUrl?: string;
    }
  ) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db
        .insert(notifications)
        .values({
          userId,
          title: data.title,
          message: data.message,
          type: data.type,
          actionUrl: data.actionUrl,
          read: false,
          createdAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      console.error("Create notification error:", error);
      throw error;
    }
  },

  async getNotifications(userId: number) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db.query.notifications.findMany({
        where: eq(notifications.userId, userId),
        orderBy: desc(notifications.createdAt),
      });
      return result;
    } catch (error) {
      console.error("Get notifications error:", error);
      throw error;
    }
  },

  async markAsRead(notificationId: number) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.id, notificationId))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Mark notification as read error:", error);
      throw error;
    }
  },
};

/**
 * Documents Management
 */
export const documentsDatabase = {
  async addDocument(
    userId: number,
    data: {
      name: string;
      type: string;
      fileUrl: string;
    }
  ) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db
        .insert(documents)
        .values({
          userId,
          name: data.name,
          type: data.type,
          fileUrl: data.fileUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      console.error("Add document error:", error);
      throw error;
    }
  },

  async getDocuments(userId: number) {
    try {
      if (!db) throw new Error("Database not initialized");
      const result = await db.query.documents.findMany({
        where: eq(documents.userId, userId),
        orderBy: desc(documents.createdAt),
      });
      return result;
    } catch (error) {
      console.error("Get documents error:", error);
      throw error;
    }
  },
};

/**
 * Database Health Check
 */
export async function checkDatabaseHealth() {
  try {
    if (!db) throw new Error("Database not initialized");
    // Simple health check query
    const result = await db.query.users.findFirst();
    return { status: "healthy", connected: true };
  } catch (error) {
    console.error("Database health check failed:", error);
    return { status: "unhealthy", connected: false, error: String(error) };
  }
}
