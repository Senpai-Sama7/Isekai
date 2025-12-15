# Implementation Roadmap: Achieving a Production-Ready Isekai System

## Introduction

This document provides a detailed, sequential roadmap for transforming the Isekai project from its current state into a fully functional, integrated, and production-ready application. It is based on the findings of the comprehensive code audit performed on October 11, 2025.

The roadmap is divided into phases, starting with foundational cleanup and progressively moving towards full feature implementation and hardening. Each step includes context, a specific action plan, and a verification procedure to ensure success before proceeding to the next.

## Phase 1: Foundational Cleanup & Configuration Hardening

**Goal:** Stabilize the project, remove inconsistencies, and enforce quality gates. This phase must be completed before any new features are built.

--- 

### 1.1. Enforce Strict Build Checks

*   **Context:** The `frontend-web` application is currently configured to ignore TypeScript and ESLint errors during builds. This is a major risk that allows low-quality and potentially buggy code into the application.
*   **Action:**
    1.  Open `packages/frontend-web/next.config.ts`.
    2.  Remove the `typescript: { ignoreBuildErrors: true }` and `eslint: { ignoreDuringBuilds: true }` sections.
*   **Verification:**
    1.  Navigate to the `packages/frontend-web` directory.
    2.  Run `npm run build`.
    3.  The build will likely fail, reporting all existing TypeScript and ESLint errors. **You must fix every error** until the build command completes successfully.

--- 

### 1.2. Enforce CI Quality Gates

*   **Context:** The CI pipeline in `.github/workflows/ci.yml` uses `|| true` on critical linting and health check steps, meaning the build will pass even if these checks fail.
*   **Action:**
    1.  Open `.github/workflows/ci.yml`.
    2.  Locate the `Lint and typecheck` and `Compose integration` steps.
    3.  Remove `|| true` from the end of the `run` commands.
*   **Example (`ci.yml` change):**
    ```diff
    - run: |
    -   npm run -ws lint --if-present || true
    -   npm run -ws typecheck --if-present || true
    + run: |
    +   npm run -ws lint --if-present
    +   npm run -ws typecheck --if-present
    ```
*   **Verification:** Push a commit that is known to have a linting error. The `build-test` job in GitHub Actions must fail.

--- 

### 1.3. Remove Dead Code and Packages

*   **Context:** The `packages/frontend` directory is a legacy, unused React application that adds clutter and confusion.
*   **Action:**
    1.  Delete the entire `packages/frontend` directory.
    2.  Open the root `package.json` and remove the `dev:frontend` script from the `scripts` section.
*   **Verification:**
    1.  Run `npm install` from the root directory to ensure all dependencies resolve correctly.
    2.  Run `npm run dev`. The command should execute without errors, and all remaining services should start.

## Phase 2: Unify the Data Layer

**Goal:** Consolidate the project onto a single, modern, and scalable data layer using Prisma and PostgreSQL.

--- 

### 2.1. Establish the Canonical Prisma Schema

*   **Context:** The project has two data models. We will make Prisma the single source of truth.
*   **Action:**
    1.  Move the `prisma` directory from `packages/frontend-web/prisma` to `packages/db` (a new package).
    2.  Rewrite the schema file (`packages/db/prisma/schema.prisma`) to define the `App` and `Suggestion` models, based on the interfaces in the old `packages/backend/src/db/database.ts` file.
*   **Example (`schema.prisma`):**
    ```prisma
    generator client {
      provider = "prisma-client-js"
    }

    datasource db {
      provider = "postgresql"
      url      = env("DATABASE_URL")
    }

    model App {
      id          String    @id @default(cuid())
      name        String
      prompt      String
      status      String // e.g., 'generating', 'running', 'error'
      previewUrl  String?
      code        String    // JSON string
      metadata    String    // JSON string
      createdAt   DateTime  @default(now())
      updatedAt   DateTime  @updatedAt
      suggestions Suggestion[]
    }

    model Suggestion {
      id          String   @id @default(cuid())
      app         App      @relation(fields: [appId], references: [id])
      appId       String
      title       String
      description String
      changes     String   // JSON string
      createdAt   DateTime @default(now())
    }
    ```
*   **Verification:**
    1.  Create a `package.json` for the new `packages/db` directory, adding `prisma` as a dev dependency.
    2.  Run `npx prisma generate` from within `packages/db`. The Prisma client must be generated successfully.

--- 

### 2.2. Refactor Backend to Use Prisma

*   **Context:** The `backend` service must be rewritten to use the new Prisma client instead of SQLite.
*   **Action:**
    1.  Delete `packages/backend/src/db/database.ts`.
    2.  Remove `better-sqlite3` from `packages/backend/package.json`.
    3.  Add the new `@isekai/db` package as a dependency to the `backend`.
    4.  Create a new database service/singleton (e.g., `packages/backend/src/db/client.ts`) that initializes and exports a single instance of the Prisma client.
    5.  Refactor all files that previously used the `Database` singleton (e.g., `appController.ts`) to use the new Prisma client instance. All database calls must be rewritten using Prisma's API.
*   **Verification:**
    1.  All backend unit tests must be updated to mock the Prisma client instead of the old `Database` class.
    2.  Run all tests in the `backend` package. They must all pass.

