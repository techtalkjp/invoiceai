# Code Style and Conventions

## TypeScript/JavaScript

- **Module System**: ESM (`"type": "module"`)
- **Indentation**: 2 spaces
- **Semicolons**: No (Prettier `semi: false`)
- **Quotes**: Single quotes (`singleQuote: true`)
- **Trailing Commas**: All (`trailingComma: 'all'`)
- **Print Width**: 80 characters

## Linting (Biome)

- Recommended rules enabled
- `useAwait`: error (no unused async functions)
- `noArrayIndexKey`: off (allowed for React keys)

## Formatting (Prettier)

- Plugins: organize-imports, tailwindcss
- Auto-organizes imports on format

## React Router v7 Patterns

- **Data Loading**: Use `loader` only (no `useEffect` for data fetching)
- **Data Mutations**: Use `action` only (no direct API calls)
- **Forms**: conform + zod for validation (client + server)
- **Auth**: Use `requireAuth` / `requireAdmin` helpers

## Route File Naming (react-router-auto-routes)

- `_layout.tsx`: Layout with `<Outlet />`
- `index.tsx` / `_index.tsx`: Index route
- `$param.tsx`: Dynamic parameter route
- `+*`: Ignored (colocated utilities, e.g., `+queries.server.ts`, `+components/`)

## Database

- `db` client: CamelCasePlugin (camelCase columns)
- `authDb` client: snake_case (for better-auth)

## Dialog Pattern

```tsx
const fetcher = useFetcher({ key: `action-${id}` })
useEffect(() => {
  if (fetcher.state === 'idle' && fetcher.data) {
    closeDialog()
  }
}, [fetcher.state, fetcher.data])
```

## Navigation

- Parent nav stays active on subroutes
- Subroutes include breadcrumbs + back button
