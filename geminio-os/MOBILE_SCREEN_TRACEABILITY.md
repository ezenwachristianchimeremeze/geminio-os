# Geminio OS Screen Traceability

## Scope

This report maps the authoritative Geminio OS screen families to the existing Expo Router implementation. The project uses dedicated routes for authentication, product sections, module dashboards, and blueprint detail workflows. Shared renderers are used only where the specification defines the same interaction/state contract across products; they are not popup-only substitutes for product dashboards.

## Route Architecture

| Screen family | Route or implementation | Coverage |
|---|---|---|
| Authentication entry | `app/auth-screen.tsx` | Biometric, PIN, skip, sign-in, sign-up, recovery, MFA, account linking, onboarding links |
| Authentication flows | `app/auth/[flow].tsx` | Form, loading, validation error, success, provider-safe boundary, onboarding completion |
| Global tabs | `app/(tabs)/_layout.tsx` | Home, Workspace, Discover, Notifications, Profile; mobile bottom bar and desktop left rail |
| Home conversation | `app/(tabs)/index.tsx` | Chat composer, history, voice, search, suggestions, empty/loading/error/offline states |
| Workspace product hub | `app/(tabs)/workspace.tsx` | Product search/filter, favorites, recents, launch cards, responsive grid |
| Dedicated product dashboard | `app/workspace/[product].tsx` | Dashboard, search, history, favorites, analytics, settings, help, quick actions |
| Product section detail | `app/workspace/[product]/[section].tsx` | Section-level navigation, contextual content, actions, loading/empty/error/offline states |
| Named module dashboard | `app/module/[module].tsx` | AI Builder, Media Studio, Career Hub, Business Hub, Learning Hub, Personal Assistant, Phone Assistant, AI Guardian, Developer Console, News Hub, Markets, Marketplace, Wallet, and related products |
| Blueprint detail and creation workflows | `app/blueprint/[screen].tsx` | Onboarding profile, chat detail, discover detail, notification detail, security, media editor, career application, business record, course workspace, guardian scan, marketplace item, wallet transfer, credits checkout |
| Credits and plans | `app/profile/credits.tsx` | Plans, entitlements, provider-safe purchase boundary, loading/empty/error states |
| Settings and profile | `app/profile/settings.tsx`, `app/(tabs)/profile.tsx` | Account, appearance, privacy, security, memory, export, deletion confirmation, help/about links |
| Developer and capability labs | `app/dev/theme-lab.tsx`, `app/capability-lab.tsx` | Design-system verification, native capability states, responsive primitives, reduced-motion and interaction checks |

## Required State Contract

All asynchronous product and detail routes expose the following state vocabulary through their shared renderers: loading or skeleton, ready, empty, validation error, provider or service error, offline, retry, confirmation, success, and access denied where the action requires entitlement or permission. Native-only actions additionally expose unsupported-platform and permission-escalation states through `shared/native-capability-boundaries.ts`.

## Product Coverage

| Product | Dashboard sections covered |
|---|---|
| AI Builder | Dashboard, projects, templates, agents, workflows, deployments, history, settings, approvals |
| Media Studio | Dashboard, images, videos, music, templates, projects, editor, exports, processing and retry |
| Career Hub | Dashboard, jobs, scholarships, internships, applications, saved, resume, interview coach |
| Business Hub | Dashboard, sales, CRM, inventory, marketing, reports, analytics, record creation/editing |
| Learning Hub | Dashboard, courses, tutor, research, study plans, exams, certificates, progress |
| Personal Assistant | Dashboard, tasks, calendar, reminders, notes, routines, detail/create/edit |
| Phone Assistant | Dashboard, contacts, calls, messages, device actions, permission and unsupported states |
| AI Guardian | Dashboard, scans, threats, audit logs, permissions, alerts, resolution |
| Developer Console | Projects, tasks, logs, code review, test runs, deployments, secrets, API keys, approvals |
| News Hub | Dashboard, technology/business/finance/AI categories, trending, article detail, bookmarks, search |
| Markets | Dashboard, watchlists, asset detail, charts, alerts, unavailable-data state |
| Marketplace | Dashboard, categories, item detail, purchases, downloads, orders, reviews, creator products, checkout boundary |
| Wallet | Dashboard, accounts, transactions, send, receive, cards, budgets, analytics, receipts, provider boundary |
| Credits and subscriptions | Plans, credits, trials, invoices, receipts, paywalls, offers, entitlement and purchase states |

## Validation Evidence

The current route and contract validation pass reports zero TypeScript errors and 115 passing tests with one pre-existing skipped authentication test. Responsive previews have been reviewed for the authentication, Workspace, product-section, module-dashboard, Capability Lab, App Builder, Wallet, and Credits flows. The remaining production boundary is external provider/device execution: real billing, financial rails, push credentials, and physical hardware require configured credentials and device acceptance builds and are represented by explicit sandbox/provider states rather than false success.

## 2026-09-08 Mobile Verification Findings

The mobile portrait preview confirmed that Home, onboarding, AI Builder, Developer Console, and Credits & Plans render with the intended Geminio hierarchy, bottom navigation, safe-area spacing, and horizontally scrollable product tabs. It also exposed two release-blocking defects: the legacy `/wallet` route still renders fabricated balance and transaction values instead of the provider-safe connection state, and direct `/blueprint/wallet-send` navigation resolves to the authentication entry state rather than rendering its dedicated workflow when opened directly. Both defects require correction before final delivery.


## Route Correction Update

The root stack now declares authenticated and unauthenticated routes together, allowing direct navigation to authentication flows, blueprint workflows, product sections, module dashboards, Wallet, Credits, and Settings without collapsing valid deep links to the authentication entry screen. The legacy `/wallet` route was replaced with a provider-safe connection dashboard that does not fabricate balances, transactions, or transfer success. Post-fix validation passed with zero TypeScript errors and 115 passing tests with one skipped authentication test.

## Latest Direct Route Verification

The direct `/wallet` route renders the provider-safe Wallet screen successfully in the live web preview, including the unavailable-provider state and visible navigation actions. A direct `/blueprint/wallet-transfer` browser request previously resolved to `/auth-screen`; in-app navigation and the current route manifest remain the authoritative follow-up checks for that dynamic path.

## In-App Wallet Navigation Verification

The provider-safe `/wallet` screen successfully navigates into `/workspace/wallet`. The dedicated dashboard renders visible Dashboard, Balance, Transactions, Send, Receive, Analytics, History, Favorites, Settings, and Help sections, with truthful Not linked, No data, and After setup states rather than fabricated financial values.

## In-App Blueprint Workflow Verification

From `/workspace/wallet`, the visible Send money action navigates to `/workspace/wallet/Send` and renders the dedicated Send workflow. The screen exposes ready, loading, empty, and error controls plus Provider not connected, Recipient validation, Confirmation required, and Review requirements states. This confirms screen-to-screen workflow navigation without requiring a direct dynamic URL entry.
