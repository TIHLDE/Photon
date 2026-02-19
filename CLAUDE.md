# Photon - Claude Code Guide

This is a TypeScript backend project for Kvark, porting and improving the Python-based [TIHLDE/Lepton](https://github.com/TIHLDE/Lepton) to a modern, type-safe API server built with Hono.

**Important**: This is NOT a 1:1 port. We're actively improving, reorganizing, and upgrading solutions while migrating from Lepton.

## Project Overview

Photon is a complete backend solution featuring:
- Feide OAuth2 authentication via Better Auth
- Event management with registration and payment handling
- Vipps MobilePay integration
- Email system with React Email templates
- Background job processing with BullMQ
- Role-based access control (RBAC)
- OpenAPI documentation

## Project Structure

This is a **Turborepo monorepo** using **Bun** as the package manager and runtime.

```
Photon/
├── apps/
│   └── api/                     # Hono API server (@photon/api)
│       ├── src/
│       │   ├── routes/          # API route handlers
│       │   ├── middleware/      # Hono middleware (auth, pagination, etc.)
│       │   ├── lib/             # Business logic & utilities
│       │   ├── db/seed/         # Database seed scripts
│       │   └── test/            # Integration & unit tests
│       └── vitest.config.ts
├── packages/
│   ├── auth/                    # Authentication & RBAC (@photon/auth)
│   │   └── src/rbac/           # Permission parser, checker, grants, roles
│   ├── core/                    # Env config, Redis, BullMQ (@photon/core)
│   ├── db/                      # Drizzle ORM schema & migrations (@photon/db)
│   │   ├── src/schema/          # All Drizzle schema definitions
│   │   └── drizzle/             # Generated migrations
│   ├── email/                   # React Email templates & mailer (@photon/email)
│   │   └── src/template/        # Email templates (.tsx)
│   ├── lepton-migration/        # One-shot migration tool from Lepton
│   └── tsconfig/                # Shared TypeScript configs
├── infra/
│   └── docker/                  # Docker Compose files & Dockerfile
├── turbo.json                   # Turborepo pipeline config
├── biome.json                   # Linting & formatting config
└── bun.lock
```

## Tech Stack

### Core
- **Hono v4** - Web framework
- **PostgreSQL 17** - Database
- **Drizzle ORM** - Type-safe database toolkit
- **Redis 7.4** - Cache and message queue
- **BullMQ** - Job queue
- **Better Auth** - Authentication
- **Zod v4** - Runtime validation
- **MinIO** - S3-compatible object storage

### Dev Tools
- **Bun 1.2** - Package manager & runtime
- **Turborepo** - Monorepo build orchestration
- **TypeScript 5.9** - Type system (strict mode)
- **Biome** - Linting and formatting
- **Vitest** - Testing with Testcontainers

## Common Commands

All commands run through Turbo via the root `package.json`. Use `bun run` (or just `bun`).

### Development
```bash
bun dev               # Start dev server (spins up Docker + db:push automatically)
bun run build         # Build for production
bun start             # Start production server
bun run typecheck     # Type check all packages
```

### Testing
```bash
bun run test              # Run all tests (requires Docker)
```

### Linting & Formatting
```bash
bun run lint          # Check code with Biome
bun run lint:fix      # Auto-fix issues
bun run format        # Format code
```

### Database (Drizzle ORM)
```bash
bun run db:push       # Push schema to DB (dev)
bun run db:generate   # Generate migrations
bun run db:migrate    # Run migrations
bun run db:studio     # Open Drizzle Studio
```

### Email Development
```bash
bun run email         # Start React Email preview (port 4001)
```

### Docker
```bash
bun run docker:dev       # Start dev environment (PostgreSQL, Redis, Mailpit, MinIO)
bun run docker:dev:down  # Stop dev environment
bun run docker:fresh     # Fresh start with clean volumes
bun run docker:prod      # Start production environment
bun run docker:prod:down # Stop production environment
```

## Turborepo Pipeline

Key dependency chain in `turbo.json`:
- `dev` depends on `@photon/docker#dev:up` then `@photon/db#db:push`
- `build` depends on upstream `^build`
- `db:push` depends on `@photon/docker#dev:up`
- `typecheck` depends on upstream `^typecheck`

## Git & GitHub Workflow

- Use **GitHub CLI (`gh`)** for all GitHub operations
- Do NOT push directly to main/master
- Create feature branches for all changes

### Commit Message Convention

- `feat: description` - New features
- `fix: description` - Bug fixes
- `refactor: description` - Code refactoring
- `chore: description` - Maintenance tasks
- `docs: description` - Documentation changes
- `test: description` - Test additions/changes
- `perf: description` - Performance improvements

### Pull Requests
- Use `gh pr create` to create pull requests
- Include descriptive title and body
- Reference related issues when applicable

## Code Style & Conventions

### General
- **Module System**: ESM only (`type: "module"`)
- **Formatting**: Biome — 4-space indent, double quotes, LF line endings
- **Imports**: Prefer named imports. Use `@photon/*` for cross-package imports, `~/` path alias within `apps/api`
- **File naming**: kebab-case for files, PascalCase for types/classes

### TypeScript
- Strict mode enabled across all packages
- Use explicit return types for public APIs
- Prefer `type` over `interface` for object shapes
- Use Zod schemas for runtime validation
- No `any` types

### API Development
- **Routes**: Use Hono router patterns in `apps/api/src/routes/`
- **Validation**: Zod schemas via `@hono/standard-validator`
- **OpenAPI**: Document routes using `hono-openapi`
- **Error handling**: Use appropriate HTTP status codes
- **Middleware**: Chain middleware using Hono patterns

### Database
- **ORM**: Drizzle exclusively
- **Schemas**: Define in `packages/db/src/schema/`
- **Migrations**: Generate with `bun run db:generate` (outputs to `packages/db/drizzle/`)
- **Config**: `packages/db/drizzle.config.ts`
- **Queries**: Use Drizzle query builder, avoid raw SQL unless necessary

### Testing
- **Framework**: Vitest (config in `apps/api/vitest.config.ts`)
- **Integration tests**: Use Testcontainers for PostgreSQL, Redis, MinIO
- **Test location**: `apps/api/src/test/`
- **Config**: `maxWorkers: 1` by default (configurable via `MAX_TEST_WORKERS` env)

### Authentication & Authorization
- **Auth**: Better Auth library (`packages/auth/src/index.ts`)
- **RBAC**: Permission system in `packages/auth/src/rbac/`
- **Middleware**: Use `requireAuth`, `requirePermission`, `requireOwnershipOrPermission`
- **Feide OAuth**: Configured for Norwegian education sector

## Architecture Patterns

### Database Queries

**IMPORTANT**: Always use the database instance from Hono context (`c.get('ctx').db`), NOT a direct import. This is required for the testing setup with Testcontainers.

```typescript
import { schema } from '@photon/db/schema'
import { eq } from 'drizzle-orm'

export default route().post('/', async (c) => {
  const { db } = c.get('ctx')

  const event = await db.query.event.findFirst({
    where: eq(schema.event.id, eventId),
  })

  const [newEvent] = await db.insert(schema.event).values({
    title: 'New Event',
  }).returning()

  await db.update(schema.event)
    .set({ title: 'Updated' })
    .where(eq(schema.event.id, eventId))
})
```

```typescript
// WRONG: Do NOT import db directly in routes
import { db } from '@photon/db'  // DON'T DO THIS
```

### Cross-Package Imports
```typescript
// Use workspace package names
import { schema } from '@photon/db/schema'
import { env } from '@photon/core/env'
import { auth } from '@photon/auth'

// Within apps/api, use path alias
import { someUtil } from '~/lib/utils'
```

## Environment Variables

All env vars are validated via Zod in `packages/core/src/env.ts`. See `.env.example` for required variables:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/photon_db
BETTER_AUTH_SECRET=<generate-random-secret>
BETTER_AUTH_URL=http://localhost:4000
FEIDE_CLIENT_ID=<feide-client-id>
FEIDE_CLIENT_SECRET=<feide-client-secret>
REDIS_URL=redis://localhost:6379
SMTP_HOST=localhost
SMTP_PORT=1025
```

## Important Notes

### Migration from Lepton
- This is a **port with improvements**, not a direct translation
- Use TypeScript best practices, not Python patterns

### Testing with Docker
- Testcontainers requires Docker to be running
- Tests automatically spin up PostgreSQL/Redis/MinIO containers

### Email Development
- Templates in `packages/email/src/template/`
- Preview at `http://localhost:4001` (run `bun run email`)
- In dev, emails are caught by Mailpit at `http://localhost:8025`

### API Documentation
When server is running:
- **API Base**: `http://localhost:4000/api`
- **OpenAPI Schema**: `http://localhost:4000/openapi`
- **Scalar Docs**: `http://localhost:4000/docs`

### Security
- Never commit secrets to git
- Use environment variables
- Validate all user input with Zod
- Use parameterized queries (Drizzle handles this)

## When Writing Code

1. **Use db from context** - Always use `c.get('ctx').db` in routes, NEVER import db directly
2. **Always run tests** before committing
3. **Follow Biome rules** - auto-format before committing
4. **Use Zod for validation** of all external input
5. **Prefer Drizzle ORM** over raw SQL
6. **Update OpenAPI docs** when changing routes
7. **Write meaningful tests** for new features
8. **Use TypeScript strictly** - no `any` types
9. **Follow existing patterns** in the codebase
10. **Create migrations** for schema changes (`bun run db:generate`)
11. **Use GitHub CLI (`gh`)** for GitHub operations

## Quick Start for Claude

1. Check `apps/api/src/routes/` to understand API structure
2. Check `packages/db/src/schema/` for database models
3. Check `packages/auth/src/rbac/` for permission system
4. Check `apps/api/src/lib/` for business logic and utilities
5. Run `bun run typecheck` before making changes
6. Run `bun test` to ensure nothing breaks
7. Use `bun run lint:fix` to auto-fix style issues
8. Use `gh` CLI for GitHub operations
9. Follow commit conventions: `feat:`, `fix:`, `refactor:`, etc.
10. Never push directly to main - create PRs instead
