#!/usr/bin/env python3
"""Regenerates docs/VERIFICATION_REGISTER.md from BLUEPRINT_IMPLEMENTATION_MATRIX.md plus the curated evidence below.
Run from the repo root: python3 scripts/verify/build-register.py
Evidence codes: S static inspection | T offline shim test | Q SQLite SQL-engine test (NOT MySQL) | N real local-socket test |
B real headless Chromium (browser APIs, not the app UI) | R real Vitest | M MySQL | A API integration | U app UI | E end-to-end.
R, M, A, U, E have NEVER been achieved for any feature in this repository; they are listed as required, not as results."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parents[2]
rows = []
for line in (root / "BLUEPRINT_IMPLEMENTATION_MATRIX.md").read_text().splitlines():
    if re.match(r"^\| GO-[A-Z0-9]+-\d{3} \|", line):
        c = [x.strip() for x in line.strip().strip("|").split("|")]
        rows.append(dict(id=c[0], area=c[1], name=c[2], status=c[3]))

# id -> (UI, backend/DB, tests, evidence, defects, blocker)
E = {
 "GO-FND-001": ("app/auth*, hooks/use-auth", "server/_core/{oauth,sdk,context,cookies,session-secret}.ts; users", "session-cookies, verification-defects (secret policy), cron-principal", "S T", "DEF-005 hardening, DEF-016", "OAuth provider + JWT_SECRET + DB; no real sign-in ever run. OPEN-001/002"),
 "GO-FND-002": ("lib/trpc", "server/_core/trpc.ts, server/routers.ts (all procedures)", "no-refetchable-ai (source scans), verification-defects", "S T", "DEF-002/003/004", "@trpc/server not installable here; no HTTP-level test"),
 "GO-FND-007": ("-", "server/_core/health.ts, /api/health, /api/health/ready", "health", "S T", "", "needs MySQL for ready=200 path"),
 "GO-AIC-001": ("-", "server/ai-core/providers.ts, _core/llm.ts", "provider-registry, provider-contracts, ai-core.contracts (cannot load)", "S T", "", "real provider key"),
 "GO-AIC-003": ("-", "server/ai-core/{multistep,orchestrator}.ts", "ai-core-multistep", "S T", "", "orchestrator never run (drizzle)"),
 "GO-AIC-004": ("-", "orchestrator.ts, run-guard.ts, persistence.ts; orchestrationRuns, aiQueueJobs", "ai-core-run-guard, ai-core-run-guard.db (SQLite threads), verification-defects", "S T Q", "DEF-002, DEF-008", "MySQL/InnoDB re-run required"),
 "GO-AIC-005": ("-", "orchestrator.ts approvals; server/task-approvals.ts; taskApprovals/agentTasks", "task-approvals.db (SQLite: cross-user, resolve-once, conflict, race), home-chat-actions, verification-defects", "S T Q", "DEF-011, DEF-012", "MySQL + two-user API run (scripts/verify/two-user-api-check.ts, not run)"),
 "GO-AIC-006": ("-", "server/credits/{ledger,metering,metered-llm,operations}.ts", "credits-*, integration-home-chat.e2e, ai-core-run-guard.db", "S T Q", "DEF-009", "MySQL InnoDB row-lock semantics"),
 "GO-AIC-007": ("-", "server/credits/ledger.ts, mysql-store.ts; creditAccounts/creditReservations", "credits-ledger, integration-home-chat.e2e", "S T Q", "", "MySQL (SELECT .. FOR UPDATE) unverified"),
 "GO-AIC-008": ("-", "server/ai-core/multistep.ts", "ai-core-multistep", "S T", "", ""),
 "GO-AIB-001": ("none connected", "server/ai-builder/service.ts; aiBuilderProjects/Events", "ai-builder.pure", "S T", "", "MySQL; GO-AIB-006 UI missing"),
 "GO-AIB-002": ("none", "server/ai-builder/{service,llm-adapter}.ts, lib/ai-builder/*", "ai-builder.pure", "S T", "", "real provider key"),
 "GO-AIB-003": ("none", "service.ts -> live-builder proposeLiveBuilderGeneratedChange", "ai-builder.pure, live-builder-atomic-apply", "S T", "", "MySQL"),
 "GO-AIB-004": ("none", "server/ai-builder/workspace-analyzer.ts", "ai-builder.pure", "S T", "", ""),
 "GO-AIB-005": ("none", "service.ts begin/cas/recover (version CAS)", "ai-builder.pure (pure parts only)", "S T", "", "CAS statements never run on MySQL"),
 "GO-LVB-001": ("app/live-build-studio", "server/live-builder/service.ts; liveBuilder* tables", "live-builder-atomic-apply", "S T", "DEF-003", "MySQL"),
 "GO-LVB-002": ("-", "server/live-builder/{atomic-apply,apply-store}.ts", "live-builder-atomic-apply, tests/helpers/sqlite-apply-store", "S T Q", "", "MySQL"),
 "GO-LVB-003": ("-", "server/live-builder/ai-edit.ts", "live-builder-ai-edit", "S T", "", "real provider + DB (live-builder.e2e gated, cannot load)"),
 "GO-LVB-004": ("-", "server/live-builder/control-plane.ts", "runner-control-plane", "S T", "", "in-memory plane; no real runner"),
 "GO-LVB-005": ("-", "control-plane.ts providers (container/microvm), runner.ts", "verification-defects (VER-DEF-005: honest unavailable/failed)", "S T", "DEF-007", "BLOCKED BY EXTERNAL INFRASTRUCTURE: no executable runner exists; every provider returns 'unavailable' (verified offline)"),
 "GO-LVB-006": ("-", "preview-gateway.ts (in-memory), runtime.ts persisted sessions", "runner-control-plane, verification-defects", "S T", "DEF-001, DEF-006, DEF-010", "per-process memory sessions (OPEN-005)"),
 "GO-LVB-009": ("-", "atomic-apply.ts reject/abort", "live-builder-atomic-apply", "S T Q", "", "MySQL"),
 "GO-LVB-010": ("-", "atomic-apply.ts integrity/restore", "live-builder-atomic-apply", "S T Q", "", "MySQL"),
 "GO-DEV-001": ("app/dev-preview", "server/dev-preview/{supervisor,states,activity,progress}.ts", "dev-preview", "S T", "", "no real install/build/run supervised"),
 "GO-DEV-003": ("app/dev-preview", "server/dev-preview/progress.ts (parses this matrix)", "dev-preview", "S T", "", ""),
 "GO-CRD-002": ("-", "server/credits/operations.ts", "credits-operations", "S T Q", "", "MySQL"),
 "GO-SEC-010": ("-", "no-refetchable-ai source scans", "no-refetchable-ai, credits-operations", "S T", "", ""),
 "GO-DSN-002": ("constants/theme", "lib/contrast.ts", "design-tokens", "T", "", "rendered screens never inspected"),
 "GO-HOME-001": ("components/home-chat/*, lib/home-chat/use-home-chat.ts", "pipeline.ts, router.ts send; AI Core; conversations/messages/creditReservations", "home-chat-pipeline, integration-home-chat.e2e (SQLite)", "S T Q", "DEF-008, DEF-009", "MySQL, provider key, real UI->API run"),
 "GO-HOME-002": ("home chat screen", "conversations.ts, router conversations.*", "home-chat-conversations, integration-home-chat.e2e", "S T Q", "DEF-008", "UI/API never run"),
 "GO-HOME-003": ("history screens", "conversations.ts + mysql-store.ts", "home-chat-conversations, integration-home-chat.e2e", "S T Q", "", "MySQL; UI"),
 "GO-HOME-004": ("message action menu", "conversations.ts (feedback/edit/variants), router messages.*", "home-chat-conversations, home-chat-client-logic", "S T Q", "", "UI; TTS native"),
 "GO-HOME-005": ("recorder UI, lib/home-chat/recorder-machine", "stt.ts, router transcribe", "home-chat-stt, network-adapters.integration (N), scripts/verify/browser-recorder.cjs (B)", "S T N B", "", "BLOCKED BY EXTERNAL INFRASTRUCTURE: no STT provider key; real transcript never produced"),
 "GO-HOME-006": ("speech-machine", "lib/home-chat/speech-machine.ts", "home-chat-client-logic", "S T", "", "web speechSynthesis/expo-speech never run"),
 "GO-HOME-008": ("-", "web-search.ts (Brave adapter)", "home.pure, network-adapters.integration (N)", "S T N", "", "BLOCKED BY EXTERNAL INFRASTRUCTURE: no search key"),
 "GO-HOME-009": ("attachment picker", "attachments.ts, attachment-service.ts, storage.ts", "home-chat-attachments, home-chat-files", "S T", "", "storage backend, real upload"),
 "GO-HOME-010": ("-", "code-run.ts", "home-chat-code-run, network-adapters.integration (N)", "S T N", "", "no sandbox service"),
 "GO-HOME-011": ("-", "server/home-chat/intents.ts (regex hints only)", "home-chat.pure", "S T", "", "navigation hints only; not delegation"),
 "GO-HOME-012": ("progress rows", "pipeline.ts stepsFromEvents, multistep.ts", "home-chat-pipeline, ai-core-multistep", "S T", "", "orchestrator never run"),
 "GO-HOME-013": ("task queue UI", "router tasks.*/stop; orchestrator pause/resume/cancel/retry; run-guard", "ai-core-run-guard(.db), verification-defects, credits-task-lifecycle", "S T Q", "DEF-002", "MySQL; UI"),
 "GO-HOME-014": ("approval cards", "actions.ts, action-store.ts, router actions.*", "home-chat-actions", "S T", "", "MySQL; UI"),
 "GO-LVB-007": ("-", "service.ts validate", "none dedicated", "S", "", "validation providers not run"),
 "GO-HOME-016": ("context picker", "context.ts, service.loadContext", "home-chat-context", "S T", "", ""),
 "GO-HOME-017": ("notifications tab", "ai-core/notify-policy.ts, notifications router", "ai-core-notify-policy", "S T", "", "no real delivery run"),
 "GO-HOME-019": ("-", "credits/*", "credits-*, integration-home-chat.e2e, ai-core-run-guard.db", "S T Q", "DEF-009", "MySQL"),
 "GO-HOME-020": ("-", "router ownership scoping", "no-refetchable-ai, verification-defects", "S T", "DEF-001/006", "no cross-user API test (needs 2 real sessions)"),
 "GO-HOME-022": ("turn-machine", "ai-core/sse.ts, llm.ts streaming", "ai-core-sse, network-adapters.integration (N), home-chat-client-logic", "S T N", "", "real provider stream"),
 "GO-HOME-024": ("temporary toggle", "conversations.ts sweep, index.ts hourly sweep", "home-chat-conversations", "S T Q", "", "sweep timer never run"),
 "GO-HOME-026": ("generate file menu", "files.ts, office.ts, router generateFile", "home-chat-files, home-chat-office", "S T", "", "storage round-trip never run"),
 "GO-HOME-027": ("schedules UI", "schedule.ts, schedule-store.ts, service.fireSchedule", "home-chat-schedule, verification-defects (idempotent replay)", "S T Q", "DEF-008", "MySQL; timer"),
 "GO-HOME-028": ("settings", "preferences.ts, service.ts", "home-chat-preferences", "S T", "", ""),
 "GO-HOME-030": ("-", "code-run.ts", "home-chat-code-run", "S T N", "", "BLOCKED BY EXTERNAL INFRASTRUCTURE: no sandbox"),
}

def status_of(r):
    s = r["status"]
    if s == "MISSING": return "NOT IMPLEMENTED"
    ev = E.get(r["id"])
    if s.startswith("BLOCKED"): return "BLOCKED"
    if ev and any(c in ev[3].split() for c in ("T", "Q", "N", "B")): return "PARTIALLY VERIFIED (offline only)"
    if ev: return "PARTIALLY VERIFIED (static only)" if ev[3].strip() == "S" else "NOT VERIFIED"
    return "NOT VERIFIED"

out = []
out += ["# Geminio OS Feature Verification Register", "",
 "Generated by `scripts/verify/build-register.py` from `BLUEPRINT_IMPLEMENTATION_MATRIX.md` plus curated evidence. **Implementation status and verification status are separate columns.** No feature is VERIFIED: that requires real Vitest (R), MySQL (M), API (A), app UI (U) and end-to-end (E) evidence, none of which has ever been obtained in this repository.", "",
 "Evidence codes: **S** static inspection · **T** offline shim test (not real Vitest) · **Q** SQLite SQL-engine test (not MySQL/InnoDB) · **N** real local-socket test of our clients · **B** real headless Chromium, browser APIs only · **R** real Vitest · **M** MySQL · **A** API integration · **U** app UI · **E** end-to-end.", "",
 "Verification status values: `VERIFIED` (needs R+M+A+U+E as applicable — none) · `PARTIALLY VERIFIED (offline only)` · `PARTIALLY VERIFIED (static only)` · `NOT VERIFIED` · `BLOCKED` · `NOT IMPLEMENTED` (nothing to verify).", "",
 "| VR ID | Matrix ID | Area | Feature | Implementation | UI | Backend / DB | Tests | Evidence achieved | Verification status | Defects found | Blocker / still required |", "|---|---|---|---|---|---|---|---|---|---|---|---|"]
for i, r in enumerate(rows, 1):
    e = E.get(r["id"], ("", "", "", "S" if r["status"] != "MISSING" else "", "", ""))
    ev = e[3] or ("none" if r["status"] == "MISSING" else "S")
    if r["id"] not in E and r["status"] != "MISSING": ev = "none (not inspected in depth)"
    out.append(f"| VR-{i:03d} | {r['id']} | {r['area']} | {r['name']} | {r['status']} | {e[0] or '-'} | {e[1] or '-'} | {e[2] or '-'} | {ev} | {status_of(r)} | {e[4] or '-'} | {e[5] or '-'} |")
out += ["", "## End-to-end workflows (all NOT end-to-end verified)", "",
 "| WF ID | Workflow | Closest evidence actually obtained | Required to verify |", "|---|---|---|---|",
 "| WF-01 | Install, configure, start, health | none (registry unreachable) | `pnpm install --frozen-lockfile`, MySQL, `pnpm dev`, GET /api/health and /api/health/ready |",
 "| WF-02 | Sign-up/sign-in/sign-out/session expiry/protected routes | cookie option tests (T), secret policy (T) | OAuth provider, JWT_SECRET, two real users |",
 "| WF-03 | Migrations 0000-0012 on empty and seeded MySQL | static migration tests (T) | `scripts/verify/migration-rehearsal.sh` on disposable MySQL 8.0.13+ |",
 "| WF-04 | Home: send, reserve, run, settle, persist | pipeline + ledger on SQLite (Q) | MySQL + provider key + UI/API run |",
 "| WF-05 | Home: conversation create/rename/pin/archive/delete/export/share | conversation store on SQLite (Q) | MySQL + UI |",
 "| WF-06 | Home: stop / pause / resume / retry / recovery | CAS + fencing on SQLite threads (Q), error mapping (T) | MySQL concurrency re-run + UI |",
 "| WF-07 | Home: insufficient credits / idempotent retry / duplicate send | ledger + pipeline (T Q), DEF-008/009 tests | MySQL + API |",
 "| WF-08 | Home: attachments, file generation, voice, search, notifications, schedules | adapters vs local servers (N), browser recorder (B) | storage, STT/search keys, scheduler timer |",
 "| WF-09 | AI Builder: create, requirements, plan, code, approve, apply | pure stages (T), atomic apply (Q) | MySQL + provider key; GO-AIB-006: no UI is connected |",
 "| WF-10 | Live Builder: propose edit, approve, apply, version, restore | atomic apply (Q) | MySQL + UI |",
 "| WF-11 | Live Builder: preview/runtime lifecycle and runner honesty | runner/control plane (T): unavailable/failed are truthful | BLOCKED: no executable runner exists |",
 "| WF-12 | Wallet / payments | none | BLOCKED: no payment provider; no real transaction may be initiated |",
 "| WF-13 | Two-user authorization (approvals, tasks, previews, runtimes) | SQLite stand-in DB tests (Q) | MySQL + running API: `scripts/verify/two-user-api-check.ts` (written, NOT RUN) |", ""]
(root / "docs" / "VERIFICATION_REGISTER.md").write_text("\n".join(out) + "\n")
print(len(rows), "rows;", sum(1 for r in rows if r['id'] in E), "with curated evidence")
