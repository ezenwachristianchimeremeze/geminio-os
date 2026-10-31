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

- The API uses the existing Geminio signed session cookie for authenticated sessions. The legacy session format is not yet backed by a revocation registry; do not represent global session revocation as implemented.
- Google OAuth is not enabled by these changes. It requires Google OAuth client credentials, approved redirect URIs, and a provider-specific authorization/callback implementation. The existing Manus OAuth callback is a different identity integration.
- Resend test sender restrictions remain in effect until a sender domain is verified. No domain purchase is required for local development or code integration.

## Verification checklist

Before marking Phase A 6–10 production-ready:
1. Apply the migration to a disposable MySQL database.
2. Configure test Resend sender and an authorized recipient.
3. Test registration, duplicate registration, verification, expired/reused code, resend throttling, sign-in, generic password-recovery response, expired/reused reset token and reset-password sign-in.
4. Run `pnpm check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
5. Test web and Android flows, including the reset deep link and cookie/session persistence.
6. Add a persistent distributed rate limiter, transactional registration/token consumption, and a revocable session registry before production launch.
