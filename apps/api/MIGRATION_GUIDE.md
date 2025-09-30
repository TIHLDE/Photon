# Dependency Injection Migration Guide

This guide explains how to migrate existing code to use the new dependency injection pattern.

## Overview

The codebase has been refactored to use dependency injection (DI) through an `AppContext` pattern. This allows:

- **Testability**: Inject test database/Redis instances
- **Isolation**: No global state pollution
- **Flexibility**: Easy to swap implementations (mocks, test containers, etc.)
- **Parallel Testing**: Tests can run safely in parallel

## Architecture Changes

### Before (Global Singletons)
```ts
// Old way - global imports
import db from "~/db";
import { getRedis } from "~/lib/cache/redis";
import { getQueue } from "~/lib/cache/bull";

// Direct usage in routes
export const route = new Hono().get("/", async (c) => {
  const users = await db.select().from(schema.user);
  const redis = await getRedis();
  return c.json(users);
});
```

### After (Dependency Injection)
```ts
// New way - context injection
import { route } from "~/lib/route";

export const route = route().get("/", async (c) => {
  const { db, redis, queueManager } = c.get("services");
  const users = await db.select().from(schema.user);
  return c.json(users);
});
```

## Migration Steps

### 1. Update Route Handlers

**Before:**
```ts
import db from "~/db";

export const myRoute = new Hono().get("/", async (c) => {
  const data = await db.select().from(schema.table);
  return c.json(data);
});
```

**After:**
```ts
import type { AppContext } from "~/lib/context";

type Variables = {
  services: AppContext;
};

export const myRoute = new Hono<{ Variables: Variables }>().get("/", async (c) => {
  const { db } = c.get("services");
  const data = await db.select().from(schema.table);
  return c.json(data);
});
```

### 2. Update Functions that Use DB/Redis

**Before:**
```ts
import db from "~/db";
import { getRedis } from "~/lib/cache/redis";

export async function getUserRoles(userId: string) {
  const redis = await getRedis();
  const cached = await redis.get(`user:${userId}:roles`);
  if (cached) return JSON.parse(cached);

  const roles = await db.select().from(schema.userRole)
    .where(eq(schema.userRole.userId, userId));

  await redis.set(`user:${userId}:roles`, JSON.stringify(roles));
  return roles;
}
```

**After:**
```ts
import type { AppContext } from "~/lib/context";

export async function getUserRoles(
  ctx: AppContext,
  userId: string
) {
  const { db, redis } = ctx;
  const cached = await redis.get(`user:${userId}:roles`);
  if (cached) return JSON.parse(cached);

  const roles = await db.select().from(schema.userRole)
    .where(eq(schema.userRole.userId, userId));

  await redis.set(`user:${userId}:roles`, JSON.stringify(roles));
  return roles;
}
```

### 3. Update Middleware

**Before:**
```ts
import db from "~/db";

export const myMiddleware = async (c, next) => {
  const user = await db.select().from(schema.user);
  c.set("user", user);
  await next();
};
```

**After:**
```ts
import type { AppContext } from "~/lib/context";

export const myMiddleware = async (c, next) => {
  const { db } = c.get("services");
  const user = await db.select().from(schema.user);
  c.set("user", user);
  await next();
};
```

### 4. Update RBAC Calls

**Before:**
```ts
import { userHasPermission } from "~/lib/auth/rbac";

// In route
const hasAccess = await userHasPermission(userId, "events:create");
```

**After:**
```ts
import { userHasPermissionName } from "~/lib/auth/rbac";

// In route
const ctx = c.get("services");
const hasAccess = await userHasPermissionName(ctx, userId, "events:create");
```

### 5. Update Queue Usage

**Before:**
```ts
import { getQueue, enqueue } from "~/lib/cache/bull";

const queue = getQueue("emails");
await enqueue("emails", { to: "user@example.com", subject: "Hi" });
```

**After:**
```ts
// In route with context
const { queueManager } = c.get("services");
const queue = queueManager.getQueue("emails");
await queue.add({ to: "user@example.com", subject: "Hi" });

// Or use the helper
await queueManager.enqueue("emails", { to: "user@example.com", subject: "Hi" });
```

## Testing

### Writing Tests with DI

```ts
import { describe, it, beforeAll, afterAll } from "vitest";
import { setupTestContext, cleanupTestContext, getTestContext } from "~/test/setup";

describe("My Feature", () => {
  beforeAll(async () => {
    await setupTestContext();
  });

  afterAll(async () => {
    await cleanupTestContext();
  });

  it("should work", async () => {
    const ctx = getTestContext();

    // Use test instances
    const users = await ctx.db.select().from(schema.user);
    await ctx.redis.set("key", "value");

    // Test your code
  });
});
```

### Using Test Containers

```ts
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";

beforeAll(async () => {
  const pgContainer = await new PostgreSqlContainer().start();
  const redisContainer = await new RedisContainer().start();

  await setupTestContext({
    db: createDb(pgContainer.getConnectionUrl()),
    redis: await createRedisClient(redisContainer.getConnectionUrl()),
  });
});
```

## Backward Compatibility

The old singleton patterns still work! They're marked as deprecated but won't break existing code:

```ts
// Still works (but deprecated)
import db from "~/db";
import { getRedis } from "~/lib/cache/redis";

// Migrate to new pattern when convenient
```

## Files to Update

Search for these patterns and update gradually:

1. **Direct db imports**: `import db from "~/db"`
2. **Direct redis calls**: `import { getRedis } from`
3. **RBAC calls**: All functions now need `ctx` as first parameter
4. **Queue usage**: `getQueue()` → `queueManager.getQueue()`

## Benefits Summary

✅ **Testable**: Inject mock or test container instances
✅ **Isolated**: No shared state between tests
✅ **Parallel**: Tests can run concurrently
✅ **Flexible**: Easy to swap implementations
✅ **Type-safe**: Full TypeScript support
✅ **Gradual**: Migrate at your own pace
