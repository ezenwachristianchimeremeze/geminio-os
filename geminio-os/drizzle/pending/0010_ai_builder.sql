CREATE TABLE `aiBuilderProjects` (
  `id` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `workspaceId` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `prompt` text NOT NULL,
  `stage` enum('prompt','requirements','plan','code','preview','edit','test','debug','rebuild','validate','deploy') NOT NULL DEFAULT 'prompt',
  `status` enum('idle','running','waiting_for_user','failed','completed','cancelled') NOT NULL DEFAULT 'idle',
  `requirements` json,
  `plan` json,
  `memory` json,
  `lastError` text,
  `version` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `aiBuilderProjects_id` PRIMARY KEY(`id`),
  CONSTRAINT `ai_builder_project_workspace_unique` UNIQUE(`workspaceId`)
);
CREATE TABLE `aiBuilderEvents` (
  `id` varchar(64) NOT NULL,
  `builderProjectId` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `sequence` int NOT NULL,
  `type` varchar(64) NOT NULL,
  `payload` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `aiBuilderEvents_id` PRIMARY KEY(`id`),
  CONSTRAINT `ai_builder_event_sequence_unique` UNIQUE(`builderProjectId`,`sequence`)
);
ALTER TABLE `aiBuilderProjects` ADD CONSTRAINT `aiBuilderProjects_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade;
ALTER TABLE `aiBuilderProjects` ADD CONSTRAINT `aiBuilderProjects_workspaceId_liveBuilderWorkspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `liveBuilderWorkspaces`(`id`) ON DELETE cascade;
ALTER TABLE `aiBuilderEvents` ADD CONSTRAINT `aiBuilderEvents_builderProjectId_aiBuilderProjects_id_fk` FOREIGN KEY (`builderProjectId`) REFERENCES `aiBuilderProjects`(`id`) ON DELETE cascade;
ALTER TABLE `aiBuilderEvents` ADD CONSTRAINT `aiBuilderEvents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade;
