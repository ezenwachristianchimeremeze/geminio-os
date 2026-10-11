# Pending migration (NOT journaled)

`0010_ai_builder.sql` is a hand-written REVIEW COPY of the DDL for `aiBuilderProjects` and
`aiBuilderEvents` (see `drizzle/schema.ts`). It was written without drizzle-kit available.

Do NOT copy it into `drizzle/` or edit `meta/_journal.json`. Instead, on a machine with
dependencies: run `pnpm drizzle-kit generate`, compare the generated SQL with this file,
keep the generated one (it also writes `meta/0010_snapshot.json`), then delete this directory.

## 0011 note: carry the data backfill over

`0011_home_chat_credits.sql` contains one **data** statement (`UPDATE conversations SET lastMessageAt = …`) that
`drizzle-kit generate` cannot produce, because it only emits DDL. After regenerating, append that UPDATE to the generated
migration (after the `lastMessageAt` column is added), otherwise every pre-existing conversation is stamped with the
migration time and the history order is lost. Also keep the composite primary key on `homeChatScheduleRuns`
(`scheduleId`, `occurrence`): managed MySQL services that enforce primary keys reject tables without one.

## What must survive `drizzle-kit generate` (and why)

| Item | Where it lives | Why it is not produced by generate | Consequence if lost |
|---|---|---|---|
| `UPDATE conversations SET lastMessageAt = COALESCE(MAX(messages.createdAt), updatedAt)` | 0011 | drizzle-kit emits DDL only, never data statements | every existing conversation shows the migration time; history order is lost |
| Composite PK on `homeChatScheduleRuns (scheduleId, occurrence)` | schema.ts (`primaryKey(...)`) | is generated, but verify | keyless table rejected by managed MySQL; duplicate occurrences possible |
| `orchestrationRuns.fence` default 0 | 0012 / schema.ts | is generated, but verify | stale-worker fencing breaks if existing rows are NULL |

`tests/migration-pending.test.ts` checks the staged files and schema for these; after regenerating, run
`scripts/verify/migration-rehearsal.sh` (empty schema + representative data, disposable databases only).
