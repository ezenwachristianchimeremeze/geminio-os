# Geminio OS Super App UX Audit

## Audit Scope

This audit compares the current Geminio OS mobile navigation and screen architecture with the requested premium AI Super App blueprint. The existing architecture and feature modules remain the source of truth; this redesign changes the information architecture and presentation layer without replacing the underlying capabilities.

## Current State

The current global shell exposes a legacy three-tab structure: Home, Chat, and Settings. Additional legacy routes such as Tools and Studio exist but are not part of the main tab bar. The root layout already provides authentication, tRPC, query, memory, data, voice, permissions, media, safe-area, theme, and gesture providers, so the redesign can be implemented as a navigation and experience layer above stable infrastructure.

The current Home screen is a dashboard with greeting text, activity statistics, an AI tip, and a voice shortcut. This conflicts with the requested Home experience because the blueprint explicitly requires Home to be conversation-only and to exclude marketplace, wallet, builder, and feature shortcut cards.

The existing Chat screen contains the strongest reusable foundation for Home: persisted memory integration, tRPC chat mutation, conversation history, message rendering, typing state, text input, voice affordance, and automatic scroll-to-bottom behavior. It should be promoted into the Home route and refined rather than duplicated.

The existing Tools screen provides a useful product taxonomy, while Studio provides content-creation categories. These legacy surfaces should be migrated into Workspace product cards and dedicated product dashboards rather than retained as global tabs.

## Required Information Architecture

The new global shell will contain exactly five primary destinations: Home, Workspace, Discover, Notifications, and Profile. Each destination will have a clear purpose and accessible selected state. Product cards in Workspace will route to dedicated product dashboards instead of opening popups.

Home will contain the AI conversation thread, new-chat action, voice chat action, recent conversations, AI suggestions, and conversation search. Workspace will contain categorized cards for AI Builder, Media Studio, Career Hub, Business Hub, Learning Hub, Wallet, Marketplace, Phone Assistant, Security Guardian, News Hub, and Personal Assistant. Discover will present recommendations and product discovery. Notifications will manage unread and read activity. Profile will consolidate account, appearance, security, preferences, help, and settings.

## Product Dashboard Pattern

Every product dashboard will share a consistent premium shell with product identity, summary metrics, quick actions, recent activity, recommendations, search, history, favorites, analytics, settings, help, and profile where applicable. Product-specific navigation will remain independent from the global shell, making each product feel like a focused application inside the Geminio ecosystem.

The first implementation will use a shared product catalog and a dynamic dedicated route with product-specific dashboard data. This preserves maintainability and allows product dashboards to grow independently without duplicating navigation logic.

## Design Direction

The redesign will use the existing theme provider and NativeWind tokens, extending them with a premium indigo/cyan accent system, elevated surfaces, consistent rounded cards, readable hierarchy, generous spacing, focus-visible states on web, and subtle press feedback. The layout will remain safe-area aware and responsive across mobile, tablet, desktop, and web. Light and dark schemes will use the same semantic tokens rather than hard-coded screen-specific colors.

## Implementation Order

1. Establish a shared product catalog and reusable super-app UI primitives.
2. Replace the global tab shell with the five required destinations.
3. Promote and refine the existing chat foundation into conversation-only Home.
4. Build Workspace, Discover, Notifications, and Profile.
5. Add dedicated product dashboard routing and shared internal navigation.
6. Integrate persistence, accessibility, loading states, responsive layouts, and validation.

## Audit Findings

| Area | Current State | Required Change | Priority |
|---|---|---|---|
| Global navigation | Three tabs plus hidden legacy routes | Five-tab super-app shell | Critical |
| Home | Activity dashboard with quick actions | ChatGPT-style AI conversation only | Critical |
| Product discovery | Tools and Studio are separate legacy surfaces | Workspace product hub with categories | Critical |
| Product detail | Existing feature screens are not consistently organized | Dedicated dashboard route per product | High |
| Settings | Standalone legacy tab | Consolidate into Profile and product settings | High |
| Visual system | Basic theme tokens and generic cards | Premium shared tokens and dashboard primitives | High |
| Accessibility | Partial labels and feedback | Explicit labels, roles, states, and focus behavior | High |
| Responsive behavior | Basic mobile-first layout | Validate mobile, tablet, desktop, and web | High |

## Acceptance Criteria

The redesign is complete when Home is conversation-only, the global shell has five correct tabs, every Workspace product opens a dedicated dashboard, each dashboard exposes the shared navigation pattern, legacy routes are migrated without breaking existing capabilities, and type, visual, interaction, accessibility, and responsive validation passes.
