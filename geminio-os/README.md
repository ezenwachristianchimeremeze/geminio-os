# Geminio OS Developer Handoff

This directory is a clean export of the verified Geminio OS checkpoint `692f21a02781b7568bd504eac4a560fbe1436be9` on branch `main`.

## Quick start

```bash
pnpm install
cp .env.example .env
# Fill only approved development values in .env
pnpm check
pnpm test -- --run
pnpm build
pnpm dev
```

The development server starts the API on port `3000` and Expo web/Metro on port `8081` by default. Run `pnpm release:check` for the combined typecheck, lint, test, and server-build validation.

## Documents

- `GEMINIO_OS_DEVELOPER_HANDOFF.md` — architecture, setup, security, and operation guide.
- `GEMINIO_OS_IMPLEMENTATION_STATUS.md` — current verified implementation status and limitations.
- `GEMINIO_OS_CONTINUATION_ROADMAP.md` — prioritized next engineering work.
- `GEMINIO_OS_CHECKPOINT.md` — exact Git checkpoint and export details.

## Security

This export contains no production credentials, API keys, passwords, private certificates, `node_modules`, build caches, `.git`, or operational logs. Configure secrets through an approved secret manager or local ignored `.env`; never commit them.

## Setup (consolidated)
```
cp .env.example .env     # fill from your secret manager
pnpm install
pnpm check && pnpm test  # verify the merge first
pnpm db:push             # needs DATABASE_URL (MySQL)
pnpm dev
```

## Development preview (Preview panel, Build Progress, Activity)
Admin-only, development-only. Set `GEMINIO_DEV_PREVIEW=1` (and make your account admin via `OWNER_OPEN_ID`), run the API once with `pnpm dev:server` (or any way you normally start it), sign in, and open `/dev-preview` (also linked from Live Builder → "Dev preview").
- **Start** runs only three fixed commands: `pnpm install --frozen-lockfile` (only if `node_modules` is missing), `pnpm build`, `pnpm dev`. Nothing from the request reaches a command line.
- States come from the Live Builder runner control plane. "Ready" requires the Metro URL, the API and the database (`/api/health/ready`) to answer; otherwise it stays "Running" and shows the warning (e.g. "Database unavailable").
- **Build Progress** is computed from `BLUEPRINT_IMPLEMENTATION_MATRIX.md` on every request (`pnpm dev:progress` prints the same numbers). Add rows there; never store percentages elsewhere.
- **Activity** reads `.geminio/dev-activity.jsonl`. The supervisor writes to it; an engineer/agent adds a real entry with `pnpm dev:activity "Running tests"`. Entries carry the time they were *recorded*.


## Home Universal AI Chat (status: implemented offline, NOT runtime-verified)

See `BLUEPRINT_IMPLEMENTATION_MATRIX.md` (GO-HOME-001..029) for the honest per-feature status.

- Pipeline: `server/home-chat/pipeline.ts` (validate -> idempotency -> credit reservation -> real web search -> AI Core -> settle).
- Credits: `server/credits/ledger.ts` (atomic reserve/finalize/release/grant; micro-credits). Prices are placeholders.
- Conversations: `server/home-chat/conversations.ts` + `mysql-store.ts`; public read-only share at `/shared/<token>`.
- Voice: `server/home-chat/stt.ts` (provider abstraction), `lib/home-chat/*` (recorder/speech state machines, platform adapters).
- Schema changes are staged in `drizzle/pending/0011_home_chat_credits.sql`; regenerate with `pnpm drizzle-kit generate` on real infra, then delete `drizzle/pending/`.
- Offline tests: `NODE_PATH=<shim> tsx --test tests/home-chat-*.test.ts tests/credits-ledger.test.ts` (a node:test shim, NOT real vitest).
