# Suggested Commands

## Development

```bash
pnpm dev          # Start dev server (React Router)
pnpm build        # Production build
pnpm start        # Run production server
```

## CLI Tools

```bash
pnpm cli:invoice  # Create invoice (tsx src/create-invoice.ts)
pnpm cli:auth     # freee authentication
pnpm cli:google   # Google authentication
pnpm cli:freee    # List invoices from freee
```

## Code Quality

```bash
pnpm typecheck    # TypeScript type checking (runs typegen first)
pnpm lint         # Biome linting
pnpm format       # Prettier format check
pnpm format:fix   # Auto-fix formatting
pnpm validate     # Run format + lint, then typecheck
```

## Testing

```bash
pnpm test         # Run Vitest tests
pnpm test:watch   # Watch mode
```

## Database

```bash
pnpm db:push        # Apply schema (local SQLite)
pnpm db:push:turso  # Apply schema (Turso)
pnpm db:types       # Generate Kysely types from DB
```

## System Utilities (macOS/Darwin)

```bash
git status/diff/log  # Version control
ls -la               # List files
find . -name "*.ts"  # Find files
grep -r "pattern"    # Search in files
```
