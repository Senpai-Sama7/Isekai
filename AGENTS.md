# Repository Guidelines

## Project Structure & Module Organization
Isekai is an npm workspace monorepo. Core agents live in `packages/{backend,planner,sandbox,frontend,frontend-web}`, with supporting modules in `packages/contracts`, `packages/data`, and `packages/observability`. Source lives in `src/`; tests sit in `tests/` or `src/**/__tests__/`. Reference `docs/`, `RUNNING_SYSTEM.md`, and `deploy/` for operations, and use `dev/compose/docker-compose.yml` when you need the full stack. Add new capabilities inside the owning package and surface shared types through `packages/contracts` instead of cross-linking directories.

## Build, Test, and Development Commands
After `npm install`, rely on:
- `npm run dev` — starts backend (8080), planner (8090), sandbox (8070), and frontend (3001) together.
- `npm run build` — TypeScript compile for every workspace into its `dist/` or React build output.
- `npm run test` — executes all suites; add `--workspace=@isekai/backend` (or another name) to limit scope.
- `npm run lint` — ESLint across workspaces; resolve all warnings before merge to avoid CI failures.

## Coding Style & Naming Conventions
Code in TypeScript with 2-space indentation and the shared ESLint presets (`eslint:recommended`, `@typescript-eslint`). Prefix intentionally unused parameters with `_`. Use `PascalCase` for React components, `camelCase` for hooks/utilities, and suffix singleton services with `Service`. Backend controllers live in `packages/backend/src/controllers` and export `{resource}Controller`. Never commit built `dist/` assets or non-templated `.env*` files.

## Testing Guidelines
Backend, planner, and sandbox packages use Jest; add files to `tests/*.test.ts` and keep configs in sync with each package’s `jest.config.js`. Frontend variants run `react-scripts test` with React Testing Library colocated under `src/**/__tests__/`. Track coverage against `TEST_COVERAGE_SUMMARY.md`, and run backend smokes via `npm run test --workspace=@isekai/backend -- test:smoke` before major merges. Stub external HTTP calls so CI stays deterministic.

## Commit & Pull Request Guidelines
Adopt Conventional Commit subjects (`feat:`, `fix:`, `chore:`) capped at 72 characters and group changes by package for clarity. Pull requests should supply a problem statement, summary of the approach, linked issues, and proof of testing (command output or UI screenshots). Tag the maintainers for the affected package and wait for automated checks to succeed before merging.

## Environment & Configuration Tips
Use Node.js 18+ and npm 9+ as enforced by the root `package.json`. Seed locals from the `.env.example` files (root, backend, frontend) and keep secrets out of git. Use `dev/compose/docker-compose.yml` when validating cross-agent workflows, and stop containers after use to free the ports.
