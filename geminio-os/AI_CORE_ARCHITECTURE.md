# Geminio OS AI Core

## Purpose

The AI Core is the provider-neutral backend foundation beneath the existing Geminio OS screens. It accepts a natural-language request, resolves it to a registered Geminio capability, persists an orchestration run, creates a durable task and queue job, executes through an adapter boundary, records progress and checkpoints, verifies the result, and returns a typed response. Existing screens and navigation remain unchanged; the new tRPC surface is an underlying service contract.

## Runtime flow

1. `aiCore.submit` validates the request envelope and applies a per-user rate limit.
2. The router calls the built-in LLM adapter for structured intent routing. If the provider is unavailable or returns invalid data, deterministic capability matching is used and the response marks `fallbackUsed`.
3. The capability registry supplies the operation descriptor, supported providers, risk classification, required permission, approval requirement, and execution mode.
4. Conversation, orchestration run, agent task, and queue job records are persisted before execution begins. The request ID is unique per user for idempotent replay.
5. The worker claims the queue item with a lease. Execution emits task events, records provider-attempt metadata, and writes named checkpoints.
6. High-risk external side effects pause at an approval gate. Approval resolution creates a bounded resume job and continues only after explicit authorization.
7. Retryable provider failures are requeued only while the persisted `maxAttempts` budget remains. Exhausted jobs enter `dead_letter` and the run receives a typed failure.
8. Results are marked verified only after the provider response passes the result contract. External providers that are not configured return an unavailable state and never claim success.

## Main modules

| Module | Responsibility |
|---|---|
| `server/ai-core/providers.ts` | Provider adapter interface, built-in LLM adapter, unavailable-provider behavior, normalized failures |
| `server/ai-core/capabilities.ts` | Registered capabilities, risk and permission metadata, provider support declarations |
| `server/ai-core/router.ts` | Natural-language routing, structured intent validation, deterministic fallback |
| `server/ai-core/persistence.ts` | Durable conversation, run, queue, event, checkpoint, and provider-attempt operations |
| `server/ai-core/orchestrator.ts` | Plan creation, execution, verification, approval gates, worker ticks, resume, retry policy |
| `server/ai-core/gateway.ts` | API facade for submission, run inspection, event history, capability discovery, and worker control |
| `server/ai-core/security.ts` | Capability authorization, rate limits, sensitive metadata redaction, AI audit records |

## Persistence model

The AI Core adds durable records for conversations, orchestration runs, queue jobs, task events, task checkpoints, and provider attempts. Existing `projects`, `agentTasks`, `taskApprovals`, `auditLogs`, credits, and entitlement records remain authoritative for their domains. The migration is additive and does not delete or rewrite existing application data.

## Provider boundaries

The built-in LLM adapter is the default routing and execution provider. Additional adapters implement the same `AIProviderAdapter` interface and can be added without changing orchestration code. An adapter must expose availability, invoke behavior, capability support, and normalized failure semantics. Missing credentials, unsupported operations, timeouts, and provider errors are returned as explicit states; no external action is simulated.

## Security model

Capability descriptors classify operations as `read_only`, `local_mutation`, or `external_side_effect`. External side effects require explicit approval before execution. Requests are rate limited per user, request metadata is redacted before audit persistence, and database lookups scope user-facing runs and tasks to the authenticated owner. The worker uses internal run lookup paths and does not expose cross-user records through the API.

## Operational recovery

The server starts a bounded worker poller alongside the existing API. A leased job can be resumed after process restart when its lease expires. Queue attempts and maximum attempts are persisted. Checkpoints provide resumable state for long-running Builder workflows, and event history supports progress reporting and post-failure diagnosis. Jobs that exceed their retry budget are placed in a dead-letter state for operator review.

## Current truthful limitations

Provider-specific external services such as production deployment, billing settlement, and third-party integrations remain adapter boundaries until credentials and provider implementations are configured. The AI Core exposes their capability metadata and approval flow, but it does not report a fabricated external success.
