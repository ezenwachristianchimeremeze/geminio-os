# Phase A authentication backend configuration

## Environment

Configure these values in the backend deployment environment (never commit secrets):

- `DATABASE_URL`: MySQL connection URL. Required for registration, sign-in, verification and recovery.
- `RESEND_API_KEY`: Resend API key. Use a restricted sending key where available.
- `AUTH_EMAIL_FROM`: Sender identity accepted by Resend. During development, Resend's onboarding sender is restricted to authorized test recipients.
- `AUTH_PUBLIC_URL`: Public application origin used to build password-reset links.
- `JWT_SECRET`: Existing Geminio session signing secret; retain the existing production minimum-length requirements.
- `EXPO_PUBLIC_API_URL`: API origin compiled into the Expo client, e.g. the development API origin. Leave empty only when the app and API share an origin.

Do not paste secret values into chat, source files, screenshots, or Git commits. Add them through the deployment provider's secret/environment settings.

## Migration

Apply `drizzle/0010_email_auth.sql` after the existing migrations. It creates:
- `auth_credentials`: unique email identity, scrypt password hash and verification state.
- `auth_action_tokens`: hashed, expiring, single-use email-verification and password-reset tokens.

Take a database backup before applying migrations to a shared or production database.

## Endpoints

- `POST /api/auth/register`
- `POST /api/auth/sign-in`
- `POST /api/auth/email/verify`
- `POST /api/auth/email/resend`
- `POST /api/auth/password/forgot`
- `POST /api/auth/password/reset`
- `GET /api/auth/email/status`

The existing `/api/auth/me`, logout, session and Manus OAuth callback routes remain registered.

## Current boundaries

- The API uses the existing Geminio signed session cookie for authenticated sessions. Registration, email-code consumption and password-reset consumption now use database transactions. The legacy session format is not yet backed by a revocation registry; password reset therefore does not yet revoke already-issued sessions. Do not represent global session revocation as implemented.
- Google OAuth is not enabled by these changes. It requires Google OAuth client credentials, approved redirect URIs, and a provider-specific authorization/callback implementation. The existing Manus OAuth callback is a different identity integration.
- Resend test sender restrictions remain in effect until a sender domain is verified. No domain purchase is required for local development or code integration.

## Verification checklist

Before marking Phase A 6–10 production-ready:
1. Apply the migration to a disposable MySQL database.
2. Configure test Resend sender and an authorized recipient.
3. Test registration, duplicate registration, verification, expired/reused code, resend throttling, sign-in, generic password-recovery response, expired/reused reset token and reset-password sign-in.
4. Run `pnpm check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
5. Test web and Android flows, including the reset deep link and cookie/session persistence.
6. Replace the process-local rate limiter with a shared persistent limiter before multi-instance production deployment. Registration and verification/reset token consumption are transactional, but resend/recovery issuance still need concurrency-focused tests and hardening. Add a revocable session registry or session-version check before production launch.


## Connected client journey (items 6, 8, 9 and 10)

The Expo Router screen at `app/auth/[flow].tsx` calls the corresponding API routes:

| User action | Client flow | API |
| --- | --- | --- |
| Create account | `sign-up` | `POST /api/auth/register` |
| Verify email | `verify-email` | `POST /api/auth/email/verify` |
| Request another verification code | `verify-email` resend action | `POST /api/auth/email/resend` |
| Sign in | `sign-in` | `POST /api/auth/sign-in` |
| Request password recovery | `forgot-password` / `recovery` | `POST /api/auth/password/forgot` |
| Set a new password | `reset-password` | `POST /api/auth/password/reset` |

The password recovery email is sent only when `AUTH_PUBLIC_URL` (or the documented app URL fallback) is a valid HTTPS origin, or a localhost development origin. This avoids sending a relative or malformed reset link. Production must set `AUTH_PUBLIC_URL` to the deployed web application's origin and configure the same origin in the app's routing/deep-link setup.

Registration requires explicit `acceptedTerms: true`. Passwords must be 10–128 characters. Verification codes expire after 30 minutes; reset tokens expire after 15 minutes. The API returns a generic 202 response for password-recovery requests to reduce account enumeration.

## Test execution record

The repository contains a manual acceptance plan in `docs/quality/authentication-test-plan.md`. The GitHub-connected editing environment can commit source and documentation, but it has not executed the repository's package scripts or connected to the user's MySQL/Resend deployment. Therefore the implementation is committed, but runtime integration and production readiness remain **unverified** until the checklist above is run in the actual environment.