## Phase 3: Unify the Communication Protocol

**Goal:** Implement the architecturally-sound gRPC communication layer across all services, removing the inconsistent REST/`axios` implementation.

--- 

### 3.1. Implement gRPC Server in `planner`

*   **Context:** The `planner` service currently uses Express to serve a REST API. It needs to serve the gRPC `Planner` service definition.
*   **Action:**
    1.  Add `@connectrpc/connect-node` and the `@isekai/contracts` package as dependencies to `packages/planner`.
    2.  In `packages/planner/src/index.ts`, create a `connect-node` gRPC server.
    3.  Implement the `Plan` method logic, which will contain the core logic currently in the Express route handler.
*   **Verification:** The `planner` service should start without errors, and you should be able to make a call to the gRPC service using a gRPC client (like `grpcurl`).

--- 

### 3.2. Refactor `backend` to use gRPC Client

*   **Context:** The `backend` service uses `axios` to call the `planner`. This must be replaced with the type-safe gRPC client.
*   **Action:**
    1.  In `packages/backend/src/services/plannerService.ts`, remove `axios`.
    2.  Import the generated `Planner` client from `@isekai/contracts`.
    3.  Instantiate the client, pointing it to the `PLANNER_URL`.
    4.  Replace all `axios.post` calls with the corresponding type-safe methods on the gRPC client (e.g., `client.plan(...)`).
*   **Verification:**
    1.  Update the relevant unit tests in the `backend` to mock the gRPC client methods.
    2.  Run the `compose-integration` test from the CI pipeline locally. The health checks, which should be updated to test the gRPC connection, must pass.

## Phase 4: Full Frontend-Backend Integration

**Goal:** Connect the `frontend-web` UI to the `backend` API to create a fully functional application.

--- 

### 4.1. Implement a Frontend API Client

*   **Context:** The frontend needs a centralized, robust way to communicate with the backend.
*   **Action:**
    1.  Create a new file `packages/frontend-web/src/lib/api.ts`.
    2.  In this file, create functions for each backend endpoint you need to call. Use the browser's `fetch` API or a lightweight library.
    3.  Handle base URLs, headers, and error handling consistently within this module.
*   **Example (`api.ts`):**
    ```typescript
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    export async function generateApp(prompt: string): Promise<any> {
      const response = await fetch(`${BASE_URL}/api/apps/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) {
        throw new Error('Failed to generate app');
      }
      return response.json();
    }
    ```
*   **Verification:** The module should export typed functions for interacting with the API.

--- 

### 4.2. Replace All Mock Data with API Calls

*   **Context:** The UI is currently a facade. It must be connected to the API client.
*   **Action:**
    1.  In `packages/frontend-web/src/app/page.tsx`, import the functions from your new `api.ts` module.
    2.  In the `handlePromptSubmitted` function, remove all mock data generation.
    3.  Call the `generateApp` function from your API client.
    4.  Implement loading and error states. Use a `try...catch` block and state variables (e.g., `const [isLoading, setIsLoading] = useState(false);`) to give the user feedback.
    5.  Set the component state (`setPlan`, `setGeneratedApp`) using the actual data returned from the API call.
*   **Verification:**
    1.  Start the full application stack (`make dev` or `docker-compose up`).
    2.  Open the web UI, type a prompt (e.g., "create a todo app"), and submit.
    3.  The UI should show a loading state, and then display the plan and generated app preview based on the real response from the backend.

## Phase 5: Enterprise-Grade Hardening

**Goal:** Implement critical enterprise features like authentication, authorization, and improved observability.

--- 

### 5.1. Implement Authentication (JWT)

*   **Context:** The system currently has no concept of users, which is a critical security flaw and a blocker for any real-world use.
*   **Action:**
    1.  **Backend:**
        *   Add JWT libraries (e.g., `jose`).
        *   Create `/auth/login` and `/auth/register` endpoints.
        *   Create authentication middleware that verifies the JWT from the `Authorization` header and attaches the user to the request object.
        *   Protect all necessary API routes with this middleware.
        *   Modify the Prisma schema to link `App` records to a `User` record.
    2.  **Frontend:**
        *   Create Login and Register pages/components.
        *   Implement a global state management solution (e.g., React Context, Zustand) to store the user's auth token and profile.
        *   Modify the API client to include the auth token in the headers for all protected requests.
*   **Verification:**
    1.  Unauthenticated requests to protected endpoints must fail with a 401 error.
    2.  A user should be able to register, log in, receive a token, and have that token automatically sent with subsequent API requests.
    3.  Apps created by a user should be visible only to that user.

--- 

### 5.2. Update Documentation to Reflect Reality

*   **Context:** The final step is to ensure the documentation is a perfect reflection of the now-functional and robust system.
*   **Action:**
    1.  Thoroughly review and update the root `README.md`.
    2.  Regenerate or redraw all architecture diagrams (C4, sequence) to match the final implementation (Prisma, gRPC, JWT Auth).
    3.  Ensure all setup and development instructions are correct and have been tested from a clean checkout.
*   **Verification:** A new developer should be able to clone the repository, follow the `README.md`, and get a fully functional local environment running without confusion.
