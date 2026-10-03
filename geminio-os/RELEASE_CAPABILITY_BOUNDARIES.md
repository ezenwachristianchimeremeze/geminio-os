# Geminio OS Release Capability Boundaries

## EAS and platform release

The Expo project is configured for managed EAS builds through `app.config.ts`. Native credentials, Apple App Store Connect access, and Google Play Console access remain external release prerequisites and must be supplied in the build environment rather than embedded in the client.

## OTA updates

OTA updates must be published only for JavaScript and asset changes compatible with the installed native runtime. A rollback is required when health checks fail or the update reports a crash increase. Native dependency changes require a new store build.

## Store distribution

App Store Connect and Google Play Console are provider-bound release operations. The application exposes release metadata and build profiles, while signing, review submission, staged rollout, and store credentials remain controlled by the release operator.

## Desktop

The mobile codebase remains the source of truth. Desktop bundling is a boundary for an Electron or Tauri host and must provide a secure IPC bridge; renderer code must not receive arbitrary filesystem or shell access.

## Security audit

`pnpm security:audit` writes `artifacts/security-audit.json` with dependency-audit and typecheck evidence. A non-zero typecheck result fails the command. Dependency advisories are reviewed before release.

## Style guide

The existing Capability Lab is the component catalog for shared primitives, interaction states, reduced-motion behavior, and platform fallbacks. New components must be added there with an accessible state and a deterministic test.
