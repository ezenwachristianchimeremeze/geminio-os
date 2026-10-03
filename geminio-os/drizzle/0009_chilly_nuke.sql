CREATE TABLE `liveBuilderPreviewGatewaySessions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`versionId` varchar(64),
	`runtimeSessionId` varchar(64),
	`authState` enum('authenticated','expired','revoked') NOT NULL DEFAULT 'authenticated',
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `liveBuilderPreviewGatewaySessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `liveBuilderRuntimeCheckpoints` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`versionId` varchar(64),
	`runtimeSessionId` varchar(64),
	`kind` enum('last_known_good','before_rebuild','recovery') NOT NULL,
	`state` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `liveBuilderRuntimeCheckpoints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `runnerBuildArtifacts` (
	`id` varchar(64) NOT NULL,
	`jobId` varchar(64) NOT NULL,
	`versionId` varchar(64),
	`kind` varchar(80) NOT NULL,
	`uri` varchar(2048),
	`contentHash` varchar(128),
	`sizeBytes` int,
	`status` enum('created','available','expired','failed') NOT NULL DEFAULT 'created',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `runnerBuildArtifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `runnerExecutionLogs` (
	`id` varchar(64) NOT NULL,
	`jobId` varchar(64) NOT NULL,
	`projectId` varchar(64) NOT NULL,
	`versionId` varchar(64),
	`phase` varchar(80) NOT NULL,
	`severity` enum('info','warning','error') NOT NULL,
	`workerId` varchar(64),
	`message` text NOT NULL,
	`errorCode` varchar(120),
	`diagnostics` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `runnerExecutionLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `runnerJobs` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`projectId` varchar(64) NOT NULL,
	`versionId` varchar(64),
	`runtimeSessionId` varchar(64),
	`provider` enum('development','container','microvm') NOT NULL,
	`state` enum('created','queued','starting','preparing','building','running','ready','stopping','completed','failed','retrying','cancel_requested','cancelled','timeout','forced_stop','cleaned') NOT NULL DEFAULT 'created',
	`attempt` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 3,
	`workerId` varchar(64),
	`leaseExpiresAt` timestamp,
	`policy` json NOT NULL,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `runnerJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `runnerWorkers` (
	`id` varchar(64) NOT NULL,
	`provider` enum('development','container','microvm') NOT NULL,
	`status` enum('registered','healthy','draining','offline') NOT NULL DEFAULT 'registered',
	`capabilities` json NOT NULL,
	`lastHeartbeatAt` timestamp,
	`currentJobId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `runnerWorkers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `liveBuilderPreviewGatewaySessions` ADD CONSTRAINT `lpgs_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderPreviewGatewaySessions` ADD CONSTRAINT `lpgs_workspace_fk` FOREIGN KEY (`workspaceId`) REFERENCES `liveBuilderWorkspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderPreviewGatewaySessions` ADD CONSTRAINT `lpgs_version_fk` FOREIGN KEY (`versionId`) REFERENCES `liveBuilderVersions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderPreviewGatewaySessions` ADD CONSTRAINT `lpgs_runtime_fk` FOREIGN KEY (`runtimeSessionId`) REFERENCES `liveBuilderRuntimeSessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderRuntimeCheckpoints` ADD CONSTRAINT `lbrc_workspace_fk` FOREIGN KEY (`workspaceId`) REFERENCES `liveBuilderWorkspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderRuntimeCheckpoints` ADD CONSTRAINT `lbrc_version_fk` FOREIGN KEY (`versionId`) REFERENCES `liveBuilderVersions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderRuntimeCheckpoints` ADD CONSTRAINT `lbrc_runtime_fk` FOREIGN KEY (`runtimeSessionId`) REFERENCES `liveBuilderRuntimeSessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `runnerBuildArtifacts` ADD CONSTRAINT `rba_job_fk` FOREIGN KEY (`jobId`) REFERENCES `runnerJobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `runnerBuildArtifacts` ADD CONSTRAINT `rba_version_fk` FOREIGN KEY (`versionId`) REFERENCES `liveBuilderVersions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `runnerExecutionLogs` ADD CONSTRAINT `rel_job_fk` FOREIGN KEY (`jobId`) REFERENCES `runnerJobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `runnerJobs` ADD CONSTRAINT `rj_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `runnerJobs` ADD CONSTRAINT `rj_workspace_fk` FOREIGN KEY (`workspaceId`) REFERENCES `liveBuilderWorkspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `runnerJobs` ADD CONSTRAINT `rj_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `runnerJobs` ADD CONSTRAINT `rj_version_fk` FOREIGN KEY (`versionId`) REFERENCES `liveBuilderVersions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `runnerJobs` ADD CONSTRAINT `rj_runtime_fk` FOREIGN KEY (`runtimeSessionId`) REFERENCES `liveBuilderRuntimeSessions`(`id`) ON DELETE set null ON UPDATE no action;
