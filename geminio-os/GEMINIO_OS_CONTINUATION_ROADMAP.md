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
