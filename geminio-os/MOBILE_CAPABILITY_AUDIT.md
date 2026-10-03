# Geminio OS Mobile App Capability Audit

## Audit basis

This audit compares the remaining Mobile App Capability checklist with the existing Geminio OS Expo/React Native codebase, current package manifest, route inventory, shared hooks, backend routers, and test surface. Existing implementations are retained and extended rather than replaced.

## Current foundation

The project already contains a five-tab Super App shell, dedicated product routes, shared premium UI primitives, persisted theme/settings/memory state, offline action queuing, optimistic-update and pagination helpers, deep linking, notifications, permissions, calendar, file/export, collaboration, encryption, analytics, payment integration boundaries, third-party integration boundaries, server middleware, OpenAPI scaffolding, task/approval/credit/entitlement contracts, and an error-boundary route. The existing test suite and production server build are healthy at the current checkpoint.

## Capability status and next implementation order

| Capability group | Existing evidence | Remaining work | Implementation approach |
|---|---|---|---|
| UI and interaction | Gesture Handler and Reanimated are installed; shared UI library, parallax component, error boundary, and product dashboards exist | Blur, gradients, skeletons, bottom sheets, high-performance lists, masonry, custom fonts, Lottie, particles, design canvas, and stronger keyboard/gesture primitives | Add reusable cross-platform primitives with web fallbacks and reduced-motion behavior; adopt only dependencies compatible with Expo SDK 54 |
| Navigation | Expo Router, five-tab shell, deep linking, and back navigation patterns exist | Product drawer, badge source unification, unsaved-change guards | Add a product-level drawer/navigation primitive and central navigation state contracts |
| State and device interaction | Offline queue, app state manager, permissions, calendar, notifications, clipboard/share helpers, camera/location/media/contacts hooks are partially present | Background task boundary, robust queued mutation replay, lifecycle refresh, platform-complete native adapters, scheduled notification contract | Finish adapters with explicit permission, unsupported, cancellation, and failure states; keep web fallbacks truthful |
| Backend/API | tRPC, typed Geminio contracts, middleware, OpenAPI file, rate-limit and webhook foundations exist | Response validation coverage, streaming envelope, upload hardening, signed webhook replay protection, compression/cache policy | Add shared Zod envelopes, request correlation/idempotency, bounded uploads, and provider-neutral streaming/webhook contracts |
| Data storage | AsyncStorage persistence and server Drizzle schema exist | Soft-delete conventions, full-text search contract, SQLite and MMKV adapters | Add interfaces and safe fallback adapters; use SQLite/MMKV only where available and preserve web compatibility |
| Auth | OAuth/session foundations, biometric/PIN and RBAC exist | Refresh rotation, account linking, Clerk/Replit provider boundaries | Add provider-neutral adapters and session lifecycle contracts without forcing credentials |
| AI/ML | Built-in LLM, voice transcription, AI integrations, and voice UI exist | Streaming UI, embeddings/indexing contract, TTS playback states, Claude/OpenRouter adapters, on-device ML boundary | Use the existing server LLM where available; expose adapters and clear unavailable-provider states |
| Monetization | Credit ledger, entitlement and usage contracts, Credits & Plans screen, payment integration boundary exist | RevenueCat/Stripe adapter contracts, trials, receipt validation, promotional offers, paywall primitives | Complete provider-safe contracts, entitlement cache, receipt verification states, and purchase lifecycle UI |
| External integrations | Integration module and email/social/calendar boundaries exist | Explicit typed boundaries for listed enterprise connectors | Add connector registry, OAuth/secret requirements, sync state, retry/error contracts, and no-credential demo states |
| Quality and operations | Tests, error boundary, middleware, deployment docs, logging/backup/performance modules exist | Dependency/SAST scripts, CI gates, EAS/OTA/store release boundaries, monitoring/tracing correlation, CLI/style catalog | Add deterministic scripts and documented release/provider boundaries; do not claim external store execution without credentials |

## Dependency observations

The package manifest already includes Expo camera, image picker, location, contacts, calendar, speech, clipboard, file system, notifications, gesture handler, and Reanimated. It does not currently include Expo blur, linear gradient, SQLite, sensors, battery, brightness, barcode scanning, sharing, Flash List, MMKV, Lottie, or maps. Before adding packages, the implementation will follow the local Expo SDK documentation and pin versions compatible with the existing SDK rather than blindly using latest releases.

## Acceptance policy

A capability is complete only when the user-facing flow has working controls, loading/empty/error/offline/permission states, a typed integration boundary where an external provider is required, deterministic tests where practical, and documentation that distinguishes local functionality from provider-dependent execution. Unsupported native features must fail safely with an actionable explanation instead of silently pretending success.

## Recommended execution sequence

First complete the reusable UI, navigation, state, storage, and native adapter foundations. Next complete backend validation, authentication lifecycle, AI streaming/embeddings/TTS, payment lifecycle, and connector contracts. Finally complete quality gates, deployment/release boundaries, monitoring, developer tooling, recovery documentation, and capability-by-capability validation.
