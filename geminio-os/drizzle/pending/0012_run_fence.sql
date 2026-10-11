-- REVIEW COPY (hand-written, never run). Regenerate with `pnpm drizzle-kit generate` and keep the generated SQL.
-- Fencing token for AI run workers (server/ai-core/run-guard.ts). Existing rows start at 0; every claim increments it.
ALTER TABLE `orchestrationRuns` ADD `fence` int DEFAULT 0 NOT NULL;
