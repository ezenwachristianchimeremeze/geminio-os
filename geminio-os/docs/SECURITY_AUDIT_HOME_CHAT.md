# Security audit — Home chat, credits, AI Core (static review; NOTHING here was exercised at runtime)

## Fixed during this audit
| # | Finding | Fix |
|---|---|---|
| 1 | Unauthenticated `chat.sendMessage` fell back to a raw, unmetered LLM call with a hard-coded model | Fallback removed; returns "sign in" |
| 2 | AI Core never charged credits; client-reachable paths were free | `server/credits/metering.ts` reserves in `submitAiRequest` for every caller and settles at terminal states |
| 3 | Credit ledger was read-modify-write (double-spend race) | Reservation ledger with account-row lock; 20-way concurrency test on SQLite |
| 4 | Retrying a settled run in place would be unmetered | `retryAiRun` refuses; user must resubmit |
| 5 | Attachment filter bypass: `sanitizeName` stripped the leading dot so `.env` / `.npmrc` evaded the blocklist | Blocklist is checked on the original basename too (found by a test) |
| 6 | Client-claimed MIME could mislabel content | Type decided from magic bytes / UTF-8 validity, never from the client MIME |
| 7 | Client could try to inject trusted AI parameters | `trustedParameters` / `template` / `reservationManagedByCaller` exist only on server-side `SubmitOptions`, not in the zod request schema |
| 8 | Markdown/link rendering of model or web text | No HTML is produced; links limited to http(s)/mailto; citations only render for real sources |
| 9 | Web results as prompt-injection vector | Results are labelled UNTRUSTED data; same for attachment text and prior-step outputs |
| 10 | Credit grants callable by any user | `credits.grant` / `credits.recordUsage` are admin-only |

## Credit audit (every AI-consuming path; static review)
| Path | Authenticated | Metered | Idempotent / double-spend | Settled on every end state |
|---|---|---|---|---|
| Home chat send / regenerate / edit (`homeChat.*`) | yes | reserve before search; per-step settle | unique (user, requestId); clientRequestId | worker settles; poll + reconciliation backstop |
| `aiCore.submit` and all `submitAiRequest` callers (Live Builder AI edit, legacy `chat.sendMessage`) | yes | `reserveForRun` in orchestrator | unique (user, requestId) | worker/cancel settle; reconciliation |
| Router classification call (`routeIntent`) | yes | `ai.route` (0.2); falls back to deterministic routing when unaffordable | `route:<requestId>` | success finalize / failure release |
| AI Builder LLM adapter | yes (builder context) | `ai_builder.<operation>` per logical call incl. retries | random request id per call | finalize / release in `runMetered` |
| `features`, `chat` extras, `jobs` routers (direct LLM) | yes | `legacy.<router>.<proc>` via `meteredLLM` | replay guard in `runMetered` | finalize / release |
| `builders` router (direct LLM) | **was PUBLIC -> now protected** | `legacy.builders.*` | same | same |
| Voice transcription | yes | 1 credit, only if transcription succeeds | random id | finalize / release |
| `retryAiRun` on a settled run | yes | refused (resend instead) | n/a | n/a |
| Paused runs | yes | hold kept; auto-cancel after AI_PAUSE_MAX_HOURS | n/a | `expirePausedRuns` |
Reservation expiry: reservations never expire by themselves; `reconcileUnsettledReservations` settles terminal runs and releases orphans after 2 minutes.
All legacy LLM procedures are now execute-once mutations (`onceLLM` -> `executeOnce`): repeating the same idempotency key returns the stored result without calling the provider or charging; `operations.get` reads results without executing. A source-scan test (`tests/no-refetchable-ai.test.ts`) fails the build if any tRPC query calls an AI function or any code calls `invokeLLM` outside the metered wrappers.
Remaining gaps: calls made WITHOUT an idempotency key are each a distinct charged operation (a deliberate double-click is two operations); pricing is placeholder; model-side retention is outside our control.

