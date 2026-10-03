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
