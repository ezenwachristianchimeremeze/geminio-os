# Geminio OS

**An AI-first workspace and software-development ecosystem — active development.**

Geminio OS explores how AI-assisted tools can support a connected software-development workflow, from project planning and requirements through code assistance, analysis, testing, and deployment preparation.

This repository contains the main application source. The application is located in the nested geminio-os directory.

## Project overview

The checked-in application uses Expo, React Native, TypeScript, an Express/tRPC backend, and Drizzle ORM. It includes a mobile-oriented product shell, AI workspace and orchestration modules, builder workflows, and supporting documentation.

The project is under active development. A feature being represented in the interface or roadmap does not automatically mean its external service or production integration is complete.

## Repository layout

- geminio-os/ — application source, package configuration, tests, and engineering documentation.
- geminio-os/README.md — application setup and developer handoff.
- geminio-os/GEMINIO_OS_IMPLEMENTATION_STATUS.md — recorded implementation evidence, validation snapshot, and known limitations.
- geminio-os/GEMINIO_OS_DEVELOPER_HANDOFF.md — architecture, trust boundaries, setup, and operation notes.
- geminio-os/GEMINIO_OS_CONTINUATION_ROADMAP.md — outstanding engineering work.

## Getting started

1. Open the application directory: cd geminio-os.
2. Install the package manager specified by the project and install dependencies with pnpm install.
3. Copy .env.example to .env and configure only the services you actually have credentials and infrastructure for.
4. Review the developer handoff before starting the application.
5. Run the checks defined in package.json before proposing or deploying changes.

The checked-in environment template currently specifies a MySQL-style database URL and the handoff describes Drizzle/MySQL. Confirm the intended database architecture before deployment; do not assume a different database provider is already integrated.

## Current capability boundaries

- The isolated execution provider for generated project code is not configured in the documented checkpoint. The project therefore does not claim that arbitrary generated code runs in a production sandbox.
- External AI providers, OAuth, payment processing, deployment services, and other integrations depend on their respective credentials and provider configuration.
- The implementation-status document is the source of truth for the latest recorded verification and known limitations. Re-run the checks against the current commit before making new test-coverage or production-readiness claims.

## Engineering principles

- Keep generated or untrusted code outside the trusted application process.
- Enforce authentication, ownership checks, and explicit permission boundaries.
- Treat external services as provider integrations, not assumed capabilities.
- Document what is implemented, what is simulated or controlled, and what remains unavailable.

## Related work

- [Geminio OS supporting documentation and reports](https://github.com/ezenwachristianchimeremeze/geminio-os-platform)
- [Technical writing portfolio](https://github.com/ezenwachristianchimeremeze/technical-writer-portfolio)
- [Project updates and technical articles](https://ezenwachristianchimeremeze.medium.com/)
