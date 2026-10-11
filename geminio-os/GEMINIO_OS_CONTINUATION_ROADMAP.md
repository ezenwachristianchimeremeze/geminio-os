# Geminio OS Continuation Roadmap

Work from checkpoint `692f21a02781b7568bd504eac4a560fbe1436be9` and preserve the existing architecture.

## 1. Approved isolated container/microVM provider

Implement the production `ExecutionProvider` behind the existing runner adapter. Enforce per-job project/version workspace isolation, CPU/memory/disk/process/output/time limits, deny-by-default networking, host and metadata isolation, short-lived scoped secrets, worker heartbeats, and teardown. Add provider integration tests with a disposable fixture. Never execute generated code in the main API process.

## 2. Streaming preview gateway

Connect runner output to the existing authenticated preview gateway. Add signed/short-lived session tokens, websocket or equivalent streaming transport, reconnect/backoff, preview expiration, clean shutdown, and gateway-only exposure. Add browser tests for ready, disconnect, reconnect, expired, unavailable, and shutdown states.

## 3. Live diagnostic events

Stream structured queued/preparing/building/ready/error/retry/recovery/cancelled/timeout events into Live Builder. Preserve event ordering, ownership, redaction, pagination, and durable replay after reconnect. Expose diagnostics to the AI debugging agent with bounded repair attempts.

## 4. Authenticated Builder browser automation

Create a non-production authenticated test fixture and automate Create → Generate → Build → Run → Preview → Select → AI Edit → Rebuild → Validate → Version, plus failed build → diagnostics → restore last-known-good → rebuild. Keep provider-unavailable tests explicit when infrastructure is absent.

## 5. Remaining Geminio OS functionality

Audit every product section for real persistence, provider boundaries, action completion, loading/empty/error/retry states, and ownership. Replace only confirmed temporary state or dead routes; do not redesign verified UI.

## 6. Security hardening

Run dependency/security audits, review OAuth/session/cookie settings, enforce strict origin policy, test authorization across all runner/preview/project endpoints, add secret redaction tests, and document threat-model controls.

## 7. Performance

Measure API latency, database query plans, queue depth, runner startup, preview latency, and mobile/web bundle behavior. Add bounded caching, pagination, indexes, and observability dashboards without weakening isolation.

## 8. Production deployment

Define environment/secrets management, database migration procedure, backups, rollback, monitoring, alerting, domains, TLS, rate limits, and provider readiness checks. Do not publish executable preview capability until the isolated provider passes security and recovery acceptance tests.

## 9. Final end-to-end testing

Run typecheck, lint, unit, integration, API, auth, database, navigation, Builder, runner, preview, diagnostics, recovery, browser E2E, production build, and post-deploy smoke checks. Record exact results in a new checkpoint and update this roadmap.

---
## Consolidation follow-ups (priority order)
1. On a networked machine: `pnpm install && pnpm check && pnpm lint && pnpm test && pnpm build`; fix any merge regressions (esp. `mergeRouters` wiring in server/routers.ts and zod v4 typing of the merged routers).
2. Run migrations 0000–0009 against a real MySQL; confirm journal/snapshots consistent.
3. Expose `lib/ai-builder` through a tRPC router and connect to Live Builder (Prompt → Plan → Code → Preview → Edit → Test → Deploy).
4. Decide on the 11 E-only tables; add to `drizzle/schema.ts` and run `drizzle-kit generate` to produce migration 0010 + snapshot.
5. Wire job-hub/finance/documents/device-control/privacy screens to real routers; replace archived simulated studio screens with calls to real providers (video/music generation needs an external provider).
6. Real-time notifications: re-evaluate archived websocket module (needs `ws` dependency + authenticated upgrade).
7. External runner/microVM provider, payment provider, push provider — still required for production.

---
## Next (ordered)
1. Real toolchain baseline (`pnpm install/check/test/build`), then `drizzle-kit generate` for 0010 and delete `drizzle/pending/`.
2. Server-side credit metering in AI Core + atomic ledger (transaction/row lock); remove or admin-gate `credits.recordUsage`.
3. Wrap `applyLiveBuilderChangeSet` in `db.transaction`.
4. AI Builder UI screens bound to `trpc.aiBuilder.*`.
5. Developer platform tables (apiKeys hashed, developerProjects, usage) + gateway auth.
6. MFA; marketplace/orders; wallet provider boundary; remaining modules per matrix.

---
## Next after Dev Preview
1. Real toolchain baseline (needs registry + MySQL), then `drizzle-kit generate` (aiBuilder tables; delete drizzle/pending).
2. Credits: pricing config (no invented prices) → server-side metering in AI Core → atomic ledger (transaction + row lock) → idempotent reserve/finalize/refund.
3. Transactional `applyLiveBuilderChangeSet`; AI-generated `proposeLiveBuilderPromptChange`.
4. Developer platform (projects, hashed API keys, scopes, rate limits, usage).
5. Light-mode text contrast: add AA-safe text variants for success/warning/error/accent (69 usages) without changing the blueprint fill colors.
6. AI Builder UI bound to `trpc.aiBuilder.*`.
