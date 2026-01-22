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

This is a **flattened project** (migrated from Turborepo monorepo to a single package).

```
Photon/
├── src/
│   ├── db/                  # Database schemas and config
│   │   └── schema/          # Drizzle schema definitions
│   ├── lib/                 # Shared libraries
│   │   ├── auth/            # Authentication & RBAC
│   │   ├── cache/           # Redis & BullMQ queues
│   │   ├── email/           # Email templates & sending
│   │   ├── event/           # Event business logic
│   │   └── group/           # Group middleware
│   ├── routes/              # API route handlers
│   │   ├── event/           # Event endpoints
│   │   ├── email/           # Email endpoints
│   │   └── groups/          # Group & fines endpoints
│   ├── middleware/          # Hono middleware
│   └── test/                # Test utilities & tests
├── drizzle/                 # Database migrations
└── docker-compose.*.yml     # Docker configs
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

### Dev Tools
- **TypeScript 5.9** - Type system
- **Biome** - Linting and formatting
- **Vitest** - Testing with Testcontainers
- **tsup** - Bundler (esbuild-based)
- **pnpm 8.15.6** - Package manager
- **tsx** - TypeScript execution

## Common Commands

### Development
```bash
pnpm dev              # Start dev server with watch mode
pnpm build            # Build for production
pnpm start            # Start production server
pnpm typecheck        # Type check
```

### Testing
```bash
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode
pnpm coverage         # Generate coverage report
```

### Linting & Formatting
```bash
pnpm lint             # Check code with Biome
pnpm lint:fix         # Auto-fix issues
pnpm format           # Format code
```

### Database (Drizzle ORM)
```bash
pnpm db:push          # Push schema to DB (dev)
pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Drizzle Studio
pnpm db:check         # Check migration status
pnpm db:drop          # Drop migration
```

### Email Development
```bash
pnpm email            # Start React Email preview (port 4001)
```

### Docker
```bash
pnpm docker:dev       # Start dev environment (PostgreSQL, Redis, Mailpit)
pnpm docker:dev:down  # Stop dev environment
pnpm docker:fresh     # Fresh start with clean volumes
pnpm docker:prod      # Start production environment
pnpm docker:prod:down # Stop production environment
```

## Git & GitHub Workflow

### Git Integration
- Use **GitHub CLI (`gh`)** for all GitHub operations
- Do NOT push directly to main/master
- Create feature branches for all changes

### Commit Message Convention

Follow the established commit style:

- `feat: description` - New features
- `fix: description` - Bug fixes
- `refactor: description` - Code refactoring
- `chore: description` - Maintenance tasks
- `docs: description` - Documentation changes
- `test: description` - Test additions/changes
- `perf: description` - Performance improvements
- `style: description` - Code style changes (formatting, etc.)

**Examples from this repo:**
- `feat: email endpoint (#63)`
- `fix: authentication bug in middleware`
- `refactor: email templates to use shared styles`
- `chore: bump hono from 4.10.2 to 4.10.3`

### Pull Requests
- Use `gh pr create` to create pull requests
- Include descriptive title and body
- Reference related issues when applicable

## Code Style & Conventions

### General
- **Module System**: ESM only (`type: "module"`)
- **Formatting**: Biome (configured in `biome.json`)
- **Imports**: Prefer named imports
- **File naming**: kebab-case for files, PascalCase for types/classes

### TypeScript
- Enable strict mode (already configured)
- Use explicit return types for public APIs
- Prefer `type` over `interface` for object shapes
- Use Zod schemas for runtime validation

### API Development
- **Routes**: Use Hono router patterns
- **Validation**: Zod schemas via `@hono/standard-validator`
- **OpenAPI**: Document routes using `hono-openapi`
- **Error handling**: Use appropriate HTTP status codes
- **Middleware**: Chain middleware using Hono patterns

### Database
- **ORM**: Drizzle exclusively
- **Schemas**: Define in `src/db/schema/`
- **Migrations**: Generate with `pnpm db:generate`
- **Queries**: Use Drizzle query builder, avoid raw SQL unless necessary

### Testing
- **Framework**: Vitest
- **Integration tests**: Use Testcontainers for PostgreSQL/Redis
- **Test location**: Co-locate with feature or in `src/test/`
- **Coverage**: Aim for meaningful coverage, not 100%

### Authentication & Authorization
- **Auth**: Better Auth library (`src/lib/auth/index.ts`)
- **RBAC**: Defined in `src/lib/auth/rbac/`
- **Middleware**: Use `requireAuth`, `requirePermission`, `requireOwnershipOrPermission`
- **Feide OAuth**: Configured for Norwegian education sector

## Environment Variables

Required variables (see `.env.example`):

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/photon_db

# Auth (Better Auth)
BETTER_AUTH_SECRET=<generate-random-secret>
BETTER_AUTH_URL=http://localhost:4000

# Feide OAuth (optional for dev)
FEIDE_CLIENT_ID=<feide-client-id>
FEIDE_CLIENT_SECRET=<feide-client-secret>

# Redis
REDIS_URL=redis://localhost:6379

# Email
SMTP_HOST=localhost
SMTP_PORT=1025

# Vipps (optional for dev)
VIPPS_SUBSCRIPTION_KEY=<subscription-key>
VIPPS_CLIENT_ID=<client-id>
VIPPS_CLIENT_SECRET=<client-secret>
VIPPS_MERCHANT_SERIAL_NUMBER=<msn>
VIPPS_TEST_MODE=true
```

## Architecture Patterns

### Route Structure
```typescript
// src/routes/feature/index.ts
import { Hono } from 'hono'
import { createRoute } from '@/lib/route'

const app = new Hono()
  .route('/create', createRoute)
  .route('/list', listRoute)

export default app
```

### Middleware Usage
```typescript
import { authMiddleware } from '@/middleware/auth'
import { requirePermission } from '@/middleware/permission'

app.post(
  '/create',
  authMiddleware,
  requirePermission('event.create'),
  async (c) => {
    // Handler
  }
)
```

### Zod Validation
```typescript
import { zValidator } from '@hono/standard-validator'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

app.post('/endpoint', zValidator('json', schema), async (c) => {
  const data = c.req.valid('json')
  // data is fully typed
})
```

### Database Queries

**IMPORTANT**: Always use the database instance from Hono context (`c.get('ctx').db`), NOT the direct import. This is required for the testing setup with Testcontainers.

```typescript
import { schema } from '@/db/schema'
import { eq } from 'drizzle-orm'

export default route().post('/', async (c) => {
  // ✅ CORRECT: Get db from context
  const { db } = c.get('ctx')

  // Select
  const event = await db.query.event.findFirst({
    where: eq(schema.event.id, eventId),
  })

  // Insert
  const [newEvent] = await db.insert(schema.event).values({
    title: 'New Event',
    // ...
  }).returning()

  // Update
  await db.update(schema.event)
    .set({ title: 'Updated' })
    .where(eq(schema.event.id, eventId))
})
```

```typescript
// ❌ WRONG: Do NOT import db directly in routes
import { db } from '@/db'  // DON'T DO THIS

// ❌ WRONG: Do NOT use direct db import
const event = await db.query.event.findFirst(...)  // DON'T DO THIS
```

### Background Jobs
```typescript
import { emailQueue } from '@/lib/cache/queue'

// Enqueue job
await emailQueue.add('send-welcome-email', {
  to: 'user@example.com',
  userId: 123,
})

// Jobs are processed by worker in src/lib/email/worker.ts
```

## Important Notes

### Migration from Lepton
- This is a **port with improvements**, not a direct translation
- Endpoints may differ from Lepton
- Business logic is being refactored and improved
- Use TypeScript best practices, not Python patterns

### Testing with Docker
- Testcontainers requires Docker to be running
- Tests automatically spin up PostgreSQL/Redis containers
- Adjust `maxWorkers` in `vitest.config.ts` for parallel tests

### Email Development
- Templates in `src/lib/email/template/`
- Use React Email components
- Preview at `http://localhost:4001` (run `pnpm email`)
- In dev, emails are caught by Mailpit at `http://localhost:8025`

### API Documentation
When server is running:
- **API Base**: `http://localhost:4000/api`
- **OpenAPI Schema**: `http://localhost:4000/openapi`
- **Scalar Docs**: `http://localhost:4000/docs`

### Security
- Never commit secrets to git
- Use environment variables
- Follow OWASP guidelines
- Validate all user input with Zod
- Use parameterized queries (Drizzle handles this)

## Helpful Resources

- **Hono Docs**: https://hono.dev
- **Drizzle ORM**: https://orm.drizzle.team
- **Better Auth**: https://better-auth.com
- **Zod**: https://zod.dev
- **React Email**: https://react.email
- **Vipps MobilePay**: https://developer.vippsmobilepay.com

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
10. **Create migrations** for schema changes (`pnpm db:generate`)
11. **Use GitHub CLI (`gh`)** for GitHub operations

## Quick Start for Claude

1. Check `src/routes/` to understand API structure
2. Check `src/db/schema/` for database models
3. Check `src/lib/` for business logic and utilities
4. Run `pnpm typecheck` before making changes
5. Run `pnpm test` to ensure nothing breaks
6. Use `pnpm db:studio` to explore database
7. Use `pnpm lint:fix` to auto-fix style issues
8. Use `gh` CLI for GitHub operations
9. Follow commit conventions: `feat:`, `fix:`, `refactor:`, etc.
10. Never push directly to main - create PRs instead
