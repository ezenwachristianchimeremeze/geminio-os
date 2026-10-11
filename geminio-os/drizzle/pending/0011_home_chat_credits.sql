-- REVIEW COPY (hand-written, never run). NOTE: MySQL DDL is not transactional; a failure part-way leaves earlier statements applied.
-- drizzle-kit records applied migrations, so never re-run this file by hand against a database where part of it already applied.
-- Run against a COPY of production first. REVIEW COPY: Regenerate with `pnpm drizzle-kit generate` on real infra; keep the generated SQL.
ALTER TABLE `conversations` ADD `pinned` boolean DEFAULT false NOT NULL;
ALTER TABLE `conversations` ADD `temporary` boolean DEFAULT false NOT NULL;
ALTER TABLE `conversations` ADD `shareToken` varchar(64);
ALTER TABLE `conversations` ADD `sharedAt` timestamp;
ALTER TABLE `conversations` ADD `lastMessageAt` timestamp DEFAULT (now()) NOT NULL;
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_share_token_unique` UNIQUE(`shareToken`);
-- Data migration: existing rows would otherwise all get lastMessageAt = migration time and lose their history order.
UPDATE `conversations` c SET c.`lastMessageAt` = COALESCE((SELECT MAX(m.`createdAt`) FROM `messages` m WHERE m.`conversationId` = c.`id`), c.`updatedAt`);
ALTER TABLE `messages` ADD `runId` varchar(64);
ALTER TABLE `messages` ADD `feedback` enum('up','down');
ALTER TABLE `messages` ADD `feedbackNote` varchar(500);
ALTER TABLE `messages` ADD `status` enum('complete','stopped','failed') DEFAULT 'complete' NOT NULL;
ALTER TABLE `messages` ADD `sources` json;
ALTER TABLE `messages` ADD `attachments` json;
ALTER TABLE `messages` ADD `editedAt` timestamp;
ALTER TABLE `messages` MODIFY `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
CREATE INDEX `messages_conversation_idx` ON `messages` (`conversationId`, `createdAt`);
CREATE TABLE `creditAccounts` (
  `userId` int NOT NULL, `balance` bigint NOT NULL DEFAULT 0, `reserved` bigint NOT NULL DEFAULT 0,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `creditAccounts_userId` PRIMARY KEY(`userId`),
  CONSTRAINT `creditAccounts_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE);
CREATE TABLE `creditReservations` (
  `id` varchar(64) NOT NULL, `userId` int NOT NULL, `requestId` varchar(64) NOT NULL, `capability` varchar(100) NOT NULL,
  `amount` bigint NOT NULL, `charged` bigint NOT NULL DEFAULT 0, `status` enum('reserved','finalized','released') NOT NULL DEFAULT 'reserved',
  `createdAt` timestamp NOT NULL DEFAULT (now()), `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `creditReservations_id` PRIMARY KEY(`id`),
  CONSTRAINT `credit_reservation_request_unique` UNIQUE(`userId`,`requestId`),
  CONSTRAINT `creditReservations_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE);
CREATE TABLE `homeChatAttachments` (
  `id` varchar(64) NOT NULL, `userId` int NOT NULL, `conversationId` varchar(64), `name` varchar(120) NOT NULL,
  `kind` enum('image','pdf','text','code','other') NOT NULL, `mimeType` varchar(100) NOT NULL, `sizeBytes` int NOT NULL,
  `storageKey` varchar(255) NOT NULL, `sha256` varchar(64) NOT NULL, `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `homeChatAttachments_id` PRIMARY KEY(`id`),
  KEY `home_chat_attachments_user_idx` (`userId`,`createdAt`),
  CONSTRAINT `homeChatAttachments_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE);
CREATE TABLE `homeChatPreferences` (
  `userId` int NOT NULL, `customInstructions` text NOT NULL, `responseStyle` enum('concise','balanced','detailed') NOT NULL DEFAULT 'balanced',
  `language` varchar(16), `aiLevel` varchar(32) NOT NULL DEFAULT 'standard', `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `homeChatPreferences_userId` PRIMARY KEY(`userId`),
  CONSTRAINT `homeChatPreferences_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE);
ALTER TABLE `messages` ADD `active` boolean DEFAULT true NOT NULL;
ALTER TABLE `messages` ADD `variantOf` varchar(64);
ALTER TABLE `orchestrationRuns` MODIFY `status` enum('accepted','planning','executing','waiting_for_approval','paused','verifying','completed','failed','cancelled') NOT NULL DEFAULT 'accepted';
CREATE TABLE `homeChatSchedules` (
  `id` varchar(64) NOT NULL, `userId` int NOT NULL, `kind` enum('reminder','prompt') NOT NULL, `title` varchar(120) NOT NULL, `prompt` text,
  `recurrence` json NOT NULL, `timezone` varchar(64) NOT NULL, `timeOfDay` varchar(5) NOT NULL, `nextRunAt` timestamp NULL, `lastRunAt` timestamp NULL,
  `status` enum('active','paused','completed') NOT NULL DEFAULT 'active', `failures` int NOT NULL DEFAULT 0, `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `homeChatSchedules_id` PRIMARY KEY(`id`),
  KEY `home_chat_schedules_due_idx` (`status`,`nextRunAt`), KEY `home_chat_schedules_user_idx` (`userId`),
  CONSTRAINT `homeChatSchedules_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE);
CREATE TABLE `aiOperations` (
  `id` varchar(64) NOT NULL, `userId` int NOT NULL, `key` varchar(64) NOT NULL, `capability` varchar(100) NOT NULL, `inputHash` varchar(64) NOT NULL,
  `status` enum('running','completed','failed') NOT NULL, `attempt` int NOT NULL DEFAULT 1, `result` json, `error` varchar(300),
  `leaseUntil` timestamp(3) NOT NULL, `createdAt` timestamp(3) NOT NULL, `updatedAt` timestamp(3) NOT NULL,
  CONSTRAINT `aiOperations_id` PRIMARY KEY(`id`), CONSTRAINT `ai_operations_user_key_unique` UNIQUE(`userId`,`key`),
  CONSTRAINT `aiOperations_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE);