## Added this round
| # | Finding | Fix |
|---|---|---|
| 11 | Legacy LLM *queries* could be re-fetched and re-charged | execute-once operations (above) |
| 12 | A scheduler crash after claiming an occurrence lost the run | per-occurrence execution records with leases, bounded retry, recovery; stale runs skipped with notice |
| 13 | Home had no approval boundary for consequential actions | server-generated approval cards; single execution under concurrent approvals; expiry; audit; unsupported actions refused |
| 14 | Generated office files could be malformed yet reported as success | structural validation + read-back byte check before success; independent-parser verification |
| 15 | Paused tasks could hold credits indefinitely | server-side expiry sweep (AI_PAUSE_MAX_HOURS) |
| 16 | **Stale worker could resurrect a cancelled/paused run.** `executeQueuedJob` read the run, then wrote `executing`/`completed`/`failed` and re-queued the job unconditionally, so a cancel landing in that window was overwritten (the run executed or was reported completed, after cancel had released its credits) | claim, finish, failure and re-queue are compare-and-set transitions (`server/ai-core/run-guard.ts`, `casOrchestrationRun`, `casAiJob`); on a lost CAS the worker stops without answering, charging or notifying; the finish takes `executing -> verifying` before any visible side effect. Logic tested offline (9 + 1 tests); **against real MySQL row semantics: pending** |
| 17 | `homeChatScheduleRuns` had no primary key (rejected by managed MySQL that enforces PKs) | composite PK (scheduleId, occurrence) in schema + staged SQL |
| 18 | `0011` migration stamped every existing conversation with the migration time | backfill from latest message (must be re-added by hand after `drizzle-kit generate`; documented in drizzle/pending/README.md) |
| 19 | Provider-backed template helpers (`generateImage`, `transcribeAudio`, `callDataApi`) are unreferenced today but unmetered if ever wired | source-scan test fails if they are called outside their own modules |

| 20 | **Zombie worker after lease expiry could overwrite a newer result.** CAS alone cannot stop a worker that still holds the expected status. | fencing token `orchestrationRuns.fence`, incremented on claim; all worker writes are `WHERE fence = ?`; stale writers get `StaleWorkerError` (migration 0012) |
| 21 | Resume/retry enqueued the job before flipping run status, stranding runs; cancel could flip an already-charged completed run | status flipped first (CAS), then enqueue; cancel only from non-terminal states; finish takes `executing→verifying` before visible side effects |
| 22 | `liveBuilder.proposeFileChange` charged credits for user-authored edits | no AI run / no charge; audit event only; AI edits stay metered |

| 23 | Preview sessions (`createPreviewSession`) and runtime sessions (`startRuntime`) trusted client-supplied workspace/version/runtime ids | ownership + membership checks (DEF-001, DEF-006) |
| 24 | Duplicate send (same clientRequestId) created duplicate runs/messages and a failed duplicate could release the original's credit hold | prior-run replay in `submitAiRequest`; reservation release only by its creator (DEF-008, DEF-009) |
| 25 | Session secret could be empty/placeholder | fail-closed `resolveSessionSecret` (DEF-005) |
| 27 | Approval/task UPDATEs were not scoped to the owner (cross-tenant write) | owner + pending predicates (DEF-011) |
| 26 | Public legacy chat accepted unbounded input | size limits (DEF-004) |

Open findings from the 2026-10-11 pass (session revocation, OAuth state, global 50 MB JSON limit, cron `id = -1`, in-memory preview sessions) are in `docs/DEFECT_REGISTER.md` (OPEN-001..008).

Evidence for 16–22: pure tests, source-scan tests and SQLite multi-connection/thread tests (SQL-engine stand-in). **Not verified on MySQL/InnoDB** (`affectedRows` semantics, transaction isolation in `claimOrchestrationRun`).

Audit pass 2026-10-10 re-inspected every AI call site (`invokeLLM` is reachable only via the provider layer and the metered wrappers; legacy `chat`/`jobs`/`features`/`builders` procedures are mutations with idempotency keys through `onceLLM`; Live Builder proposals go through `submitGatewayRequest`, which reserves credits). Two items were NOT changed: `liveBuilder.proposeFileChange` also submits an AI Core run (credits are reserved for a change the user wrote themselves; product decision whether that should be free), and duplicate execution after a worker lease expires is limited by persisted per-step completion but is not fenced (a fencing token on the job attempt would close it; needs MySQL concurrency testing).

