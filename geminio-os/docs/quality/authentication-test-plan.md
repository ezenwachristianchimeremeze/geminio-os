# Geminio OS Authentication Test Plan

Status: manual QA plan for the Phase A authentication implementation  
Scope: registration, email verification, sign-in, resend verification, password recovery, password reset, and OAuth readiness.

This document is a test procedure, not evidence that the tests have already passed. Run the tests against a disposable development database and a test email inbox. Never use a real personal password or production customer data.

## Before testing

1. Install dependencies using the package manager declared in `package.json` (pnpm).
2. Configure a disposable MySQL database using the existing MySQL/Drizzle schema. Do not replace `DATABASE_URL` with a Supabase PostgreSQL URL: the current application schema and query layer use MySQL.
3. Apply the repository's migrations, including the email-auth migration.
4. Configure `JWT_SECRET`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `AUTH_PUBLIC_URL`, and `EXPO_PUBLIC_API_URL` for the local environment. Keep all secret values in local environment configuration; do not commit them.
5. For real email delivery, verify the sender domain/address in Resend. The fallback Resend onboarding sender is suitable only for limited provider testing.
6. Start the API and mobile/web app using the scripts in `package.json`.
7. Use a new test email address for each clean registration run. Inspect the database only in the disposable development environment.

## Test cases

| ID | Area | Action | Expected result |
|---|---|---|---|
| AUTH-001 | Registration | Submit valid name, email, password of at least 10 characters, matching confirmation, and accepted terms | Account is created; verification message is sent; app navigates to verification screen |
| AUTH-002 | Registration | Submit without accepting terms | Client blocks submission; no account is created |
| AUTH-003 | Registration | Submit malformed email, short password, or missing name | Validation error; no account is created |
| AUTH-004 | Registration | Register an already-used email | Generic response; no duplicate account or credential row |
| AUTH-005 | Verification | Enter the six-character code delivered to the test inbox | Email is marked verified and a session is issued |
| AUTH-006 | Verification | Enter an incorrect code | Clear invalid/expired-code error; account remains unverified |
| AUTH-007 | Verification | Enter an expired or already-consumed code | Verification is rejected; no session is issued |
| AUTH-008 | Resend | Request a new code for an unverified account | Generic confirmation is shown and a fresh code is delivered |
| AUTH-009 | Resend | Request a code for an unknown or already-verified email | Same generic confirmation; no account enumeration |
| AUTH-010 | Sign-in | Sign in with a verified account and correct password | Session cookie is issued; user reaches the authenticated workspace |
| AUTH-011 | Sign-in | Use an incorrect password or unknown email | Generic credential error; no session is issued |
| AUTH-012 | Sign-in | Sign in before email verification | Request is rejected with the email-not-verified state; no session is issued |
| AUTH-013 | Forgot password | Request reset for a verified test account | Generic confirmation is displayed and reset email is delivered |
| AUTH-014 | Forgot password | Request reset for an unknown email | Same generic confirmation; no account enumeration |
| AUTH-015 | Reset password | Open a valid, unexpired reset link and submit a password of at least 10 characters | Password is changed; user can sign in with the new password |
| AUTH-016 | Reset password | Submit an expired, invalid, or already-used token | Reset is rejected; password remains unchanged |
| AUTH-017 | Reset password | Submit a password shorter than 10 characters | Client and server reject it |
| AUTH-018 | Session | Refresh the app after successful sign-in | Existing valid session remains authenticated |
| AUTH-019 | Session | Sign out, then request the authenticated profile | Session is cleared and profile request is unauthenticated |
| AUTH-020 | Abuse controls | Exceed the configured per-IP request limits | API returns HTTP 429 and a Retry-After header |
| AUTH-021 | Email outage | Temporarily use an invalid Resend key in development | UI shows a safe recovery message; server does not expose provider secrets |
| AUTH-022 | Mobile layout | Test keyboard open, small screen, password visibility, and back navigation | Inputs remain usable; buttons are reachable; no content is obscured |

## OAuth readiness checks

The current repository includes the existing Manus OAuth callback and mobile exchange routes. The email-auth screen's generic provider button does not yet initiate Google OAuth. Do not mark Google OAuth as passed until a provider-start flow, callback/deep-link handling, provider dashboard configuration, and end-to-end sign-in test are implemented and verified.

Do not remove or replace the existing Manus OAuth integration while adding another provider. Google OAuth requires an OAuth client configured with Google and the matching redirect URI configured in the identity provider. Keep client secrets server-side.

## Automated checks to run

Run these from the `geminio-os` project directory:

```bash
pnpm check
pnpm lint
pnpm test -- --run
pnpm build
```

The `release:check` script combines the main checks. If a command fails, preserve the complete error output and note the command, runtime version, and operating system.

## Known limitations to track

- The current auth rate limiter is process-local memory; it is not shared across multiple server instances.
- Verification-code consumption and password-reset updates should be made transactional and concurrency-safe before a multi-instance production deployment.
- Password reset currently does not revoke previously issued long-lived application JWTs. Session revocation needs a persistent session/version strategy before claiming full account-session security.
- Google OAuth is not implemented by the current generic provider screen.
- Email delivery and callback URLs depend on valid external provider configuration.

## Acceptance rule

A test passes only when the observed result matches the expected result and the relevant database/session side effects are confirmed. Record each test as PASS, FAIL, or BLOCKED with the actual result. A blocked test is not a pass.
