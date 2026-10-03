CREATE TABLE `agentTasks` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`projectId` varchar(64),
	`title` varchar(255) NOT NULL,
	`state` enum('queued','planning','running','waiting_for_user','testing','completed','failed','retrying') NOT NULL DEFAULT 'queued',
	`progress` int NOT NULL DEFAULT 0,
	`requiresApproval` boolean NOT NULL DEFAULT false,
	`currentApprovalId` varchar(64),
	`lastError` text,
	`checkpoint` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `creditLedger` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`kind` enum('grant','usage','purchase','refund','expiration','adjustment') NOT NULL,
	`amount` decimal(14,6) NOT NULL,
	`balanceAfter` decimal(14,6) NOT NULL,
	`capability` varchar(100),
	`referenceId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `creditLedger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entitlements` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`productId` varchar(100) NOT NULL,
	`status` enum('active','trial','grace_period','expired','revoked') NOT NULL,
	`source` enum('free','subscription','purchase','promotional') NOT NULL,
	`expiresAt` timestamp,
	`limits` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entitlements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskApprovals` (
	`id` varchar(64) NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`action` enum('deploy_production','send_money','purchase_credits','delete_project','connect_provider','publish_marketplace_item') NOT NULL,
	`summary` text NOT NULL,
	`status` enum('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `taskApprovals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `usageRecords` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`capability` varchar(100) NOT NULL,
	`units` decimal(14,6) NOT NULL,
	`creditsCharged` decimal(14,6) NOT NULL,
	`requestId` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usageRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agentTasks` ADD CONSTRAINT `agentTasks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agentTasks` ADD CONSTRAINT `agentTasks_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creditLedger` ADD CONSTRAINT `creditLedger_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entitlements` ADD CONSTRAINT `entitlements_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskApprovals` ADD CONSTRAINT `taskApprovals_taskId_agentTasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `agentTasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskApprovals` ADD CONSTRAINT `taskApprovals_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usageRecords` ADD CONSTRAINT `usageRecords_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;