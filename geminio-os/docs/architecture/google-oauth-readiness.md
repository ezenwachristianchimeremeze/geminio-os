# Google OAuth readiness

## Decision

Geminio OS will use Google's OAuth 2.0 authorization-code flow with server-side ID-token verification. The implementation will use `google-auth-library`; Passport is not required for this API-first flow.

## Credentials

Configure these values only in the backend environment (Codespaces Secrets, Replit Secrets, or a private local `.env`):

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

Never commit `.env`, a client secret, refresh token, or database password.

## Redirect URI

The Express API is configured to start on port 3000 by default. Expo web uses port 8081. Therefore the local backend callback should be:

`http://localhost:3000/api/auth/callback`

The Google Cloud Console Authorized redirect URI must match `GOOGLE_REDIRECT_URI` exactly. For Codespaces or Replit, register the HTTPS URL exposed for the backend service and set the same exact value in its environment.

## Planned routes

- `GET /api/auth/google`: create a cryptographically random, one-time OAuth state value, persist it in a short-lived HttpOnly/SameSite cookie, and redirect to Google's authorization endpoint with `openid email profile` scopes.
- `GET /api/auth/callback`: validate and consume state, exchange the authorization code, verify the ID token against the configured client ID, require `email_verified === true`, resolve/create the application user in PostgreSQL, and issue the existing Geminio session.
- Failure paths: reject missing/invalid state, provider errors, invalid or expired tokens, unverified email, and account conflicts without disclosing internal details.

## Dependency decision

Runtime dependency: `google-auth-library`.

The existing project already includes `jose` for Geminio session JWT signing. The PostgreSQL database foundation also requires `pg` and `@types/pg` (development dependency). Do not add Passport unless a later requirement needs Passport's strategy/session model.

Install in the project root:

```bash
pnpm add google-auth-library pg
pnpm add -D @types/pg
```

## Blocking integration requirement

**Google OAuth is not yet implemented or enabled by this document.** The current repository database adapter and Drizzle schema still use MySQL (`drizzle-orm/mysql2` and `drizzle-orm/mysql-core`). The selected production database is Supabase PostgreSQL. Before enabling the callback, migrate the schema and all database access used by authentication to PostgreSQL, including the shared user lookup used by session authentication. A Google callback that writes to PostgreSQL while session validation reads from MySQL would create an inconsistent and broken login.

The PostgreSQL migration must preserve the existing application tables and relations, not just create the three email-authentication tables. Generate and review a complete PostgreSQL migration before applying it to a populated database.

## Verification checklist

- [ ] PostgreSQL Drizzle schema and adapter replace MySQL throughout the application.
- [ ] Existing application tables and foreign keys are migrated.
- [ ] Email/password registration and login pass against Supabase PostgreSQL.
- [ ] OAuth state is one-time, short-lived, and protected against CSRF.
- [ ] Google ID token is verified server-side; email must be verified.
- [ ] Existing-account linking policy is explicit and tested.
- [ ] Session cookie flags are correct for localhost and HTTPS deployments.
- [ ] Callback success and failure paths are tested in web and mobile flows.
- [ ] `pnpm check`, `pnpm lint`, `pnpm test`, and `pnpm build` pass.

Do not mark Google OAuth production-ready until all checks above are complete.
