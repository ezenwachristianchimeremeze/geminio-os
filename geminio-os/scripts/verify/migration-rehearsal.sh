#!/usr/bin/env bash
# Migration rehearsal against DISPOSABLE MySQL databases (never point this at production).
# NOT YET RUN: the authoring sandbox has no MySQL. Run on a machine with MySQL 8.0.13+ and deps installed (docs/VERIFICATION.md).
#
#   MYSQL_HOST=127.0.0.1 MYSQL_USER=root MYSQL_PWD=... bash scripts/verify/migration-rehearsal.sh
#
# Scenario A: empty database -> apply all migrations -> second apply is a no-op.
# Scenario B: database at the 0009 state with representative rows -> apply new migrations -> existing data preserved and backfilled.
# Precondition: you already ran `pnpm drizzle-kit generate` (journaled 0010+) and re-added the manual backfill UPDATE (drizzle/pending/README.md).
set -euo pipefail
: "${MYSQL_HOST:=127.0.0.1}"; : "${MYSQL_USER:=root}"
M="mysql -h $MYSQL_HOST -u $MYSQL_USER --batch --skip-column-names"
fail() { echo "FAIL: $*" >&2; exit 1; }
migrate() { DATABASE_URL="mysql://$MYSQL_USER:${MYSQL_PWD:-}@$MYSQL_HOST:3306/$1" pnpm drizzle-kit migrate; }

# ---- Scenario A: empty schema
$M -e "DROP DATABASE IF EXISTS geminio_mig_empty; CREATE DATABASE geminio_mig_empty CHARACTER SET utf8mb4"
migrate geminio_mig_empty
before=$($M -D geminio_mig_empty -e "SELECT COUNT(*) FROM __drizzle_migrations")
migrate geminio_mig_empty   # must be a no-op
after=$($M -D geminio_mig_empty -e "SELECT COUNT(*) FROM __drizzle_migrations")
[ "$before" = "$after" ] || fail "second migrate changed the migration table ($before -> $after)"
pk=$($M -D geminio_mig_empty -e "SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='geminio_mig_empty' AND TABLE_NAME='homeChatScheduleRuns' AND INDEX_NAME='PRIMARY'")
[ "$pk" = "scheduleId,occurrence" ] || fail "homeChatScheduleRuns primary key is '$pk'"
f=$($M -D geminio_mig_empty -e "SELECT COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='geminio_mig_empty' AND TABLE_NAME='orchestrationRuns' AND COLUMN_NAME='fence'")
[ "$f" = "0" ] || fail "orchestrationRuns.fence default is '$f'"
echo "A ok: empty schema migrates, re-run is a no-op, PK and fence present"

# ---- Scenario B: existing data at the 0009 state
# Apply ONLY migrations 0000-0009 through drizzle itself (so __drizzle_migrations is correct), using a truncated copy of the folder.
OLD=$(mktemp -d); cp -r drizzle/. "$OLD/"; rm -rf "$OLD/pending"
node -e '
  const fs=require("fs"); const p=process.argv[1]+"/meta/_journal.json"; const j=JSON.parse(fs.readFileSync(p,"utf8"));
  j.entries=j.entries.filter(e=>e.idx<=9); fs.writeFileSync(p,JSON.stringify(j,null,2));
  for (const f of fs.readdirSync(process.argv[1])) { const m=/^(\d{4})_.*\.sql$/.exec(f); if (m && +m[1]>9) fs.unlinkSync(process.argv[1]+"/"+f); }
' "$OLD"
cat > "$OLD/drizzle.old.config.ts" <<CFG
import { defineConfig } from "drizzle-kit";
export default defineConfig({ schema: "./drizzle/schema.ts", out: "$OLD", dialect: "mysql", dbCredentials: { url: process.env.DATABASE_URL! } });
CFG
$M -e "DROP DATABASE IF EXISTS geminio_mig_data; CREATE DATABASE geminio_mig_data CHARACTER SET utf8mb4"
DATABASE_URL="mysql://$MYSQL_USER:${MYSQL_PWD:-}@$MYSQL_HOST:3306/geminio_mig_data" pnpm drizzle-kit migrate --config "$OLD/drizzle.old.config.ts"
$M -D geminio_mig_data <<'SQL'
INSERT INTO users (openId, name) VALUES ('mig-user', 'Mig User');
SET @u = (SELECT id FROM users WHERE openId='mig-user');
INSERT INTO conversations (id, userId, title, createdAt, updatedAt) VALUES
  ('c_old', @u, 'old chat',  '2025-01-01 10:00:00', '2025-01-01 10:00:00'),
  ('c_new', @u, 'new chat',  '2025-06-01 10:00:00', '2025-06-01 10:00:00'),
  ('c_empty', @u, 'no messages', '2025-03-01 10:00:00', '2025-03-02 10:00:00');
INSERT INTO messages (id, userId, content, role, conversationId, createdAt) VALUES
  ('m1', @u, 'hi', 'user', 'c_old', '2025-01-01 10:00:05'),
  ('m2', @u, 'hello', 'assistant', 'c_old', '2025-01-02 11:30:00'),
  ('m3', @u, 'yo', 'user', 'c_new', '2025-06-05 09:00:00');
SQL
# Now apply the FULL journaled folder (the migrations generated after 0009) to the populated database.
migrate geminio_mig_data
rows=$($M -D geminio_mig_data -e "SELECT (SELECT COUNT(*) FROM conversations), (SELECT COUNT(*) FROM messages)")
[ "$rows" = $'3\t3' ] || fail "rows lost or duplicated: '$rows'"
got=$($M -D geminio_mig_data -e "SELECT id, lastMessageAt FROM conversations ORDER BY id" | tr '\t' ' ' | tr '\n' ';')
exp="c_empty 2025-03-02 10:00:00;c_new 2025-06-05 09:00:00;c_old 2025-01-02 11:30:00;"
[ "$got" = "$exp" ] || fail "lastMessageAt not backfilled from messages. got: $got expected: $exp"
echo "B ok: data preserved, lastMessageAt backfilled from real message times (empty chat falls back to updatedAt)"
echo "Rehearsal passed. Record the output in BLUEPRINT_IMPLEMENTATION_MATRIX.md; then drop geminio_mig_empty and geminio_mig_data."