CREATE TABLE `homeChatActions` (
  `id` varchar(64) NOT NULL, `userId` int NOT NULL, `type` varchar(40) NOT NULL, `resourceId` varchar(64) NOT NULL, `resourceLabel` varchar(120) NOT NULL,
  `summary` varchar(300) NOT NULL, `consequences` json NOT NULL, `estimatedCredits` int NOT NULL DEFAULT 0, `reversible` boolean NOT NULL DEFAULT false,
  `reversalNote` varchar(300) NOT NULL, `status` enum('pending','approved','rejected','cancelled','expired','executing','executed','failed') NOT NULL DEFAULT 'pending',
  `params` json NOT NULL, `result` json, `error` varchar(300), `expiresAt` timestamp(3) NOT NULL, `createdAt` timestamp(3) NOT NULL, `updatedAt` timestamp(3) NOT NULL,
  CONSTRAINT `homeChatActions_id` PRIMARY KEY(`id`), KEY `home_chat_actions_user_idx` (`userId`,`status`),
  CONSTRAINT `homeChatActions_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE);
CREATE TABLE `homeChatScheduleRuns` (
  `scheduleId` varchar(64) NOT NULL, `occurrence` timestamp(3) NOT NULL, `userId` int NOT NULL, `status` enum('firing','retry','done','failed','skipped') NOT NULL,
  `attempts` int NOT NULL DEFAULT 1, `leaseUntil` timestamp(3) NOT NULL, `lastError` varchar(300), `updatedAt` timestamp(3) NOT NULL DEFAULT (now(3)),
  CONSTRAINT `homeChatScheduleRuns_scheduleId_occurrence_pk` PRIMARY KEY(`scheduleId`,`occurrence`), KEY `home_chat_schedule_runs_lease_idx` (`status`,`leaseUntil`),
  CONSTRAINT `homeChatScheduleRuns_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE);
