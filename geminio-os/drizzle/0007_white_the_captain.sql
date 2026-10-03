CREATE TABLE `liveBuilderRuntimeEvents` (
	`id` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`sequence` int NOT NULL,
	`type` varchar(80) NOT NULL,
	`message` text NOT NULL,
	`diagnostics` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `liveBuilderRuntimeEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `live_builder_runtime_event_sequence_unique` UNIQUE(`sessionId`,`sequence`)
);
--> statement-breakpoint
CREATE TABLE `liveBuilderRuntimeSessions` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`versionId` varchar(64),
	`target` enum('phone','tablet','laptop','desktop') NOT NULL,
	`engine` enum('controlled_canvas','external_runner','unavailable') NOT NULL,
	`status` enum('starting','ready','stopping','stopped','failed','timed_out','crashed') NOT NULL DEFAULT 'starting',
	`isolation` enum('controlled_canvas','external_sandbox','unavailable') NOT NULL,
	`outputMode` enum('declarative','executable','unavailable') NOT NULL,
	`url` varchar(2048),
	`lastError` text,
	`startedAt` timestamp,
	`stoppedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `liveBuilderRuntimeSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `liveBuilderRuntimeEvents` ADD CONSTRAINT `liveBuilderRuntimeEvents_sessionId_liveBuilderRuntimeSessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `liveBuilderRuntimeSessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderRuntimeSessions` ADD CONSTRAINT `liveBuilderRuntimeSessions_workspaceId_liveBuilderWorkspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `liveBuilderWorkspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderRuntimeSessions` ADD CONSTRAINT `liveBuilderRuntimeSessions_versionId_liveBuilderVersions_id_fk` FOREIGN KEY (`versionId`) REFERENCES `liveBuilderVersions`(`id`) ON DELETE set null ON UPDATE no action;