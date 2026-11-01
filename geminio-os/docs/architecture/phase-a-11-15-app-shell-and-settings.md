# Geminio OS — Phase A items 11–15

Status: existing app-shell capabilities retained; settings and product-information destinations extended.

## Scope mapping

11. **Application shell and navigation** — retain the Expo Router tab shell with responsive bottom navigation on mobile and a left rail on wide web layouts.
12. **Home dashboard** — retain the existing Home AI workspace, conversation composer, voice controls, history, task and approval sheets, and plan preview.
13. **Global search and discovery** — retain the existing global-search route and Discover tab. Search currently includes local sample records; it must not be described as a fully indexed server-wide search until workspace, project, conversation, and task providers are connected.
14. **Notifications** — retain the account-scoped tRPC notification list, category filters, mark-read and mark-all-read actions, refresh, loading, error, and signed-out states.
15. **Settings, founder, and about** — settings now links to profile/account details, Google sign-in entry, Meet the Founder, About & Privacy Policy, Contact Us & Feedback, and logout. Added dedicated founder and about screens.

## New screens

- `app/founder.tsx`: founder identity, Founder & CEO title, The Vision, and Contact Founder action.
- `app/about.tsx`: version v1.0.0, privacy overview, support email action, and Send Feedback action.

## Important integration boundaries

- The founder avatar is a branded initials placeholder, not a supplied photograph.
- The privacy content is an informational overview, not a legally reviewed privacy policy.
- Contact actions use the device's configured email application and may require an email app.
- Google sign-in requires server-side Google OAuth and Supabase environment configuration; this screen does not claim that provider credentials are configured.
- Global Search still uses local sample records. A production global index requires authenticated server search endpoints and source-specific authorization.
- Notifications remain backed by existing authenticated tRPC procedures; live behavior requires a running API and database.

## Verification

GitHub source changes are committed on `phase-a-brand-foundation`. Typecheck, lint, tests, device behavior, and live email/Google sign-in have not been executed from this GitHub-only session.
