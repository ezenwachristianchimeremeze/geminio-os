-- Create tasks table
CREATE TABLE IF NOT EXISTS `tasks` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `status` text DEFAULT 'pending',
  `priority` text DEFAULT 'medium',
  `due_date` timestamp,
  `completed_at` timestamp,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create goals table
CREATE TABLE IF NOT EXISTS `goals` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `target_date` timestamp,
  `progress` int DEFAULT 0,
  `status` text DEFAULT 'active',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create knowledge_items table
CREATE TABLE IF NOT EXISTS `knowledge_items` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `title` text NOT NULL,
  `content` text NOT NULL,
  `tags` json,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS `wallet_transactions` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `type` text NOT NULL,
  `description` text,
  `status` text DEFAULT 'completed',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS `analytics_events` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `event_type` text NOT NULL,
  `data` json,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create voice_commands table
CREATE TABLE IF NOT EXISTS `voice_commands` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `command` text NOT NULL,
  `parameters` json,
  `result` text,
  `status` text DEFAULT 'success',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create ai_agents table
CREATE TABLE IF NOT EXISTS `ai_agents` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `config` json,
  `enabled` boolean DEFAULT true,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create media_projects table
CREATE TABLE IF NOT EXISTS `media_projects` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `title` text NOT NULL,
  `type` text NOT NULL,
  `content` text,
  `status` text DEFAULT 'draft',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create indexes for better query performance
CREATE INDEX idx_tasks_user_id ON `tasks`(`user_id`);
CREATE INDEX idx_tasks_status ON `tasks`(`status`);
CREATE INDEX idx_goals_user_id ON `goals`(`user_id`);
CREATE INDEX idx_goals_status ON `goals`(`status`);
CREATE INDEX idx_knowledge_items_user_id ON `knowledge_items`(`user_id`);
CREATE INDEX idx_wallet_transactions_user_id ON `wallet_transactions`(`user_id`);
CREATE INDEX idx_analytics_events_user_id ON `analytics_events`(`user_id`);
CREATE INDEX idx_voice_commands_user_id ON `voice_commands`(`user_id`);
CREATE INDEX idx_ai_agents_user_id ON `ai_agents`(`user_id`);
CREATE INDEX idx_media_projects_user_id ON `media_projects`(`user_id`);
