# Android test build (internal APK)

**Status: NOT BUILT.** No APK exists in this handoff. The authoring sandbox has no package registry, no Android SDK and no Expo account, so a build could not be produced or launched. Nothing below has been run end to end; it is the shortest route on a machine/account that can.

## What the project is (checked)
- Expo SDK 54 (`expo ~54.0.29`), React Native 0.81.5, `expo-router` entry (`"main": "expo-router/entry"`), new architecture on, React Compiler on. Android package / iOS bundle id: `com.app.geminioos`, deep-link scheme `manusgeminioos`.
- It also runs as a web app (`pnpm dev:metro` = `expo start --web`). Native Android needs a compiled build because it uses `expo-sqlite`, `expo-audio`, `expo-video`, `expo-notifications`, `expo-build-properties` (all config plugins). Expo Go is **not recommended** (notifications and some plugins are limited there, and Metro would need to be reachable from the phone).
- Backend: Express + tRPC (`server/_core/index.ts`, port 3000) + MySQL/TiDB (Drizzle). The app talks to it at `EXPO_PUBLIC_API_BASE_URL`. Sign-in is Manus OAuth (`OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID`); a real sign-in has never been run in any verification pass.
- The URL in the old `.project-config.json` (`…manus.computer`) did not respond (HTTP 000) when probed; treat it as dead. That file was removed from the source (DEF-017).

## You need
1. An Expo account (free) and `eas-cli` (`npm i -g eas-cli`, `eas login`). Cloud builds are queued on Expo's servers; free tier works but may queue.
2. A **publicly reachable HTTPS backend** (release APKs block plain `http://` and `localhost` is your phone itself). Options: deploy `pnpm build && pnpm start` on a host with a MySQL/TiDB database, or a temporary tunnel (`cloudflared tunnel --url http://localhost:3000`) to a backend on your computer. Backend env: see `.env.example` (`DATABASE_URL`, `JWT_SECRET` >= 32 chars, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, provider keys). Run the DB migrations first (`drizzle/` plus `drizzle/pending/0010-0012`).
3. Manus OAuth must accept the app's redirect scheme for your `VITE_APP_ID`; otherwise sign-in cannot complete (unverified).

## Build (run on your computer)
```
pnpm install --frozen-lockfile
eas init                                   # links the project to your Expo account
eas env:create --environment preview --name EXPO_PUBLIC_API_BASE_URL --value https://YOUR-BACKEND --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_APP_ID        --value <VITE_APP_ID> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_OAUTH_PORTAL_URL --value <portal url> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_OAUTH_SERVER_URL --value <oauth server url> --visibility plaintext
eas build --platform android --profile preview
```
`EXPO_PUBLIC_*` values are compiled into the app and readable by anyone with the APK: never put JWT secrets, DB URLs or provider keys there. Expo creates and stores the Android signing keystore for you; do not commit keystores (`.gitignore` blocks them). Install the APK from the link EAS prints.

## Install on the phone
Open the EAS build link on the phone, download the `.apk`, allow "Install unknown apps" for the browser when asked, install, open **Geminio OS**.

## Test checklist (record results; none of these are verified yet)
- Launch: splash shows, no crash, no red error screen. Backend unreachable should show a clear error, not a blank screen.
- Navigation: every bottom tab opens; back works; kill and relaunch.
- Sign-in: sign in, close and reopen (stays signed in), sign out (returns to signed-out state).
- Home Chat: send a message (needs the backend LLM keys; otherwise expect an honest "unavailable"); resend the same message offline then online (no duplicate run/charge); stop a running reply; attach a file; try voice (needs STT config) and web search (needs search key) — both should say unavailable if unconfigured; the Run-code button should say unavailable without a sandbox.
- Cross-user: with two accounts, confirm user B cannot see user A's conversations.
- Notifications: allow permission; check an approval notification arrives.
- AI/Live Builder: create a project; preview needs a runner (expect "unavailable" unless `RUNNER_PROVIDER` is configured).

## Known limitations
Real Vitest, MySQL, API and end-to-end checks have never run; the app has never been launched on a device by this process. Several features (web search, STT, code run, runner/deploy, payments) require external services and are honestly reported unavailable when unconfigured.
