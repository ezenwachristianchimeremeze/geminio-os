CREATE TABLE `aiQueueJobs` (
	`id` varchar(64) NOT NULL,
	`runId` varchar(64) NOT NULL,
	`taskId` varchar(64),
	`kind` varchar(100) NOT NULL,
	`status` enum('queued','leased','running','succeeded','failed','dead_letter') NOT NULL DEFAULT 'queued',
	`attempts` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 3,
	`availableAt` timestamp NOT NULL DEFAULT (now()),
	`leasedUntil` timestamp,
	`lastError` text,
	`payload` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aiQueueJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`projectId` varchar(64),
	`title` varchar(255) NOT NULL,
	`summary` text,
	`context` json,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orchestrationRuns` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`conversationId` varchar(64),
	`projectId` varchar(64),
	`taskId` varchar(64),
	`requestId` varchar(64) NOT NULL,
	`input` text NOT NULL,
	`intent` varchar(120),
	`capability` varchar(120),
	`plan` json,
	`status` enum('accepted','planning','executing','waiting_for_approval','verifying','completed','failed','cancelled') NOT NULL DEFAULT 'accepted',
	`result` json,
	`error` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orchestrationRuns_id` PRIMARY KEY(`id`),
	CONSTRAINT `orchestration_request_unique` UNIQUE(`userId`,`requestId`)
);
--> statement-breakpoint
CREATE TABLE `providerAttempts` (
	`id` varchar(64) NOT NULL,
	`runId` varchar(64) NOT NULL,
	`provider` varchar(80) NOT NULL,
	`model` varchar(120),
	`attempt` int NOT NULL,
	`status` enum('started','succeeded','failed','timed_out','cancelled') NOT NULL,
	`latencyMs` int,
	`errorCode` varchar(120),
	`errorMessage` text,
	`usage` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `providerAttempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskCheckpoints` (
	`id` varchar(64) NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`runId` varchar(64),
	`name` varchar(120) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`state` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskCheckpoints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskEvents` (
	`id` varchar(64) NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`runId` varchar(64),
	`sequence` int NOT NULL,
	`type` varchar(100) NOT NULL,
	`payload` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_event_sequence_unique` UNIQUE(`taskId`,`sequence`)
);
--> statement-breakpoint
ALTER TABLE `aiQueueJobs` ADD CONSTRAINT `aiQueueJobs_runId_orchestrationRuns_id_fk` FOREIGN KEY (`runId`) REFERENCES `orchestrationRuns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `aiQueueJobs` ADD CONSTRAINT `aiQueueJobs_taskId_agentTasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `agentTasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orchestrationRuns` ADD CONSTRAINT `orchestrationRuns_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orchestrationRuns` ADD CONSTRAINT `orchestrationRuns_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orchestrationRuns` ADD CONSTRAINT `orchestrationRuns_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orchestrationRuns` ADD CONSTRAINT `orchestrationRuns_taskId_agentTasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `agentTasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `providerAttempts` ADD CONSTRAINT `providerAttempts_runId_orchestrationRuns_id_fk` FOREIGN KEY (`runId`) REFERENCES `orchestrationRuns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskCheckpoints` ADD CONSTRAINT `taskCheckpoints_taskId_agentTasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `agentTasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskCheckpoints` ADD CONSTRAINT `taskCheckpoints_runId_orchestrationRuns_id_fk` FOREIGN KEY (`runId`) REFERENCES `orchestrationRuns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskEvents` ADD CONSTRAINT `taskEvents_taskId_agentTasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `agentTasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskEvents` ADD CONSTRAINT `taskEvents_runId_orchestrationRuns_id_fk` FOREIGN KEY (`runId`) REFERENCES `orchestrationRuns`(`id`) ON DELETE set null ON UPDATE no action;