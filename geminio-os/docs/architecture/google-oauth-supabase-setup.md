# Google sign-in setup (staged Supabase identity store)

## Architecture choice
Google OAuth uses Google's authorization-code flow and verifies the returned ID token against Google's published signing keys with the existing `jose` dependency. Google identities are stored in the dedicated Supabase table `public.geminio_auth_users`. The existing MySQL-backed product tables and email/Manus auth remain unchanged in this staged release; this is not yet a full application-wide PostgreSQL migration.

## Install / configure
No new npm dependency is required. The implementation uses the existing `jose`, Express, and Node fetch APIs.

Set these backend environment variables (never commit actual values):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (must exactly match Google Cloud; local default is `http://localhost:3000/api/auth/callback`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Run `drizzle/0020_google_auth_supabase.sql` in the Supabase SQL Editor. The service-role key is server-only and must never be exposed to Expo/Vite client variables.

## Google Cloud Console
Add the exact backend callback URL as an Authorized redirect URI. The Express API defaults to port 3000; Expo Metro on 8081 is the frontend and is not the callback server. For Codespaces/Replit, use the public HTTPS URL of the backend service and set the same URL in `GOOGLE_REDIRECT_URI`.

## Endpoints
- `GET /api/auth/google`: creates a short-lived HttpOnly state cookie and redirects to Google.
- `GET /api/auth/callback`: validates state, exchanges the code, verifies issuer/audience/signature, requires a verified email, stores the identity in Supabase, creates the existing Geminio session JWT, and sets the existing session cookie.

## Important limitations
- Google identity records are stored in Supabase, but existing email/password accounts and product data are still on the legacy MySQL path. Do not assume cross-provider account linking; Google identities are namespaced as `google:<sub>`.
- The application session lookup recognizes Google identities via the Supabase store. Other user records continue through the existing MySQL store.
- Configure a frontend URL reachable from the browser using `EXPO_WEB_PREVIEW_URL` or `EXPO_PACKAGER_PROXY_URL`.
- This code has not been runtime-tested against your Google Cloud or Supabase projects. Complete the SQL step and configure deployment secrets before testing.
