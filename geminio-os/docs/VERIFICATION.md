# Verification procedure (real toolchain)

Everything below must be run on a machine that has the prerequisites. **None of it has been run in the authoring
sandbox** (npm registry blocked, no MySQL, no Expo). Record real results in `BLUEPRINT_IMPLEMENTATION_MATRIX.md`; a row may
become `VERIFIED` only with `Runtime verified = Yes` and a pointer to the evidence (command output / log).

## 0. Machine requirements

| Need | Requirement |
|---|---|
| Node | >= 22.5 (tests use `node:sqlite`; developed on 22.22) |
| Package manager | pnpm 9.12.0 (`packageManager` in package.json); registry access to registry.npmjs.org |
| Database | MySQL **8.0.13+** (expression defaults `DEFAULT (now())`, `json` columns, `utf8mb4`). MySQL 8.4 LTS recommended. MariaDB is not supported by the generated DDL. |
| Browser (optional) | Chromium + Playwright for `scripts/verify/browser-recorder.cjs` |
| Python (optional) | python-docx, openpyxl, pypdf for the office cross-validation test (skips when absent) |
| Mobile (optional) | Expo Go / emulator for native checks (expo-audio, expo-speech, picker) |

Provider credentials are needed **only** for the provider-dependent checks in section 9; everything else runs without them.

## 1. Install (from the lockfile)

```bash
pnpm install --frozen-lockfile     # must not modify pnpm-lock.yaml
```

## 2. Environment

Copy `.env.example` to `.env` (never commit it). Minimum for a local run:

