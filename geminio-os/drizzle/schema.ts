import { sql } from "drizzle-orm";
import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean as mysqlBoolean, json, uniqueIndex, foreignKey, index, primaryKey } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// User Profiles
export const profiles = mysqlTable("profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  bio: text("bio"),
  avatar: varchar("avatar", { length: 255 }),
  theme: mysqlEnum("theme", ["light", "dark", "auto"]).default("auto"),
  language: varchar("language", { length: 10 }).default("en"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

// Projects
export const projects = mysqlTable("projects", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["app", "website", "workflow", "database", "agent", "dapp"]).notNull(),
  description: text("description"),
  data: text("data"),
  status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// Tasks
export const tasks = mysqlTable("tasks", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["todo", "in_progress", "done"]).default("todo"),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium"),
  dueDate: timestamp("dueDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// Goals
export const goals = mysqlTable("goals", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  progress: int("progress").default(0),
  target: int("target").default(100),
  status: mysqlEnum("status", ["active", "completed", "abandoned"]).default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Goal = typeof goals.$inferSelect;
export type InsertGoal = typeof goals.$inferInsert;

// Messages
export const messages = mysqlTable("messages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  conversationId: varchar("conversationId", { length: 64 }),
  runId: varchar("runId", { length: 64 }),
  feedback: mysqlEnum("feedback", ["up", "down"]),
  feedbackNote: varchar("feedbackNote", { length: 500 }),
  status: mysqlEnum("status", ["complete", "stopped", "failed"]).default("complete").notNull(),
  sources: json("sources"),
  attachments: json("attachments"),
  editedAt: timestamp("editedAt"),
  // Response variants: regenerating keeps the old answer (active=false) and links alternates to the user message they answer.
  active: mysqlBoolean("active").default(true).notNull(),
  variantOf: varchar("variantOf", { length: 64 }),
  // Millisecond precision: message order within a conversation is by createdAt, and user/assistant messages can land in the same second.
  createdAt: timestamp("createdAt", { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
}, (table) => ({
  conversationIdx: index("messages_conversation_idx").on(table.conversationId, table.createdAt),
}));

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// Media
export const media = mysqlTable("media", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["image", "video", "audio", "document"]).notNull(),
  url: varchar("url", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  size: int("size"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Media = typeof media.$inferSelect;
export type InsertMedia = typeof media.$inferInsert;

// Wallet Transactions
export const transactions = mysqlTable("transactions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// Notifications
export const notifications = mysqlTable("notifications", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["info", "success", "warning", "error"]).default("info"),
  read: mysqlBoolean("read").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// Audit Logs
export const auditLogs = mysqlTable("auditLogs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 255 }).notNull(),
  resource: varchar("resource", { length: 100 }),
  status: mysqlEnum("status", ["success", "warning", "error"]).default("success"),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// Marketplace Items
export const marketplaceItems = mysqlTable("marketplaceItems", {
  id: varchar("id", { length: 64 }).primaryKey(),
  creatorId: int("creatorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["template", "plugin", "agent", "workflow", "theme"]).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  downloads: int("downloads").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MarketplaceItem = typeof marketplaceItems.$inferSelect;
export type InsertMarketplaceItem = typeof marketplaceItems.$inferInsert;

// Permissions
export const permissions = mysqlTable("permissions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 100 }).notNull(),
  granted: mysqlBoolean("granted").default(false),
  grantedAt: timestamp("grantedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = typeof permissions.$inferInsert;

// Devices
export const devices = mysqlTable("devices", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  platform: mysqlEnum("platform", ["ios", "android", "web", "desktop"]).notNull(),
  lastActive: timestamp("lastActive").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Device = typeof devices.$inferSelect;
export type InsertDevice = typeof devices.$inferInsert;

// Subscriptions
export const subscriptions = mysqlTable("subscriptions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: mysqlEnum("frequency", ["monthly", "yearly"]).notNull(),
  nextBillingDate: timestamp("nextBillingDate"),
  status: mysqlEnum("status", ["active", "paused", "cancelled"]).default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;


// Autonomous agent tasks and checkpoints
export const agentTasks = mysqlTable("agentTasks", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: varchar("projectId", { length: 64 }).references(() => projects.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  state: mysqlEnum("state", ["queued", "planning", "running", "waiting_for_user", "testing", "completed", "cancelled", "failed", "retrying"]).default("queued").notNull(),
  progress: int("progress").default(0).notNull(),
  requiresApproval: mysqlBoolean("requiresApproval").default(false).notNull(),
  currentApprovalId: varchar("currentApprovalId", { length: 64 }),
  lastError: text("lastError"),
  checkpoint: varchar("checkpoint", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AgentTaskRecord = typeof agentTasks.$inferSelect;
export type InsertAgentTaskRecord = typeof agentTasks.$inferInsert;

export const taskApprovals = mysqlTable("taskApprovals", {
  id: varchar("id", { length: 64 }).primaryKey(),
  taskId: varchar("taskId", { length: 64 }).notNull().references(() => agentTasks.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: mysqlEnum("action", ["deploy_production", "send_money", "purchase_credits", "delete_project", "connect_provider", "publish_marketplace_item"]).notNull(),
  summary: text("summary").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "expired"]).default("pending").notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});
export type TaskApprovalRecord = typeof taskApprovals.$inferSelect;
export type InsertTaskApprovalRecord = typeof taskApprovals.$inferInsert;

// Credits, usage metering, and product entitlements
export const creditLedger = mysqlTable("creditLedger", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: mysqlEnum("kind", ["grant", "usage", "purchase", "refund", "expiration", "adjustment"]).notNull(),
  amount: decimal("amount", { precision: 14, scale: 6 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 14, scale: 6 }).notNull(),
  capability: varchar("capability", { length: 100 }),
  referenceId: varchar("referenceId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CreditLedgerRecord = typeof creditLedger.$inferSelect;
export type InsertCreditLedgerRecord = typeof creditLedger.$inferInsert;

export const entitlements = mysqlTable("entitlements", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("productId", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["active", "trial", "grace_period", "expired", "revoked"]).notNull(),
  source: mysqlEnum("source", ["free", "subscription", "purchase", "promotional"]).notNull(),
  expiresAt: timestamp("expiresAt"),
  limits: json("limits"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EntitlementRecord = typeof entitlements.$inferSelect;
export type InsertEntitlementRecord = typeof entitlements.$inferInsert;

export const usageRecords = mysqlTable("usageRecords", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  capability: varchar("capability", { length: 100 }).notNull(),
  units: decimal("units", { precision: 14, scale: 6 }).notNull(),
  creditsCharged: decimal("creditsCharged", { precision: 14, scale: 6 }).notNull(),
  requestId: varchar("requestId", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  requestIdUserUnique: uniqueIndex("usage_request_user_unique").on(table.requestId, table.userId),
}));
export type UsageRecord = typeof usageRecords.$inferSelect;
export type InsertUsageRecord = typeof usageRecords.$inferInsert;


// Persistent AI Core conversation state and resumable context.
export const conversations = mysqlTable("conversations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: varchar("projectId", { length: 64 }).references(() => projects.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary"),
  context: json("context"),
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
  pinned: mysqlBoolean("pinned").default(false).notNull(),
  // Temporary chats are hidden from history/search and swept by retention (see server/home-chat/retention.ts).
  temporary: mysqlBoolean("temporary").default(false).notNull(),
  // Read-only share link token; null = not shared. Revocable.
  shareToken: varchar("shareToken", { length: 64 }),
  sharedAt: timestamp("sharedAt"),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  shareTokenUnique: uniqueIndex("conversations_share_token_unique").on(table.shareToken),
}));
export type ConversationRecord = typeof conversations.$inferSelect;
export type InsertConversationRecord = typeof conversations.$inferInsert;

// One durable orchestration run per accepted natural-language request.
export const orchestrationRuns = mysqlTable("orchestrationRuns", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: varchar("conversationId", { length: 64 }).references(() => conversations.id, { onDelete: "set null" }),
  projectId: varchar("projectId", { length: 64 }).references(() => projects.id, { onDelete: "set null" }),
  taskId: varchar("taskId", { length: 64 }).references(() => agentTasks.id, { onDelete: "set null" }),
  requestId: varchar("requestId", { length: 64 }).notNull(),
  input: text("input").notNull(),
  intent: varchar("intent", { length: 120 }),
  capability: varchar("capability", { length: 120 }),
  plan: json("plan"),
  status: mysqlEnum("status", ["accepted", "planning", "executing", "waiting_for_approval", "paused", "verifying", "completed", "failed", "cancelled"]).default("accepted").notNull(),
  result: json("result"),
  error: json("error"),
  /** Fencing token: incremented by every worker claim; a worker's writes must match the value it was given (see server/ai-core/run-guard.ts). */
  fence: int("fence").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  requestIdUnique: uniqueIndex("orchestration_request_unique").on(table.userId, table.requestId),
}));
export type OrchestrationRunRecord = typeof orchestrationRuns.$inferSelect;
export type InsertOrchestrationRunRecord = typeof orchestrationRuns.$inferInsert;

// Database-backed queue item. A worker may claim a job safely using its lease.
export const aiQueueJobs = mysqlTable("aiQueueJobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  runId: varchar("runId", { length: 64 }).notNull().references(() => orchestrationRuns.id, { onDelete: "cascade" }),
  taskId: varchar("taskId", { length: 64 }).references(() => agentTasks.id, { onDelete: "set null" }),
  kind: varchar("kind", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["queued", "leased", "running", "succeeded", "cancelled", "failed", "dead_letter"]).default("queued").notNull(),
  attempts: int("attempts").default(0).notNull(),
  maxAttempts: int("maxAttempts").default(3).notNull(),
  availableAt: timestamp("availableAt").defaultNow().notNull(),
  leasedUntil: timestamp("leasedUntil"),
  lastError: text("lastError"),
  payload: json("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiQueueJobRecord = typeof aiQueueJobs.$inferSelect;
export type InsertAiQueueJobRecord = typeof aiQueueJobs.$inferInsert;

// Append-only execution history for progress, recovery, and observability.
export const taskEvents = mysqlTable("taskEvents", {
  id: varchar("id", { length: 64 }).primaryKey(),
  taskId: varchar("taskId", { length: 64 }).notNull().references(() => agentTasks.id, { onDelete: "cascade" }),
  runId: varchar("runId", { length: 64 }).references(() => orchestrationRuns.id, { onDelete: "set null" }),
  sequence: int("sequence").notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  payload: json("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  taskSequenceUnique: uniqueIndex("task_event_sequence_unique").on(table.taskId, table.sequence),
}));
export type TaskEventRecord = typeof taskEvents.$inferSelect;
export type InsertTaskEventRecord = typeof taskEvents.$inferInsert;

// Named checkpoints allow long-running builder tasks to resume after failure or restart.
export const taskCheckpoints = mysqlTable("taskCheckpoints", {
  id: varchar("id", { length: 64 }).primaryKey(),
  taskId: varchar("taskId", { length: 64 }).notNull().references(() => agentTasks.id, { onDelete: "cascade" }),
  runId: varchar("runId", { length: 64 }).references(() => orchestrationRuns.id, { onDelete: "set null" }),
  name: varchar("name", { length: 120 }).notNull(),
  version: int("version").default(1).notNull(),
  state: json("state").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TaskCheckpointRecord = typeof taskCheckpoints.$inferSelect;
export type InsertTaskCheckpointRecord = typeof taskCheckpoints.$inferInsert;

// Provider-neutral attempt history. Never records secrets or raw provider credentials.
export const providerAttempts = mysqlTable("providerAttempts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  runId: varchar("runId", { length: 64 }).notNull().references(() => orchestrationRuns.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 80 }).notNull(),
  model: varchar("model", { length: 120 }),
  attempt: int("attempt").notNull(),
  status: mysqlEnum("status", ["started", "succeeded", "failed", "timed_out", "cancelled"]).notNull(),
  latencyMs: int("latencyMs"),
  errorCode: varchar("errorCode", { length: 120 }),
  errorMessage: text("errorMessage"),
  usage: json("usage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ProviderAttemptRecord = typeof providerAttempts.$inferSelect;
export type InsertProviderAttemptRecord = typeof providerAttempts.$inferInsert;

// Durable workspace metadata for the AI Builder live-development environment.
export const liveBuilderWorkspaces = mysqlTable("liveBuilderWorkspaces", {
  id: varchar("id", { length: 64 }).primaryKey(),
  projectId: varchar("projectId", { length: 64 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: mysqlEnum("kind", ["website", "mobile_app", "workflow", "api"]).notNull(),
  previewEngine: mysqlEnum("previewEngine", ["controlled_canvas", "external_runner", "unavailable"]).default("controlled_canvas").notNull(),
  previewDocument: json("previewDocument"),
  selectedElement: json("selectedElement"),
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  workspaceProjectUnique: uniqueIndex("live_builder_workspace_project_unique").on(table.projectId),
}));
export type LiveBuilderWorkspaceRecord = typeof liveBuilderWorkspaces.$inferSelect;
export type InsertLiveBuilderWorkspaceRecord = typeof liveBuilderWorkspaces.$inferInsert;

// Virtual project files are persisted independently so targeted changes do not overwrite unrelated work.
export const liveBuilderFiles = mysqlTable("liveBuilderFiles", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workspaceId: varchar("workspaceId", { length: 64 }).notNull().references(() => liveBuilderWorkspaces.id, { onDelete: "cascade" }),
  path: varchar("path", { length: 512 }).notNull(),
  kind: mysqlEnum("kind", ["page", "component", "asset", "api", "database", "config", "environment", "manifest"]).notNull(),
  content: text("content"),
  contentHash: varchar("contentHash", { length: 128 }),
  isSecret: mysqlBoolean("isSecret").default(false).notNull(),
  status: mysqlEnum("status", ["active", "deleted"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  workspacePathUnique: uniqueIndex("live_builder_file_workspace_path_unique").on(table.workspaceId, table.path),
}));
export type LiveBuilderFileRecord = typeof liveBuilderFiles.$inferSelect;
export type InsertLiveBuilderFileRecord = typeof liveBuilderFiles.$inferInsert;

// Every AI-proposed modification is durable and reviewable before it changes the workspace files.
export const liveBuilderChangeSets = mysqlTable("liveBuilderChangeSets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workspaceId: varchar("workspaceId", { length: 64 }).notNull().references(() => liveBuilderWorkspaces.id, { onDelete: "cascade" }),
  runId: varchar("runId", { length: 64 }).references(() => orchestrationRuns.id, { onDelete: "set null" }),
  taskId: varchar("taskId", { length: 64 }).references(() => agentTasks.id, { onDelete: "set null" }),
  sequence: int("sequence").notNull(),
  prompt: text("prompt").notNull(),
  selectedElement: json("selectedElement"),
  summary: text("summary").notNull(),
  rationale: text("rationale"),
  patches: json("patches").notNull(),
  status: mysqlEnum("status", ["proposed", "awaiting_approval", "applied", "reverted", "rejected", "failed"]).default("proposed").notNull(),
  requiresApproval: mysqlBoolean("requiresApproval").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  workspaceSequenceUnique: uniqueIndex("live_builder_change_workspace_sequence_unique").on(table.workspaceId, table.sequence),
}));
export type LiveBuilderChangeSetRecord = typeof liveBuilderChangeSets.$inferSelect;
export type InsertLiveBuilderChangeSetRecord = typeof liveBuilderChangeSets.$inferInsert;

// Immutable project versions support change history, undo/redo, and controlled preview restoration.
export const liveBuilderVersions = mysqlTable("liveBuilderVersions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workspaceId: varchar("workspaceId", { length: 64 }).notNull().references(() => liveBuilderWorkspaces.id, { onDelete: "cascade" }),
  changeSetId: varchar("changeSetId", { length: 64 }).references(() => liveBuilderChangeSets.id, { onDelete: "set null" }),
  number: int("number").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  manifest: json("manifest").notNull(),
  previewDocument: json("previewDocument").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workspaceVersionUnique: uniqueIndex("live_builder_version_workspace_number_unique").on(table.workspaceId, table.number),
}));
export type LiveBuilderVersionRecord = typeof liveBuilderVersions.$inferSelect;
export type InsertLiveBuilderVersionRecord = typeof liveBuilderVersions.$inferInsert;

// Preview sessions distinguish the safe in-app declarative canvas from a separately configured isolated runner.
export const liveBuilderPreviewSessions = mysqlTable("liveBuilderPreviewSessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workspaceId: varchar("workspaceId", { length: 64 }).notNull().references(() => liveBuilderWorkspaces.id, { onDelete: "cascade" }),
  versionId: varchar("versionId", { length: 64 }).references(() => liveBuilderVersions.id, { onDelete: "set null" }),
  target: mysqlEnum("target", ["phone", "tablet", "laptop", "desktop"]).notNull(),
  engine: mysqlEnum("engine", ["controlled_canvas", "external_runner", "unavailable"]).notNull(),
  status: mysqlEnum("status", ["starting", "ready", "failed", "stopped"]).default("starting").notNull(),
  url: varchar("url", { length: 2048 }),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LiveBuilderPreviewSessionRecord = typeof liveBuilderPreviewSessions.$inferSelect;
export type InsertLiveBuilderPreviewSessionRecord = typeof liveBuilderPreviewSessions.$inferInsert;

// Validation records persist automated checks and responsive target evidence per proposed or applied change.
export const liveBuilderValidationRuns = mysqlTable("liveBuilderValidationRuns", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workspaceId: varchar("workspaceId", { length: 64 }).notNull().references(() => liveBuilderWorkspaces.id, { onDelete: "cascade" }),
  changeSetId: varchar("changeSetId", { length: 64 }).references(() => liveBuilderChangeSets.id, { onDelete: "set null" }),
  target: mysqlEnum("target", ["phone", "tablet", "laptop", "desktop"]).notNull(),
  status: mysqlEnum("status", ["pending", "running", "passed", "failed", "blocked"]).default("pending").notNull(),
  checks: json("checks").notNull(),
  logSummary: text("logSummary"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LiveBuilderValidationRunRecord = typeof liveBuilderValidationRuns.$inferSelect;
export type InsertLiveBuilderValidationRunRecord = typeof liveBuilderValidationRuns.$inferInsert;

// Deployment remains an explicit approval boundary; no external provider is implied by this durable record.
export const liveBuilderDeploymentReviews = mysqlTable("liveBuilderDeploymentReviews", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workspaceId: varchar("workspaceId", { length: 64 }).notNull().references(() => liveBuilderWorkspaces.id, { onDelete: "cascade" }),
  versionId: varchar("versionId", { length: 64 }).notNull().references(() => liveBuilderVersions.id, { onDelete: "cascade" }),
  taskId: varchar("taskId", { length: 64 }).references(() => agentTasks.id, { onDelete: "set null" }),
  provider: varchar("provider", { length: 100 }),
  status: mysqlEnum("status", ["draft", "awaiting_approval", "approved", "rejected", "submitted", "blocked"]).default("draft").notNull(),
  releaseNotes: text("releaseNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LiveBuilderDeploymentReviewRecord = typeof liveBuilderDeploymentReviews.$inferSelect;
export type InsertLiveBuilderDeploymentReviewRecord = typeof liveBuilderDeploymentReviews.$inferInsert;


// Durable lifecycle records for isolated Live Builder project runtimes.
export const liveBuilderRuntimeSessions = mysqlTable("liveBuilderRuntimeSessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workspaceId: varchar("workspaceId", { length: 64 }).notNull().references(() => liveBuilderWorkspaces.id, { onDelete: "cascade" }),
  versionId: varchar("versionId", { length: 64 }).references(() => liveBuilderVersions.id, { onDelete: "set null" }),
  target: mysqlEnum("target", ["phone", "tablet", "laptop", "desktop"]).notNull(),
  engine: mysqlEnum("engine", ["controlled_canvas", "external_runner", "unavailable"]).notNull(),
  status: mysqlEnum("status", ["starting", "ready", "stopping", "stopped", "failed", "timed_out", "crashed"]).default("starting").notNull(),
  isolation: mysqlEnum("isolation", ["controlled_canvas", "external_sandbox", "unavailable"]).notNull(),
  outputMode: mysqlEnum("outputMode", ["declarative", "executable", "unavailable"]).notNull(),
  url: varchar("url", { length: 2048 }),
  lastError: text("lastError"),
  startedAt: timestamp("startedAt"),
  stoppedAt: timestamp("stoppedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  runtimeWorkspaceFk: foreignKey({ columns: [table.workspaceId], foreignColumns: [liveBuilderWorkspaces.id], name: "lbrs_workspace_fk" }),
  runtimeVersionFk: foreignKey({ columns: [table.versionId], foreignColumns: [liveBuilderVersions.id], name: "lbrs_version_fk" }),
}));
export type LiveBuilderRuntimeSessionRecord = typeof liveBuilderRuntimeSessions.$inferSelect;
export type InsertLiveBuilderRuntimeSessionRecord = typeof liveBuilderRuntimeSessions.$inferInsert;

export const liveBuilderRuntimeEvents = mysqlTable("liveBuilderRuntimeEvents", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  sequence: int("sequence").notNull(),
  type: varchar("type", { length: 80 }).notNull(),
  message: text("message").notNull(),
  diagnostics: json("diagnostics").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  runtimeEventSequenceUnique: uniqueIndex("live_builder_runtime_event_sequence_unique").on(table.sessionId, table.sequence),
  runtimeSessionFk: foreignKey({ columns: [table.sessionId], foreignColumns: [liveBuilderRuntimeSessions.id], name: "lbre_session_fk" }),
}));
export type LiveBuilderRuntimeEventRecord = typeof liveBuilderRuntimeEvents.$inferSelect;
export type InsertLiveBuilderRuntimeEventRecord = typeof liveBuilderRuntimeEvents.$inferInsert;

// Runner control-plane registry. Workers never receive host filesystem access.
export const runnerWorkers = mysqlTable("runnerWorkers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  provider: mysqlEnum("provider", ["development", "container", "microvm"]).notNull(),
  status: mysqlEnum("status", ["registered", "healthy", "draining", "offline"]).default("registered").notNull(),
  capabilities: json("capabilities").notNull(),
  lastHeartbeatAt: timestamp("lastHeartbeatAt"),
  currentJobId: varchar("currentJobId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type RunnerWorkerRecord = typeof runnerWorkers.$inferSelect;
export type InsertRunnerWorkerRecord = typeof runnerWorkers.$inferInsert;

export const runnerJobs = mysqlTable("runnerJobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspaceId", { length: 64 }).notNull().references(() => liveBuilderWorkspaces.id, { onDelete: "cascade" }),
  projectId: varchar("projectId", { length: 64 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  versionId: varchar("versionId", { length: 64 }).references(() => liveBuilderVersions.id, { onDelete: "set null" }),
  runtimeSessionId: varchar("runtimeSessionId", { length: 64 }).references(() => liveBuilderRuntimeSessions.id, { onDelete: "set null" }),
  provider: mysqlEnum("provider", ["development", "container", "microvm"]).notNull(),
  state: mysqlEnum("state", ["created", "queued", "starting", "preparing", "building", "running", "ready", "stopping", "completed", "failed", "retrying", "cancel_requested", "cancelled", "timeout", "forced_stop", "cleaned"]).default("created").notNull(),
  attempt: int("attempt").default(0).notNull(),
  maxAttempts: int("maxAttempts").default(3).notNull(),
  workerId: varchar("workerId", { length: 64 }),
  leaseExpiresAt: timestamp("leaseExpiresAt"),
  policy: json("policy").notNull(),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type RunnerJobRecord = typeof runnerJobs.$inferSelect;
export type InsertRunnerJobRecord = typeof runnerJobs.$inferInsert;

export const runnerExecutionLogs = mysqlTable("runnerExecutionLogs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  jobId: varchar("jobId", { length: 64 }).notNull().references(() => runnerJobs.id, { onDelete: "cascade" }),
  projectId: varchar("projectId", { length: 64 }).notNull(),
  versionId: varchar("versionId", { length: 64 }),
  phase: varchar("phase", { length: 80 }).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "error"]).notNull(),
  workerId: varchar("workerId", { length: 64 }),
  message: text("message").notNull(),
  errorCode: varchar("errorCode", { length: 120 }),
  diagnostics: json("diagnostics").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RunnerExecutionLogRecord = typeof runnerExecutionLogs.$inferSelect;
export type InsertRunnerExecutionLogRecord = typeof runnerExecutionLogs.$inferInsert;

export const liveBuilderPreviewGatewaySessions = mysqlTable("liveBuilderPreviewGatewaySessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspaceId", { length: 64 }).notNull().references(() => liveBuilderWorkspaces.id, { onDelete: "cascade" }),
  versionId: varchar("versionId", { length: 64 }).references(() => liveBuilderVersions.id, { onDelete: "set null" }),
  runtimeSessionId: varchar("runtimeSessionId", { length: 64 }).references(() => liveBuilderRuntimeSessions.id, { onDelete: "set null" }),
  authState: mysqlEnum("authState", ["authenticated", "expired", "revoked"]).default("authenticated").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LiveBuilderPreviewGatewaySessionRecord = typeof liveBuilderPreviewGatewaySessions.$inferSelect;
export type InsertLiveBuilderPreviewGatewaySessionRecord = typeof liveBuilderPreviewGatewaySessions.$inferInsert;

export const runnerBuildArtifacts = mysqlTable("runnerBuildArtifacts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  jobId: varchar("jobId", { length: 64 }).notNull().references(() => runnerJobs.id, { onDelete: "cascade" }),
  versionId: varchar("versionId", { length: 64 }).references(() => liveBuilderVersions.id, { onDelete: "set null" }),
  kind: varchar("kind", { length: 80 }).notNull(),
  uri: varchar("uri", { length: 2048 }),
  contentHash: varchar("contentHash", { length: 128 }),
  sizeBytes: int("sizeBytes"),
  status: mysqlEnum("status", ["created", "available", "expired", "failed"]).default("created").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});
export type RunnerBuildArtifactRecord = typeof runnerBuildArtifacts.$inferSelect;
export type InsertRunnerBuildArtifactRecord = typeof runnerBuildArtifacts.$inferInsert;

export const liveBuilderRuntimeCheckpoints = mysqlTable("liveBuilderRuntimeCheckpoints", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workspaceId: varchar("workspaceId", { length: 64 }).notNull().references(() => liveBuilderWorkspaces.id, { onDelete: "cascade" }),
  versionId: varchar("versionId", { length: 64 }).references(() => liveBuilderVersions.id, { onDelete: "set null" }),
  runtimeSessionId: varchar("runtimeSessionId", { length: 64 }).references(() => liveBuilderRuntimeSessions.id, { onDelete: "set null" }),
  kind: mysqlEnum("kind", ["last_known_good", "before_rebuild", "recovery"]).notNull(),
  state: json("state").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LiveBuilderRuntimeCheckpointRecord = typeof liveBuilderRuntimeCheckpoints.$inferSelect;
export type InsertLiveBuilderRuntimeCheckpointRecord = typeof liveBuilderRuntimeCheckpoints.$inferInsert;

// ---------------------------------------------------------------------------
// AI Builder durable state (replaces process-local Maps in lib/ai-builder).
// NOTE: migration SQL for these tables is staged in drizzle/pending/ and MUST be
// regenerated with `drizzle-kit generate` (which also writes the snapshot).
// ---------------------------------------------------------------------------
export const aiBuilderProjects = mysqlTable("aiBuilderProjects", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspaceId", { length: 64 }).notNull().references(() => liveBuilderWorkspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  prompt: text("prompt").notNull(),
  stage: mysqlEnum("stage", ["prompt", "requirements", "plan", "code", "preview", "edit", "test", "debug", "rebuild", "validate", "deploy"]).default("prompt").notNull(),
  status: mysqlEnum("status", ["idle", "running", "waiting_for_user", "failed", "completed", "cancelled"]).default("idle").notNull(),
  requirements: json("requirements"),
  plan: json("plan"),
  memory: json("memory"),
  lastError: text("lastError"),
  // Optimistic concurrency token: every state change is `UPDATE ... WHERE version = ?`.
  version: int("version").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  builderWorkspaceUnique: uniqueIndex("ai_builder_project_workspace_unique").on(table.workspaceId),
}));
export type AiBuilderProjectRecord = typeof aiBuilderProjects.$inferSelect;
export type InsertAiBuilderProjectRecord = typeof aiBuilderProjects.$inferInsert;

export const aiBuilderEvents = mysqlTable("aiBuilderEvents", {
  id: varchar("id", { length: 64 }).primaryKey(),
  builderProjectId: varchar("builderProjectId", { length: 64 }).notNull().references(() => aiBuilderProjects.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  sequence: int("sequence").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  payload: json("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  builderEventSequenceUnique: uniqueIndex("ai_builder_event_sequence_unique").on(table.builderProjectId, table.sequence),
}));
export type AiBuilderEventRecord = typeof aiBuilderEvents.$inferSelect;


// Server-authoritative credit accounting (see server/credits/ledger.ts). Amounts are integer micro-credits (1 credit = 1,000,000).
export const creditAccounts = mysqlTable("creditAccounts", {
  userId: int("userId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  balance: bigint("balance", { mode: "number" }).notNull().default(0),
  reserved: bigint("reserved", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export const creditReservations = mysqlTable("creditReservations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  requestId: varchar("requestId", { length: 64 }).notNull(),
  capability: varchar("capability", { length: 100 }).notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  charged: bigint("charged", { mode: "number" }).notNull().default(0),
  status: mysqlEnum("status", ["reserved", "finalized", "released"]).notNull().default("reserved"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  requestUnique: uniqueIndex("credit_reservation_request_unique").on(table.userId, table.requestId),
}));

// Files attached to Home chat messages. Bytes live in object storage; this row is the ownership + validation record.
export const homeChatAttachments = mysqlTable("homeChatAttachments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: varchar("conversationId", { length: 64 }),
  name: varchar("name", { length: 120 }).notNull(),
  kind: mysqlEnum("kind", ["image", "pdf", "text", "code", "other"]).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  storageKey: varchar("storageKey", { length: 255 }).notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("home_chat_attachments_user_idx").on(table.userId, table.createdAt) }));

export const homeChatPreferences = mysqlTable("homeChatPreferences", {
  userId: int("userId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  customInstructions: text("customInstructions").notNull(),
  responseStyle: mysqlEnum("responseStyle", ["concise", "balanced", "detailed"]).default("balanced").notNull(),
  language: varchar("language", { length: 16 }),
  aiLevel: varchar("aiLevel", { length: 32 }).default("standard").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Durable schedules (reminders and recurring prompts) fired by the server worker. See server/home-chat/schedule.ts.
export const homeChatSchedules = mysqlTable("homeChatSchedules", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: mysqlEnum("kind", ["reminder", "prompt"]).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  prompt: text("prompt"),
  recurrence: json("recurrence").notNull(),
  timezone: varchar("timezone", { length: 64 }).notNull(),
  timeOfDay: varchar("timeOfDay", { length: 5 }).notNull(),
  nextRunAt: timestamp("nextRunAt"),
  lastRunAt: timestamp("lastRunAt"),
  status: mysqlEnum("status", ["active", "paused", "completed"]).default("active").notNull(),
  failures: int("failures").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ dueIdx: index("home_chat_schedules_due_idx").on(table.status, table.nextRunAt), userIdx: index("home_chat_schedules_user_idx").on(table.userId) }));

// Execute-once AI operations (legacy direct-LLM procedures). Unique per (userId, key); result persisted for retrieval without re-execution.
export const aiOperations = mysqlTable("aiOperations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 64 }).notNull(),
  capability: varchar("capability", { length: 100 }).notNull(),
  inputHash: varchar("inputHash", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed"]).notNull(),
  attempt: int("attempt").default(1).notNull(),
  result: json("result"),
  error: varchar("error", { length: 300 }),
  leaseUntil: timestamp("leaseUntil", { fsp: 3 }).notNull(),
  createdAt: timestamp("createdAt", { fsp: 3 }).notNull(),
  updatedAt: timestamp("updatedAt", { fsp: 3 }).notNull(),
}, (table) => ({ keyUnique: uniqueIndex("ai_operations_user_key_unique").on(table.userId, table.key) }));

// Approval-gated Home actions (see server/home-chat/actions.ts). Card text is server-generated; transitions are compare-and-set.
export const homeChatActions = mysqlTable("homeChatActions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 40 }).notNull(),
  resourceId: varchar("resourceId", { length: 64 }).notNull(),
  resourceLabel: varchar("resourceLabel", { length: 120 }).notNull(),
  summary: varchar("summary", { length: 300 }).notNull(),
  consequences: json("consequences").notNull(),
  estimatedCredits: int("estimatedCredits").default(0).notNull(),
  reversible: mysqlBoolean("reversible").default(false).notNull(),
  reversalNote: varchar("reversalNote", { length: 300 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled", "expired", "executing", "executed", "failed"]).default("pending").notNull(),
  params: json("params").notNull(),
  result: json("result"),
  error: varchar("error", { length: 300 }),
  expiresAt: timestamp("expiresAt", { fsp: 3 }).notNull(),
  createdAt: timestamp("createdAt", { fsp: 3 }).notNull(),
  updatedAt: timestamp("updatedAt", { fsp: 3 }).notNull(),
}, (table) => ({ userIdx: index("home_chat_actions_user_idx").on(table.userId, table.status) }));

// One execution record per (schedule, occurrence): lease + attempts make scheduled runs recoverable after a crash.
export const homeChatScheduleRuns = mysqlTable("homeChatScheduleRuns", {
  scheduleId: varchar("scheduleId", { length: 64 }).notNull(),
  occurrence: timestamp("occurrence", { fsp: 3 }).notNull(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["firing", "retry", "done", "failed", "skipped"]).notNull(),
  attempts: int("attempts").default(1).notNull(),
  leaseUntil: timestamp("leaseUntil", { fsp: 3 }).notNull(),
  lastError: varchar("lastError", { length: 300 }),
  updatedAt: timestamp("updatedAt", { fsp: 3 }).defaultNow().notNull(),
}, (table) => ({ pk: primaryKey({ columns: [table.scheduleId, table.occurrence] }), leaseIdx: index("home_chat_schedule_runs_lease_idx").on(table.status, table.leaseUntil) }));