## Open (not fixed; needs product or infrastructure decisions)
- **Run-guard on MySQL is unverified**: re-run `tests/ai-core-run-guard.db.test.ts` logic against InnoDB; `getParentDomain` cookie domain is not public-suffix aware (e.g. co.uk).
- **Signed attachment URLs and user instructions are stored in `orchestrationRuns.plan` / job payloads.** Client responses of `aiCore.submit/getRun/listRuns/getRunDetails` are now redacted (`server/ai-core/redact.ts`, 3 tests); the database rows themselves still contain them (encryption at rest = infrastructure).
- **No rate limit on the public `homeChat.shared` endpoint**; tokens are 192-bit random so enumeration is infeasible, but scraping a known link is unthrottled.
- **Rate limits are in-memory per process** (`sttHits`, AI Core `consumeRateLimit`); they reset on restart and do not span instances.
- **No spend ceiling per user/day** beyond the balance.
- **Per-process Node `crypto`/base64 uploads**: attachments are accepted as base64 JSON (≤ ~14.5 MB); confirm the Express body limit and add virus scanning for production.
- **Runner isolation** was not re-audited here; Home does not execute code.
- **Dependency audit / SAST** never run (no registry access).
- **Share links stay live until revoked** and include later messages; the UI says so.
- **Temporary chats**: deleted by our hourly sweep after 24h; the model provider's own retention is outside our control.

## Write-authorization audit (v15)
Question per write: is ownership/state enforced **by the write itself** (predicate or CAS), or only checked before/after? Evidence: S static review, T offline test, Q SQLite stand-in. **None of these is MySQL- or API-verified.**

| Operation | Enforcement | Verdict | Evidence |
|---|---|---|---|
| `taskApprovals` resolve | `UPDATE .. WHERE id AND userId AND status='pending'`; outcome from affected rows + owner-scoped read | enforced by the write (DEF-011) | S T Q |
| `agentTasks` update / transition | `WHERE id AND userId` (+ `AND state=?` CAS for transitions) | enforced by the write (DEF-011, DEF-012) | S T Q |
| `notifications` mark read / all | `WHERE id AND userId` | enforced | S |
| `orchestrationRuns` (cas/claim/update) | `WHERE id AND userId [AND status IN] [AND fence]` | enforced | S T Q (run-guard) |
| `aiQueueJobs` updates | by job id; reachable only after the owner-checked run is loaded | check-then-write on immutable ownership; internal | S |
| Home conversations/messages (update, delete, variants) | `WHERE id AND userId` | enforced | S T Q (store logic) |
| Home schedules / actions | `WHERE id AND userId [AND status]` | enforced | S T |
| AI Builder project | CAS `WHERE id AND userId AND version` | enforced | S |
| Live Builder workspace selection | owner predicate (DEF-015) | enforced | S T |
| Live Builder runtime session | owner-checked join before write; start result is CAS from `starting` (DEF-013) | check-then-write on immutable ownership + CAS | S Q |
| Live Builder apply (files/changesets) | ownership checked inside the apply lock; statements keyed by id/status | check-inside-lock (OPEN-010) | S Q |
| Preview gateway sessions | owner map; `createVerified` checks workspace/version/runtime (DEF-001) | enforced (in-memory, OPEN-005) | S T |
| Client-supplied `projectId` | `userOwnsProject` before any write (DEF-014) | check before write; ownership immutable | S T |
| Credits ledger | per-user `lockAccount` inside a transaction | enforced | S T Q |

Two-user API verification (denied requests must not mutate rows or trigger notifications, jobs, runs or credit changes) is **prepared, not run**: `scripts/verify/two-user-api-check.ts`.


## Principal audit (v17)
| Surface | Finding | Status | Evidence |
|---|---|---|---|
| tRPC `createContext` | Cron principal (`id -1`, `isCron`) became `ctx.user` and passed `protectedProcedure` (OPEN-004 / DEF-016) | fixed: `interactiveUserOrNull` | S T (`tests/cron-principal.test.ts`, mutation-checked) |
| `GET /api/auth/me` | returned the cron principal as a user | fixed: `assertInteractiveUser` | S T (wiring) |
| `POST /api/auth/session` | could set a cron token as a 1-year cookie | fixed: `assertInteractiveUser` | S T (wiring) |

Not verified: a real cron token against a live server (needs the platform's token issuer and `getUserInfoWithJwt`). Remaining auth findings by priority: OPEN-001 (no revocation, 1-year JWT), OPEN-002 (OAuth state), OPEN-003 (50 MB unauthenticated body limit).

## Secret hygiene (v18)
- DEF-017: `.project-config.json` removed and ignored; credentials it contained must be rotated (they exist in archives v8-v17). Evidence: S T only. Android build env uses only public `EXPO_PUBLIC_*` values; see `docs/ANDROID_TEST_BUILD.md`.