```
NODE_ENV=development
DATABASE_URL=mysql://USER:PASSWORD@127.0.0.1:3306/geminio_verify   # a scratch database
JWT_SECRET=<random 32+ bytes>
CREDITS_ENFORCEMENT=off     # optional: lets Live Builder e2e run without seeding credits (ignored in production)
```
`VITE_APP_ID`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID` are needed for real OAuth sign-in. Optional providers: `BUILT_IN_FORGE_API_URL/KEY`
(LLM), `WEB_SEARCH_API_KEY`, `STT_API_URL/KEY`, `GEMINIO_SANDBOX_URL/KEY`, `AI_MODEL_*`.

## 3. Database

```bash
mysql -uroot -e "CREATE DATABASE geminio_verify CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
```
Migrations 0000-0009 are journaled in `drizzle/`. **0010 and 0011 are hand-written review copies in `drizzle/pending/` and are NOT
journaled.** Before running migrations:

1. `pnpm drizzle-kit generate` — produces journaled migrations + snapshots for the schema changes. Diff against `drizzle/pending/*.sql`; keep the generated DDL.
2. Re-add the data backfill `UPDATE conversations SET lastMessageAt = ...` from `0011` to the generated migration (drizzle-kit does not generate data statements).
3. Delete `drizzle/pending/`.
4. `pnpm drizzle-kit migrate` — applies to `DATABASE_URL`. Run it **twice**: the second run must be a no-op (drizzle records applied migrations).
5. Verify: `SHOW CREATE TABLE homeChatScheduleRuns` has a composite primary key; `creditReservations` has `UNIQUE(userId, requestId)`; `aiOperations` has `UNIQUE(userId, key)`.
6. For an existing production-like database: rehearse on a restored copy first (DDL is not transactional in MySQL; a mid-file failure leaves partial changes).

## 4. Static checks

```bash
pnpm check          # tsc --noEmit (strict). Expect zero errors; fix real ones, do not add @ts-ignore
pnpm lint           # expo lint
pnpm security:audit
```

## 5. Tests (real Vitest)

```bash
pnpm test           # vitest run; config: vite.config.ts (environment: node, include tests/**/*.test.ts)
```
Expected on a correct environment: all 50+ suites load. Notes on the four suites that could not load offline:

| Suite | Why it failed offline | Needs |
|---|---|---|
| `performance` | `vi.mock("expo-font")` is a no-op in the offline shim; real Vitest hoists it (the `@/` alias is in vite.config.ts) | real vitest |
| `ai-core.contracts` | imports drizzle-orm through `server/live-builder/service` | installed deps (no DB connection needed) |
| `auth.logout` | imports `@trpc/server` via `server/routers`; was `describe.skip` (template TODO) — now enabled, fixture given a `hostname` | installed deps |
| `live-builder.e2e` | skipped without `DATABASE_URL`; the AI-edit case also needs `BUILT_IN_FORGE_API_KEY` | MySQL (+ LLM for AI case) |

If `node:sqlite` is unavailable (Node < 22.5) the SQLite-backed suites cannot run; upgrade Node. Unset `GITHUB_TOKEN`/`GH_TOKEN` when running `tests/comprehensive.test.ts`
(it asserts the GitHub client throws when unconfigured).

## 6. Build and API startup

```bash
pnpm build && NODE_ENV=production DATABASE_URL=... JWT_SECRET=... pnpm start
curl -fsS localhost:3000/api/health            # liveness
curl -fsS localhost:3000/api/health/ready      # must report db.ok = true
```

## 7. Dev Preview / app

```bash
pnpm dev        # server + Expo web (EXPO_PORT, default 8081)
pnpm dev:progress
```
Open the web app, sign in (OAuth), and exercise the Home flows in section 8. Check the browser console for errors.

## 8. Home Chat flows to exercise (each is a matrix row; record pass/fail)

1. New chat, send a message, reload: conversation persists (GO-HOME-001/002).
2. Credits: balance before/after; reserved during the run and settled to the exact charge after (GO-HOME-019). Send with 0 credits: nothing runs.
3. Rename/pin/archive/delete/export/share (open the share link in a signed-out window) (GO-HOME-003).
4. Stop generation mid-stream; regenerate; pick a variant; edit a message.
5. Deep mode: approve a plan, pause, resume, cancel; failed-step retry; check no credits stay reserved after cancel (GO-HOME-012/013).
6. Attachments (image/PDF/text/code): upload, ask about it; a `.env` upload is rejected (GO-HOME-009).
7. File generation md/csv/pdf/docx/xlsx: download and open each in a real viewer (GO-HOME-024).
8. Scheduling: create a reminder 2 minutes ahead; kill the server before it fires, restart: it fires once (GO-HOME-025).
9. Approval card for `deploy_request` and refused `delete_project`.
10. Accessibility/responsive at 360px, 768px, 1280px; light/dark; keyboard-only; screen reader labels.

## 9. Provider-dependent checks (only with credentials)

- LLM: streaming reply, cancel mid-stream, provider outage message.
- Web search (`WEB_SEARCH_API_KEY`): a news question shows real citations; unset the key and confirm the honest "unavailable" message.
- STT (`STT_API_KEY`): record in the browser, transcript appears as an editable draft and is never auto-sent.
- Sandbox (`GEMINIO_SANDBOX_URL/KEY`): run a snippet; without it the UI must say code was not run.

## 10. Browser/offline scripts that need no app

```bash
NODE_PATH=<global node_modules> ESBUILD=<path to esbuild> node scripts/verify/browser-recorder.cjs /tmp/verify-out
npx tsx scripts/verify/stt-browser-audio.ts /tmp/verify-out
```

## What the offline evidence does and does not prove

Offline suites (shim) and SQLite/real-socket tests prove the pure logic and our client side of each protocol. They do **not**
prove: MySQL adapters, migrations, tRPC routing, orchestrator wiring (including `run-guard` CAS against real row locks), React Native
rendering, or any third-party provider.


## v12 additions
- Apply `drizzle/pending/0010`–`0012` after journaled 0000–0009; run `scripts/verify/migration-rehearsal.sh` against a disposable MySQL (empty and seeded). After `drizzle-kit generate`, re-add the `lastMessageAt` backfill UPDATE (see `drizzle/pending/README.md`).
- New suites: `ai-core-run-guard.test.ts`, `ai-core-run-guard.db.test.ts`, `migration-pending.test.ts`, `session-cookies.test.ts`. The `.db` suite uses `node:sqlite` as a **stand-in**: its pass is "SQL-engine tested", not "MySQL verified". Port the claim/CAS statements to MySQL and repeat before promoting.
- Report four result classes separately: shim, real Vitest, DB integration (MySQL), live app. `performance` and `ai-core.contracts` must load under real Vitest; `live-builder.e2e` AI-edit test needs `DATABASE_URL` and `BUILT_IN_FORGE_API_KEY`.

## v13 additions
- `docs/VERIFICATION_REGISTER.md` (regenerate with `python3 scripts/verify/build-register.py`) is the per-feature evidence record; `docs/DEFECT_REGISTER.md` lists defects and open findings. When a check passes on a real machine, update the curated evidence in the script and the matrix together, then promote rows only when R+M+A+U+E (as applicable) all passed.
- New suite: `tests/verification-defects.test.ts` (30 tests; the preview/runner/pipeline cases are behavioural, the rest are source scans that also run under real Vitest).
- Extra checks to run with a real stack: two real users (cross-tenant attempts on preview/runtime/conversation ids must be NOT_FOUND), duplicate `homeChat.send` with the same `clientRequestId` (one run, one hold), stop/pause/resume on a finished run (4xx, not 500), startup with empty `JWT_SECRET` (sign-in must fail, not succeed).

## v15 additions
- `tests/task-approvals.db.test.ts` (15) and `tests/runtime-session-cas.db.test.ts` (3) run real SQL on SQLite: **stand-in, not MySQL**. To promote DEF-011/012/013 port the statements (`RESOLVE_SQL` and the others in `tests/helpers/sqlite-approval-store.ts`) to MySQL or run the real stores against it.
- Real API check: with the server running against a disposable MySQL, `API_BASE=... DATABASE_URL=... JWT_SECRET=... VITE_APP_ID=... pnpm tsx scripts/verify/two-user-api-check.ts`. It prints every assertion with the HTTP status and DB snapshots and exits 1 on failure. It has never been executed; table/column names were checked against `drizzle/schema.ts` only.

## v16 additions
- Parser test rerun (`tests/dev-preview.test.ts`, matrix-progress block) under the custom shim: 21/21 pass; offline regression 51 suites / 859 tests, 4 suites unloadable (missing deps). No code or status changes; real Vitest/MySQL/API/E2E still blocked.

## v17 additions
- DEF-016 / OPEN-004 fixed (S/T only). New suites: `tests/cron-principal.test.ts` (5), `tests/verify-safety-guard.test.ts` (5). Offline shim regression: 53 suites / 869 tests pass; 4 suites cannot load. Saved output: `docs/evidence/regression-v17.txt`; environment probe: `docs/evidence/env-probe-v17.txt`.
- **Two-user API check — prerequisites and exact command.** Needs: a running server (`pnpm dev`) started with `JWT_SECRET` (>=32 chars) and `VITE_APP_ID`; a disposable MySQL whose database name contains `test|verify|tmp|scratch|disposable|ci`, migrated (`pnpm db:push` or the journal plus `drizzle/pending/0010-0012`); `jose` and `mysql2` installed. Command:
  `API_BASE=http://localhost:3000 DATABASE_URL=mysql://user:pw@localhost:3306/geminio_verify_tmp JWT_SECRET=<server value> VITE_APP_ID=<server value> VERIFY_CONFIRM=i-understand-this-inserts-rows pnpm tsx scripts/verify/two-user-api-check.ts > two-user-result.json; echo $?`
  The guard (`scripts/verify/safety-guard.ts`, unit-tested) refuses production, non-disposable DB names, remote hosts (override `VERIFY_ALLOW_REMOTE=yes`) and short secrets. The script inserts rows and deletes none. **Status: NOT RUN.** The guard is tested; the script body is syntax-checked only. The guard runs after ES-module imports resolve, so missing `jose`/`mysql2` fails before the guard prints.
