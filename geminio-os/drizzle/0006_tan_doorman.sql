CREATE TABLE `liveBuilderChangeSets` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`runId` varchar(64),
	`taskId` varchar(64),
	`sequence` int NOT NULL,
	`prompt` text NOT NULL,
	`selectedElement` json,
	`summary` text NOT NULL,
	`rationale` text,
	`patches` json NOT NULL,
	`status` enum('proposed','awaiting_approval','applied','reverted','rejected','failed') NOT NULL DEFAULT 'proposed',
	`requiresApproval` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `liveBuilderChangeSets_id` PRIMARY KEY(`id`),
	CONSTRAINT `live_builder_change_workspace_sequence_unique` UNIQUE(`workspaceId`,`sequence`)
);
--> statement-breakpoint
CREATE TABLE `liveBuilderDeploymentReviews` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`versionId` varchar(64) NOT NULL,
	`taskId` varchar(64),
	`provider` varchar(100),
	`status` enum('draft','awaiting_approval','approved','rejected','submitted','blocked') NOT NULL DEFAULT 'draft',
	`releaseNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `liveBuilderDeploymentReviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `liveBuilderFiles` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`path` varchar(512) NOT NULL,
	`kind` enum('page','component','asset','api','database','config','environment','manifest') NOT NULL,
	`content` text,
	`contentHash` varchar(128),
	`isSecret` boolean NOT NULL DEFAULT false,
	`status` enum('active','deleted') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `liveBuilderFiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `live_builder_file_workspace_path_unique` UNIQUE(`workspaceId`,`path`)
);
--> statement-breakpoint
CREATE TABLE `liveBuilderPreviewSessions` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`versionId` varchar(64),
	`target` enum('phone','tablet','laptop','desktop') NOT NULL,
	`engine` enum('controlled_canvas','external_runner','unavailable') NOT NULL,
	`status` enum('starting','ready','failed','stopped') NOT NULL DEFAULT 'starting',
	`url` varchar(2048),
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `liveBuilderPreviewSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `liveBuilderValidationRuns` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`changeSetId` varchar(64),
	`target` enum('phone','tablet','laptop','desktop') NOT NULL,
	`status` enum('pending','running','passed','failed','blocked') NOT NULL DEFAULT 'pending',
	`checks` json NOT NULL,
	`logSummary` text,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `liveBuilderValidationRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `liveBuilderVersions` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`changeSetId` varchar(64),
	`number` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`manifest` json NOT NULL,
	`previewDocument` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `liveBuilderVersions_id` PRIMARY KEY(`id`),
	CONSTRAINT `live_builder_version_workspace_number_unique` UNIQUE(`workspaceId`,`number`)
);
--> statement-breakpoint
CREATE TABLE `liveBuilderWorkspaces` (
	`id` varchar(64) NOT NULL,
	`projectId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`kind` enum('website','mobile_app','workflow','api') NOT NULL,
	`previewEngine` enum('controlled_canvas','external_runner','unavailable') NOT NULL DEFAULT 'controlled_canvas',
	`previewDocument` json,
	`selectedElement` json,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `liveBuilderWorkspaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `live_builder_workspace_project_unique` UNIQUE(`projectId`)
);
--> statement-breakpoint
ALTER TABLE `liveBuilderChangeSets` ADD CONSTRAINT `liveBuilderChangeSets_workspaceId_liveBuilderWorkspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `liveBuilderWorkspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderChangeSets` ADD CONSTRAINT `liveBuilderChangeSets_runId_orchestrationRuns_id_fk` FOREIGN KEY (`runId`) REFERENCES `orchestrationRuns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderChangeSets` ADD CONSTRAINT `liveBuilderChangeSets_taskId_agentTasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `agentTasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderDeploymentReviews` ADD CONSTRAINT `lbdr_workspace_fk` FOREIGN KEY (`workspaceId`) REFERENCES `liveBuilderWorkspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderDeploymentReviews` ADD CONSTRAINT `lbdr_version_fk` FOREIGN KEY (`versionId`) REFERENCES `liveBuilderVersions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderDeploymentReviews` ADD CONSTRAINT `lbdr_task_fk` FOREIGN KEY (`taskId`) REFERENCES `agentTasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderFiles` ADD CONSTRAINT `lbf_workspace_fk` FOREIGN KEY (`workspaceId`) REFERENCES `liveBuilderWorkspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderPreviewSessions` ADD CONSTRAINT `lbps_workspace_fk` FOREIGN KEY (`workspaceId`) REFERENCES `liveBuilderWorkspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderPreviewSessions` ADD CONSTRAINT `lbps_version_fk` FOREIGN KEY (`versionId`) REFERENCES `liveBuilderVersions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderValidationRuns` ADD CONSTRAINT `lbvr_workspace_fk` FOREIGN KEY (`workspaceId`) REFERENCES `liveBuilderWorkspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderValidationRuns` ADD CONSTRAINT `lbvr_change_fk` FOREIGN KEY (`changeSetId`) REFERENCES `liveBuilderChangeSets`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderVersions` ADD CONSTRAINT `lbv_workspace_fk` FOREIGN KEY (`workspaceId`) REFERENCES `liveBuilderWorkspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderVersions` ADD CONSTRAINT `lbv_change_fk` FOREIGN KEY (`changeSetId`) REFERENCES `liveBuilderChangeSets`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderWorkspaces` ADD CONSTRAINT `lbw_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderWorkspaces` ADD CONSTRAINT `lbw_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
