ALTER TABLE `liveBuilderRuntimeEvents` DROP FOREIGN KEY `liveBuilderRuntimeEvents_sessionId_liveBuilderRuntimeSessions_id_fk`;
--> statement-breakpoint
ALTER TABLE `liveBuilderRuntimeEvents` ADD CONSTRAINT `lbre_session_fk` FOREIGN KEY (`sessionId`) REFERENCES `liveBuilderRuntimeSessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderRuntimeSessions` ADD CONSTRAINT `lbrs_workspace_fk` FOREIGN KEY (`workspaceId`) REFERENCES `liveBuilderWorkspaces`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liveBuilderRuntimeSessions` ADD CONSTRAINT `lbrs_version_fk` FOREIGN KEY (`versionId`) REFERENCES `liveBuilderVersions`(`id`) ON DELETE no action ON UPDATE no action;