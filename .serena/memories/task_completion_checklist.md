# Task Completion Checklist

When completing a task in this project, run the following checks:

## Always Run

```bash
pnpm typecheck   # TypeScript errors
pnpm lint        # Biome linting
pnpm format      # Prettier formatting check
```

Or use the combined command:

```bash
pnpm validate    # Runs format + lint, then typecheck
```

## When Modifying src/ (CLI/Core)

```bash
pnpm test        # Run Vitest tests
```

Especially important when touching:

- `src/core/` - Business logic
- `src/services/` - Service integrations
- `src/adapters/` - API adapters

## When Modifying Database Schema

```bash
pnpm db:push     # Apply schema changes
pnpm db:types    # Regenerate Kysely types
```

## Before Committing

1. Ensure all validation passes (`pnpm validate`)
2. Run tests if applicable (`pnpm test`)
3. Check for sensitive data (no tokens, no `.env` commits)

## Quick Reference

| Area Changed   | Commands to Run                       |
| -------------- | ------------------------------------- |
| Any code       | `pnpm validate`                       |
| src/ directory | `pnpm validate && pnpm test`          |
| DB schema      | `pnpm db:push && pnpm db:types`       |
| app/ routes    | `pnpm validate` + manual browser test |
