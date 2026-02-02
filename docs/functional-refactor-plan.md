# Functional Refactor Plan

Goal

- Move the codebase toward a functional style that is easier to test, reuse, and
  maintain, while keeping behavior unchanged.

Principles

- Pure core, impure edges: keep side effects at the CLI boundary.
- Dependency injection: pass dependencies as parameters, do not read globals in
  core logic.
- Data-first: pass plain data structures, return plain data structures.
- Explicit errors: return errors from functions instead of exiting inside them.
- Small, composable functions over large workflows.

Target architecture

- src/core/ Pure domain logic and transformations.
- src/services/ Use-case orchestration with explicit dependencies.
- src/adapters/ IO adapters (API clients, filesystem, env).
- src/cli/ CLI entrypoints and user interaction.

Status (Completed)

- Extracted shared env/cli helpers into adapters.
- Moved work-hours parsing to `src/core/work-hours.ts`.
- Split invoice flow into `src/services/invoice-service.ts`.
- Moved invoice date/subject helpers to `src/core/invoice-utils.ts`.
- Added Freee/Google adapters and OAuth services.
- Unified CLI error handling via `src/cli/run.ts`.
- Added AppError for user-facing error messages.
- Added Vitest tests for core/services.
- Migrated Google Sheets to adapter; removed legacy `src/google-sheets.ts`.
- Freee client usage now goes through factory + dependency injection.
- Added adapter-level tests for fetch logic.

Status (Next)

- Replace remaining ad-hoc errors with AppError where useful.
- Consider a small Result type for non-exceptional control flow.

Step 1: Extract shared IO helpers

- Create `src/adapters/env.ts` for get/set env helpers and .env update.
- Create `src/adapters/cli.ts` for prompt/openBrowser.
- Update `src/auth.ts` and `src/google-auth.ts` to use these helpers.
- Behavior unchanged, only move helpers.

Step 2: Introduce functional core for work-hours parsing

- Move parsePatternA/B from `src/google-sheets.ts` to `src/core/work-hours.ts`.
- Make parsers pure: input `string[][]` -> output `{ totalHours, entries }`.
- Keep Google API calls in `src/adapters/google-sheets.ts`.
- Update imports accordingly.

Step 3: Separate invoice workflow into functional service

- Create `src/services/invoice-service.ts` that receives:
  - `getWorkHours`, `createInvoice`, `getInvoicePdf`, `exportSheetAsPdf`,
    `mergePdfs`, `now`, `env` accessors as arguments.
- The service returns data needed by CLI (invoice ids, file path).
- CLI (`src/create-invoice.ts`) only parses args and prints output.

Step 4: Pure date/subject utilities

- Move date/subject functions in `src/create-invoice.ts` to
  `src/core/invoice-utils.ts`.
- Functions are pure: inputs -> outputs, no env or IO.

Step 5: API adapters and domain types

- Rename `src/freee-client.ts` -> `src/adapters/freee.ts` (or keep file but
  export a factory).
- For Google and freee clients, export a function that accepts token providers.
- Introduce typed ports in `src/services/ports.ts` for dependencies.

Step 6: Error handling strategy

- Replace `process.exit(1)` in non-CLI code with error returns.
- CLI layer converts errors into exit codes and messages.

Step 7: Optional tests (recommended)

- Add unit tests for:
  - work-hours parsing
  - invoice date calculations
  - subject template generation
- Use fixture data from real sheets (sanitized).

Migration notes

- Do not change behavior in steps 1-4.
- Keep all CLI command output stable until refactor is complete.
- Introduce changes behind small commits per step.

Deliverables

- New folder structure and updated imports.
- Reduced side effects in core logic.
- Smaller, composable functions with explicit dependencies.
