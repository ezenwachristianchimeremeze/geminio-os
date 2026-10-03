# AI Core Capability Execution and Task Operations

## Purpose

This document describes the durable execution and task-control layer added beneath the existing Geminio OS Home and AI Builder screens. It preserves the existing interface while giving authenticated users a reliable backend record for accepted requests, capability routing, progress, approval gates, retries, checkpoints, and final provider output.

## Capability Execution Policy

The authoritative capability registry is `server/ai-core/capabilities.ts`. Each enabled capability declares its risk classification, approval requirement, supported providers, and—where it is safe to execute through the AI Core—a handler that returns a typed execution instruction.

| Capability family | Handler output | Verification rule | External effect policy |
|---|---|---|---|
| `conversation.reply` | Durable conversation messages | The configured provider returns a contextual response | None |
| `builder.app.generate` | React Native implementation guidance | The configured provider returns reviewable implementation output | Export and deployment remain separate, user-controlled actions |
| `builder.website.generate` | Website implementation guidance | The configured provider returns reviewable implementation output | Export and deployment remain separate, user-controlled actions |
| `builder.workflow.generate` | Workflow plan | The configured provider returns a reviewable plan | No workflow is activated by the AI response |
| `builder.database.generate` | Data-model and migration plan | The configured provider returns a reviewable plan | No schema is applied by the AI response |
| `builder.agent.test` | Controlled test guidance | The configured provider returns a reviewable result | No unregistered agent tool executes |
| `project.deploy`, `project.delete` | Approval gate only | A dedicated execution provider must confirm completion | The task fails safely after approval when no such provider is configured |

> A language-model response is never treated as confirmation of a deployment, payment, deletion, purchase, or provider connection. Those operations require a dedicated adapter that reports an independently verifiable result.

## Public AI Core Procedures

All `aiCore` procedures are authenticated and ownership-scoped through tRPC.

| Procedure | Purpose | Ownership and idempotency behavior |
|---|---|---|
| `capabilities` | Lists enabled capability descriptors | Read-only; no provider is represented as available unless its adapter is configured |
| `submit` | Creates or reuses an idempotent orchestration run | The request ID is unique per user and persists plan, task, queue job, and conversation state |
| `getRun`, `listRuns` | Retrieves user-owned run state | Never returns another user’s run |
| `getRunDetails` | Retrieves user-owned jobs, checkpoints, provider attempts, and events | Provides operational context without exposing another user’s records |
| `events` | Retrieves ordered events for a user-owned run | Resolves the run before accessing its task event stream |
| `cancel` | Cancels active work | Marks the run and active jobs cancelled; terminal runs remain immutable |
| `retry` | Requeues a failed run | Only failed runs can retry; active jobs prevent duplicate retry scheduling |
| `deadLetters` | Lists dead-letter jobs associated with the requesting user’s runs | Does not expose global queue jobs |
| `recoverExpiredLeases` | Requests stale lease recovery | Returns only a generic acknowledgement and does not reveal global queue counts |

## Durable Recovery and Concurrency

The queue uses a compare-and-update claim. A worker can execute a job only when its conditional transition from `queued` to `leased` affects exactly one row, preventing two workers from executing the same job. Every worker tick requeues expired `leased` or `running` jobs before claiming new work. The task’s persisted plan, run, events, and checkpoints remain available after worker restart.

Retry attempts are bounded by each queue job’s `maxAttempts`. Retryable provider failures are scheduled with a delay; exhausted jobs become `dead_letter` and the orchestration run becomes `failed`. Manual retry creates a fresh durable queue job only for an owned failed run.

## Approval and Cancellation Behavior

High-risk capabilities stop in `waiting_for_approval` before a side effect. Approval may resume a run only if it is still waiting for that approval. If a user cancels the run first, resolving a previously pending approval cannot revive it. This prevents stale approval records from causing work after a user has revoked intent.

## Existing UI Integration

The existing Home conversation surface persists the AI Core conversation ID between messages, displays durable run status, and exposes cancellation for active work. The existing App Builder submits authenticated generation work to the AI Core, polls the durable run state, displays progress and cancellation controls, and labels local deterministic drafts clearly when no authenticated orchestration request is made. No provider completion is simulated.

## Adding a New Capability

1. Add a new descriptor to `server/ai-core/capabilities.ts` with its risk, approval requirement, and supported provider list.
2. For safe non-side-effect work, add a handler that returns capability-specific messages, bounded tokens, output kind, and a verification statement.
3. For any external side effect, create a dedicated provider adapter with verifiable response data. Do not route it through a generic language-model handler.
4. Extend the shared contracts and deterministic tests before exposing the capability through the client.
5. If the capability can resume, persist enough plan state to validate it from a queue job or checkpoint.
