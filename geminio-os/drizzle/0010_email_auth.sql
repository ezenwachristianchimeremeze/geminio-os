CREATE TABLE IF NOT EXISTS auth_credentials (
  userId int NOT NULL,
  email varchar(320) NOT NULL,
  passwordHash varchar(160) NOT NULL,
  emailVerified tinyint(1) NOT NULL DEFAULT 0,
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (userId),
  UNIQUE KEY auth_credentials_email_uq (email),
  CONSTRAINT auth_credentials_user_fk FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS auth_action_tokens (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  tokenHash char(64) NOT NULL,
  userId int NOT NULL,
  purpose enum('verify','reset') NOT NULL,
  expiresAt timestamp NOT NULL,
  consumedAt timestamp NULL,
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY auth_action_token_hash_uq (tokenHash),
  KEY auth_action_user_purpose_idx (userId,purpose,consumedAt),
  CONSTRAINT auth_action_user_fk FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