- **Route to real verification (all blocked here, probed once, not retried):** Node v22.22.0 matches; `packageManager` pnpm@9.12.0 cannot be fetched (registry DNS fails: `getaddrinfo ENOTFOUND registry.npmjs.org`; the sandbox proxy lists the registry as no-proxy so there is no sanctioned route; pip also fails); `pnpm-lock.yaml` present; no `node_modules`; no mysqld/mariadbd; docker CLI present but no daemon socket. On a networked machine: `corepack enable && pnpm install --frozen-lockfile`, then `pnpm test`, `pnpm check`, `pnpm lint`, the build; the four unloadable suites load once `drizzle-orm`, `@trpc/server` and `expo-font` are installed; do not stub them. Start MySQL (`docker run --rm -e MYSQL_ROOT_PASSWORD=... -e MYSQL_DATABASE=geminio_verify_tmp -p 3306:3306 mysql:8`), run migrations, rerun approval/CAS/run-guard scenarios against it, then the two-user script.

## v18 additions
- `eas.json` (internal APK `preview` profile), `docs/ANDROID_TEST_BUILD.md`, `tests/android-build-config.test.ts` (4). **No APK was built, installed or launched**; build, launch and backend integration are each unverified. A future successful APK build proves only that it compiles/packages, not that any feature works.
