# Phase A — Items 6–10: Account Entry and Authentication UX

Status: UI and interaction foundation implemented; live email/password, email verification, password recovery, and OAuth initiation are NOT production-connected.

## Scope
6. Welcome-to-sign-up transition
7. Sign-up form
8. OAuth provider handoff screen
9. Email verification screen
10. Forgot-password request screen

## Design system
- App background: Midnight `#080D1B`
- Primary action: Deep indigo `#4F46E5`
- Focus/highlight: Soft indigo `#A5B4FC`
- Accent: Electric blue `#3B82F6`
- Primary text: `#F8FAFC`
- Secondary text: `#94A3B8`
- Form controls: theme surface/background/border tokens; 14–15 px radius; 52–54 px minimum height.
- Content width: max 560 px, safe-area aware, vertically scrollable, keyboard-aware.
- Primary actions are full-width at the end of the form. Back navigation is top-left. Secondary actions are text or outlined controls beneath the primary action.

## Screen and navigation contract

### 6. Welcome → account entry
- `Get started` pushes `/auth/sign-up`.
- `I already have an account` pushes `/auth/sign-in`.
- Back from account screens returns to the welcome screen.
- The welcome screen does not create a session.

### 7. Sign-up
Fields: full name, email, password, confirm password, consent checkbox.
- Validate required fields, email format, minimum password length (8), password equality, and explicit consent.
- Show/hide password controls are independent per password field.
- Invalid values remain on the same screen with an inline error.
- The form must call a future server registration endpoint and only continue after a server-confirmed response.
- Current implementation intentionally does not transmit or persist credentials because no email/password registration endpoint exists in the repository.
- Expected successful server response: route to `/auth/verify-email` with an opaque challenge identifier, never a raw verification secret.

### 8. OAuth
- Existing repository contains OAuth callback and mobile code-exchange handlers.
- A provider authorization-start route/provider configuration was not found in the inspected server implementation.
- Do not display a provider as available until the authorization-start endpoint, redirect URI allowlist, state/PKCE handling, and provider configuration are implemented.
- After callback, validate state, exchange code server-side, persist session securely, fetch the authenticated user, then route to the next required step.
- Cancelled or failed provider flows return to sign-in with a recoverable message.

### 9. Email verification
Fields: six-digit numeric code.
- Validate exactly six digits before request.
- Verify button submits to a future server verification endpoint.
- Resend action must use server-enforced cooldown and rate limiting.
- Change email returns to sign-up with the previously entered name retained only in transient screen state.
- Success must be based on server confirmation, then route to the configured post-verification onboarding step.
- Current UI validates locally but clearly reports that the verification endpoint is not yet connected.

### 10. Forgot password
Field: email address.
- Validate email format locally.
- Future server endpoint must return a generic confirmation for both existing and non-existing accounts to prevent account enumeration.
- Server must generate a short-lived, single-use, hashed reset token and deliver a link through a configured email provider.
- Do not reveal whether an account exists.
- Reset-password completion is a separate screen/step and is not implied by the request screen.
- Current UI clearly reports that recovery delivery is not connected; it does not claim an email was sent.

## Interaction states
- Default: neutral border and muted placeholder.
- Focus: primary/indigo border and visible keyboard focus.
- Pressed: slight opacity reduction.
- Disabled/busy: controls disabled while a real request is in flight.
- Validation error: inline message within the form card; preserve entered values.
- Server error: safe, human-readable message; do not expose stack traces or provider secrets.
- Success: only show after a trusted server response.

## Backend contracts required before production
1. `POST /api/auth/register`: validate input, hash password using a modern password-hashing algorithm, create pending account and verification challenge in a transaction, send email, return challenge metadata.
2. `POST /api/auth/email/verify`: consume one-time challenge atomically, mark email verified, issue session only according to account policy.
3. `POST /api/auth/email/resend`: enforce per-account and per-IP throttles; generic response.
4. `POST /api/auth/password/forgot`: generic response; issue hashed, expiring, single-use token and send email.
5. `POST /api/auth/password/reset`: validate token, replace password hash, revoke active sessions, consume token.
6. OAuth authorization-start endpoint with provider allowlist, PKCE/state, strict redirect URI validation and server-side code exchange.
7. Session revocation, cookie flags, CSRF protection for cookie-authenticated mutations, audit events, rate limiting and abuse monitoring.

## Data model additions required
- Credential table keyed by user ID, with unique normalized email and password hash; never store plaintext passwords.
- Email verification challenge table with hashed token/code, expiry, attempt counter, consumed timestamp and delivery metadata.
- Password reset challenge table with hashed token, expiry, consumed timestamp and request metadata.
- Auth session/device table if revocation and device management are required.
- Unique indexes and transactional constraints to prevent duplicate accounts and challenge reuse.

## Acceptance criteria
- No simulated timer can produce a fake successful sign-up, sign-in, verification, or password-recovery state.
- Form validation is accessible and does not clear unrelated values.
- Keyboard does not cover focused inputs or the primary action.
- Back navigation works consistently on Android, iOS and web.
- OAuth is hidden or explicitly unavailable until a real provider start flow is configured.
- Server secrets and raw tokens never enter client logs.
- Full typecheck, lint, unit, integration and device tests pass before merge.
