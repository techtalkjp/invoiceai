# InvoiceAI Project Overview

## Purpose
AI-powered invoice management application for freelancers and small teams, integrated with freee accounting software.

## Tech Stack
- **Framework**: React Router v7 (with react-router-auto-routes for file-based routing)
- **Language**: TypeScript (ESM)
- **Database**: SQLite (libsql) with Kysely ORM
- **Auth**: better-auth
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI, shadcn/ui
- **Forms**: conform + zod
- **AI**: Vercel AI SDK with Google AI
- **PDF**: @react-pdf/renderer, pdf-lib
- **Package Manager**: pnpm

## Project Structure
```
app/           # React Router v7 web app
  ├── routes/     # File-based routing
  ├── components/ # Shared components (ui/ for shadcn)
  ├── lib/        # Database, auth, utilities
  ├── hooks/      # Custom React hooks
  └── utils/      # Helper functions
src/           # CLI tools and core services
  ├── cli/        # CLI entrypoints
  ├── core/       # Business logic
  ├── services/   # External service integrations
  ├── adapters/   # API adapters (freee, Google)
  └── validators/ # Validation schemas
db/            # SQLite database files + Atlas schema
docs/          # freee OAuth/API documentation
public/        # Static assets
terraform/     # GCP infrastructure (API enablement)
output/        # Generated invoice outputs
```

## Key Integrations
- freee API (accounting/invoicing)
- Google OAuth
- AI-powered parsing/generation
