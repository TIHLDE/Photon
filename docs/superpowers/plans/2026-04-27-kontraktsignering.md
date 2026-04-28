# Kontraktsignering (Contract Signing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single global volunteer contract lives in MinIO (uploaded by super-admin via `/admin/opptak`). Group leaders toggle contract requirements per group in `/admin/grupper`, set a notification email, and view who has/hasn't signed. Members see a prompt in their profile membership tab, open the contract PDF on `/kontrakt`, scroll to the bottom to unlock the sign button, click Sign → email fires to each requiring-group's notification address.

**Architecture:** Two new DB tables (`org_contract`, `org_contract_signature`) plus two new columns on `org_group` (`contract_signing_required`, `contract_notification_email`). A `contracts` permission domain is added to the RBAC registry. A new `apps/api/src/routes/contracts/` folder handles all API endpoints. The frontend adds a `contracts.ts` query file, a `/kontrakt` signing route, a wired membership tab in `profil.me.tsx`, and implements `admin/opptak.tsx` + `admin/grupper.tsx`.

**Tech Stack:** Drizzle ORM (Postgres), Hono v4, MinIO (existing `bucket` ctx), BullMQ + React Email (`enqueueEmail`), TanStack Start + Router + Query v5, `@tihlde/ui`, TypeScript strict

---

## File Structure

### New Files

| Path                                                | Purpose                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/api/src/routes/contracts/schema.ts`           | Zod input/output schemas                                         |
| `apps/api/src/routes/contracts/get-active.ts`       | `GET /api/contracts/active`                                      |
| `apps/api/src/routes/contracts/my-signature.ts`     | `GET /api/contracts/my-signature`                                |
| `apps/api/src/routes/contracts/sign.ts`             | `POST /api/contracts/sign`                                       |
| `apps/api/src/routes/contracts/list.ts`             | `GET /api/contracts` (admin)                                     |
| `apps/api/src/routes/contracts/create.ts`           | `POST /api/contracts` (admin)                                    |
| `apps/api/src/routes/contracts/activate.ts`         | `PATCH /api/contracts/:id/activate` (admin)                      |
| `apps/api/src/routes/contracts/group-signatures.ts` | `GET /api/contracts/groups/:slug/signatures` (leader)            |
| `apps/api/src/routes/contracts/revoke-signature.ts` | `DELETE /api/contracts/groups/:slug/signatures/:userId` (leader) |
| `apps/api/src/routes/contracts/index.ts`            | Router composition                                               |
| `packages/email/src/template/contract-signed.tsx`   | Email to group leaders after member signs                        |
| `apps/kvark/src/api/queries/contracts.ts`           | TanStack Query options + mutation options                        |
| `apps/kvark/src/routes/_app/kontrakt.tsx`           | Contract signing page                                            |

### Modified Files

| Path                                             | Change                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `packages/db/src/schema/org.ts`                  | Add `contract`, `contractSignature` tables; add 2 columns to `group` |
| `packages/auth/src/rbac/permissions/registry.ts` | Add `contracts` domain                                               |
| `apps/api/src/routes/groups/schema.ts`           | Add contract fields to `updateGroupSchema` + `groupSchema`           |
| `apps/api/src/app.ts`                            | Register `contractsRoutes`                                           |
| `packages/email/src/template/index.ts`           | Export `ContractSignedEmail`                                         |
| `apps/kvark/src/routes/_app/profil.me.tsx`       | Wire membership tab with contract status                             |
| `apps/kvark/src/routes/admin/opptak.tsx`         | Contract document management (was stub)                              |
| `apps/kvark/src/routes/admin/grupper.tsx`        | Group contract toggle + member signing status (was stub)             |

---

## Phase 1: Backend

### Task 1: DB Schema — New tables + group columns

**Files:**

- Modify: `packages/db/src/schema/org.ts`

- [ ] **Step 1: Add `uniqueIndex` to the pg-core import**

In `packages/db/src/schema/org.ts`, line 2–14, add `uniqueIndex` to the import list:

```typescript
import {
    boolean,
    integer,
    pgTableCreator,
    primaryKey,
    serial,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Add two columns to the `group` table**

Inside the `group` pgTable definition (after `finesAdminId`), add:

```typescript
    contractSigningRequired: boolean("contract_signing_required")
        .notNull()
        .default(false),
    contractNotificationEmail: varchar("contract_notification_email", {
        length: 200,
    }),
```

- [ ] **Step 3: Add `contract` and `contractSignature` tables**

After the `fine` table definition, append:

```typescript
export const contract = pgTable("contract", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 256 }).notNull(),
    fileKey: varchar("file_key", { length: 600 }).notNull(),
    version: varchar("version", { length: 64 }).notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdByUserId: varchar("created_by_user_id", { length: 255 }).references(
        () => user.id,
        { onDelete: "set null" },
    ),
    ...timestamps,
});

export const contractSignature = pgTable(
    "contract_signature",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        contractId: uuid("contract_id")
            .notNull()
            .references(() => contract.id, { onDelete: "cascade" }),
        userId: varchar("user_id", { length: 255 })
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        signedAt: timestamp("signed_at").defaultNow().notNull(),
        ...timestamps,
    },
    (t) => [
        uniqueIndex("contract_signature_unique_idx").on(t.contractId, t.userId),
    ],
);
```

- [ ] **Step 4: Add `user` relation to `groupMembershipRelations`**

The `sign.ts` route will query `groupMembership` with `with: { group: true, user: true }`. Verify `groupMembershipRelations` in `org.ts` already has both relations. If the `user` relation is missing, add it:

```typescript
export const groupMembershipRelations = relations(
    groupMembership,
    ({ one }) => ({
        user: one(user, {
            fields: [groupMembership.userId],
            references: [user.id],
        }),
        group: one(group, {
            fields: [groupMembership.groupSlug],
            references: [group.slug],
        }),
    }),
);
```

- [ ] **Step 5: Typecheck**

```bash
bun run typecheck
```

Expected: PASS

---

### Task 2: RBAC — Add `contracts` permission domain

**Files:**

- Modify: `packages/auth/src/rbac/permissions/registry.ts`

- [ ] **Step 1: Add `contracts` entry to `PERMISSION_REGISTRY`**

After the `fines` entry (around line 54), insert:

```typescript
    contracts: {
        actions: ["view", "create", "update", "delete", "manage"],
    },
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
```

Expected: PASS

---

### Task 3: DB Migration

- [ ] **Step 1: Generate migration**

```bash
bun run db:generate
```

Expected: New `.sql` migration file created in `packages/db/drizzle/`

- [ ] **Step 2: Apply migration**

```bash
bun run db:push
```

Expected: Postgres schema updated (new tables + columns visible in Drizzle Studio)

---

### Task 4: Contract Zod schemas

**Files:**

- Create: `apps/api/src/routes/contracts/schema.ts`

- [ ] **Step 1: Write the schema file**

```typescript
import z from "zod";
import { Schema } from "~/lib/openapi";

// ===== INPUT SCHEMAS =====

export const createContractSchema = Schema(
    "CreateContract",
    z.object({
        title: z
            .string()
            .min(1)
            .max(256)
            .meta({ description: "Contract title" }),
        version: z
            .string()
            .min(1)
            .max(64)
            .meta({ description: "Version identifier e.g. '2026-01'" }),
        fileKey: z
            .string()
            .min(1)
            .max(600)
            .meta({ description: "MinIO asset key from POST /api/assets" }),
    }),
);

// ===== RESPONSE SCHEMAS =====

export const contractSchema = Schema(
    "Contract",
    z.object({
        id: z.uuid(),
        title: z.string(),
        version: z.string(),
        fileKey: z.string(),
        isActive: z.boolean(),
        createdAt: z.string(),
        updatedAt: z.string(),
    }),
);

export const contractListSchema = Schema(
    "ContractList",
    z.array(contractSchema),
);

export const activeContractSchema = Schema(
    "ActiveContract",
    contractSchema.extend({
        downloadUrl: z
            .string()
            .meta({ description: "Direct URL to stream the PDF" }),
    }),
);

export const signatureStatusSchema = Schema(
    "SignatureStatus",
    z.object({
        hasSigned: z.boolean(),
        signedAt: z.string().nullable(),
    }),
);

export const groupSignatureMemberSchema = Schema(
    "GroupSignatureMember",
    z.object({
        userId: z.string(),
        hasSigned: z.boolean(),
        signedAt: z.string().nullable(),
    }),
);

export const groupSignatureListSchema = Schema(
    "GroupSignatureList",
    z.object({
        members: z.array(groupSignatureMemberSchema),
        totalMembers: z.number(),
        signedCount: z.number(),
    }),
);

export const activateContractResponseSchema = Schema(
    "ActivateContractResponse",
    z.object({ message: z.string() }),
);

export const signContractResponseSchema = Schema(
    "SignContractResponse",
    z.object({ message: z.string(), signedAt: z.string() }),
);

export const revokeSignatureResponseSchema = Schema(
    "RevokeSignatureResponse",
    z.object({ message: z.string() }),
);
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
```

Expected: PASS

---

### Task 5: Email template — ContractSignedEmail

**Files:**

- Create: `packages/email/src/template/contract-signed.tsx`
- Modify: `packages/email/src/template/index.ts`

- [ ] **Step 1: Create the template**

```tsx
import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Text,
} from "@react-email/components";
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import React from "react";
import { env } from "@photon/core/env";
import { emailStyles } from "./styles";

interface ContractSignedEmailProps {
    memberName: string;
    groupName: string;
    signedAt: string;
}

export const ContractSignedEmail = ({
    memberName = "Ola Nordmann",
    groupName = "Index",
    signedAt = new Date().toISOString(),
}: ContractSignedEmailProps) => {
    const formattedDate = new Date(signedAt).toLocaleDateString("nb-NO", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return (
        <Html>
            <Head />
            <Body style={emailStyles.main}>
                <Container style={emailStyles.container}>
                    <Img
                        src={`${env.ROOT_URL}/static/logomark.jpeg`}
                        width="100"
                        height="100"
                        alt="TIHLDE Logomark"
                        style={emailStyles.logo}
                    />
                    <Heading style={emailStyles.heading}>
                        Frivillighetskontrakt signert
                    </Heading>
                    <Text style={emailStyles.paragraph}>
                        <strong>{memberName}</strong> har signert
                        frivillighetskontrakten for <strong>{groupName}</strong>
                        .
                    </Text>
                    <Text style={emailStyles.paragraph}>
                        Dato: {formattedDate}
                    </Text>
                    <Text style={emailStyles.paragraph}>
                        Du mottar denne e-posten fordi du er registrert som
                        varslingskontakt for {groupName}.
                    </Text>
                </Container>
                <Text style={emailStyles.footer}>Levert av INDEX</Text>
            </Body>
        </Html>
    );
};

export default ContractSignedEmail;
```

- [ ] **Step 2: Export from template index**

In `packages/email/src/template/index.ts`, add at the end:

```typescript
export { ContractSignedEmail } from "./contract-signed";
```

- [ ] **Step 3: Typecheck**

```bash
bun run typecheck
```

Expected: PASS

---

### Task 6: GET /api/contracts/active

**Files:**

- Create: `apps/api/src/routes/contracts/get-active.ts`

- [ ] **Step 1: Write the route**

```typescript
import { schema } from "@photon/db";
import { env } from "@photon/core/env";
import { eq } from "drizzle-orm";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { activeContractSchema } from "./schema";

export const getActiveContractRoute = route().get(
    "/active",
    describeRoute({
        tags: ["contracts"],
        summary: "Get active contract",
        operationId: "getActiveContract",
        description:
            "Returns the currently active volunteer contract with a direct download URL for the PDF.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: activeContractSchema,
            description: "Active contract",
        })
        .notFound({ description: "No active contract" })
        .unauthorized()
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");

        const activeContract = await db.query.contract.findFirst({
            where: eq(schema.contract.isActive, true),
        });

        if (!activeContract) {
            throw HTTPAppException.NotFound("Contract");
        }

        const downloadUrl = `${env.ROOT_URL}/api/assets/${activeContract.fileKey}`;

        return c.json(
            {
                ...activeContract,
                createdAt: activeContract.createdAt.toISOString(),
                updatedAt: activeContract.updatedAt.toISOString(),
                downloadUrl,
            },
            200,
        );
    },
);
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
```

Expected: PASS

---

### Task 7: GET /api/contracts/my-signature

**Files:**

- Create: `apps/api/src/routes/contracts/my-signature.ts`

- [ ] **Step 1: Write the route**

```typescript
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { signatureStatusSchema } from "./schema";

export const mySignatureRoute = route().get(
    "/my-signature",
    describeRoute({
        tags: ["contracts"],
        summary: "Get my signature status",
        operationId: "getMySignatureStatus",
        description:
            "Returns whether the authenticated user has signed the currently active contract.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: signatureStatusSchema,
            description: "Signature status",
        })
        .unauthorized()
        .build(),
    requireAuth,
    async (c) => {
        const user = c.get("user");
        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const { db } = c.get("ctx");

        const activeContract = await db.query.contract.findFirst({
            where: eq(schema.contract.isActive, true),
        });

        if (!activeContract) {
            return c.json({ hasSigned: false, signedAt: null }, 200);
        }

        const signature = await db.query.contractSignature.findFirst({
            where: and(
                eq(schema.contractSignature.contractId, activeContract.id),
                eq(schema.contractSignature.userId, user.id),
            ),
        });

        return c.json(
            {
                hasSigned: !!signature,
                signedAt: signature?.signedAt?.toISOString() ?? null,
            },
            200,
        );
    },
);
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
```

Expected: PASS

---

### Task 8: POST /api/contracts/sign

**Files:**

- Create: `apps/api/src/routes/contracts/sign.ts`

- [ ] **Step 1: Write the route**

```typescript
import { schema } from "@photon/db";
import { enqueueEmail } from "@photon/email";
import { ContractSignedEmail } from "@photon/email/templates";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { signContractResponseSchema } from "./schema";

export const signContractRoute = route().post(
    "/sign",
    describeRoute({
        tags: ["contracts"],
        summary: "Sign the active contract",
        operationId: "signContract",
        description:
            "Signs the active volunteer contract for the authenticated user. Sends email to notification contacts of all groups the user belongs to that require contract signing.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: signContractResponseSchema,
            description: "Contract signed",
        })
        .response({ statusCode: 409, description: "Already signed" })
        .notFound({ description: "No active contract" })
        .unauthorized()
        .build(),
    requireAuth,
    async (c) => {
        const user = c.get("user");
        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const { db, queue } = c.get("ctx");

        const activeContract = await db.query.contract.findFirst({
            where: eq(schema.contract.isActive, true),
        });

        if (!activeContract) {
            throw new HTTPException(404, {
                message: "No active contract found",
            });
        }

        const existing = await db.query.contractSignature.findFirst({
            where: and(
                eq(schema.contractSignature.contractId, activeContract.id),
                eq(schema.contractSignature.userId, user.id),
            ),
        });

        if (existing) {
            throw new HTTPException(409, {
                message: "Contract already signed",
            });
        }

        const [signature] = await db
            .insert(schema.contractSignature)
            .values({
                contractId: activeContract.id,
                userId: user.id,
            })
            .returning();

        // Notify group leaders for all groups the user belongs to that require contract signing
        const memberships = await db.query.groupMembership.findMany({
            where: eq(schema.groupMembership.userId, user.id),
            with: { group: true },
        });

        for (const membership of memberships) {
            const grp = membership.group;
            if (!grp.contractSigningRequired) continue;

            // Resolve notification email: configured → group contact → leader's email
            let notifyEmail: string | null =
                grp.contractNotificationEmail ?? grp.contactEmail ?? null;

            if (!notifyEmail) {
                const leader = await db.query.groupMembership.findFirst({
                    where: and(
                        eq(schema.groupMembership.groupSlug, grp.slug),
                        eq(schema.groupMembership.role, "leader"),
                    ),
                    with: { user: true },
                });
                notifyEmail = leader?.user.email ?? null;
            }

            if (notifyEmail) {
                await enqueueEmail(
                    {
                        to: notifyEmail,
                        subject: `${user.name} har signert frivillighetskontrakten`,
                        component: ContractSignedEmail({
                            memberName: user.name,
                            groupName: grp.name,
                            signedAt: signature.signedAt.toISOString(),
                        }),
                    },
                    { queue },
                );
            }
        }

        return c.json(
            {
                message: "Contract signed successfully",
                signedAt: signature.signedAt.toISOString(),
            },
            201,
        );
    },
);
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
```

Expected: PASS (if `groupMembershipRelations` has `user` and `group` relations — verified in Task 1 Step 4)

---

### Task 9: Admin contract routes — list, create, activate

**Files:**

- Create: `apps/api/src/routes/contracts/list.ts`
- Create: `apps/api/src/routes/contracts/create.ts`
- Create: `apps/api/src/routes/contracts/activate.ts`

- [ ] **Step 1: Write `list.ts`**

```typescript
import { schema } from "@photon/db";
import { desc } from "drizzle-orm";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { contractListSchema } from "./schema";

export const listContractsRoute = route().get(
    "/",
    describeRoute({
        tags: ["contracts"],
        summary: "List all contract versions",
        operationId: "listContracts",
        description:
            "Returns all contract versions newest first. Requires 'contracts:view' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: contractListSchema,
            description: "List of contracts",
        })
        .unauthorized()
        .forbidden()
        .build(),
    requireAuth,
    requireAccess({ permission: "contracts:view" }),
    async (c) => {
        const { db } = c.get("ctx");

        const contracts = await db
            .select()
            .from(schema.contract)
            .orderBy(desc(schema.contract.createdAt));

        return c.json(
            contracts.map((contract) => ({
                ...contract,
                createdAt: contract.createdAt.toISOString(),
                updatedAt: contract.updatedAt.toISOString(),
            })),
            200,
        );
    },
);
```

- [ ] **Step 2: Write `create.ts`**

```typescript
import { schema } from "@photon/db";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { contractSchema, createContractSchema } from "./schema";

export const createContractRoute = route().post(
    "/",
    describeRoute({
        tags: ["contracts"],
        summary: "Create a new contract version",
        operationId: "createContract",
        description:
            "Registers a new contract version. Does not auto-activate. Upload the PDF via POST /api/assets first, then pass the returned fileKey here. Requires 'contracts:create' permission.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: contractSchema,
            description: "Contract created",
        })
        .badRequest()
        .unauthorized()
        .forbidden()
        .build(),
    requireAuth,
    requireAccess({ permission: "contracts:create" }),
    validator("json", createContractSchema),
    async (c) => {
        const body = c.req.valid("json");
        const user = c.get("user");
        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const { db } = c.get("ctx");

        const [newContract] = await db
            .insert(schema.contract)
            .values({
                ...body,
                createdByUserId: user.id,
            })
            .returning();

        return c.json(
            {
                ...newContract,
                createdAt: newContract.createdAt.toISOString(),
                updatedAt: newContract.updatedAt.toISOString(),
            },
            201,
        );
    },
);
```

- [ ] **Step 3: Write `activate.ts`**

```typescript
import { schema } from "@photon/db";
import { eq, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { activateContractResponseSchema } from "./schema";

export const activateContractRoute = route().patch(
    "/:id/activate",
    describeRoute({
        tags: ["contracts"],
        summary: "Activate a contract version",
        operationId: "activateContract",
        description:
            "Sets the specified contract as active; deactivates all others. Requires 'contracts:update' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: activateContractResponseSchema,
            description: "Contract activated",
        })
        .notFound({ description: "Contract not found" })
        .unauthorized()
        .forbidden()
        .build(),
    requireAuth,
    requireAccess({ permission: "contracts:update" }),
    async (c) => {
        const id = c.req.param("id");
        const { db } = c.get("ctx");

        const existing = await db.query.contract.findFirst({
            where: eq(schema.contract.id, id),
        });

        if (!existing) {
            throw new HTTPException(404, { message: "Contract not found" });
        }

        await db
            .update(schema.contract)
            .set({ isActive: false, updatedAt: new Date() })
            .where(ne(schema.contract.id, id));

        await db
            .update(schema.contract)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(schema.contract.id, id));

        return c.json({ message: "Contract activated" }, 200);
    },
);
```

- [ ] **Step 4: Typecheck**

```bash
bun run typecheck
```

Expected: PASS

---

### Task 10: Group signature routes — list + revoke

**Files:**

- Create: `apps/api/src/routes/contracts/group-signatures.ts`
- Create: `apps/api/src/routes/contracts/revoke-signature.ts`

- [ ] **Step 1: Write `group-signatures.ts`**

```typescript
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { isGroupLeader } from "~/lib/group/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { groupSignatureListSchema } from "./schema";

export const groupSignaturesRoute = route().get(
    "/groups/:groupSlug/signatures",
    describeRoute({
        tags: ["contracts"],
        summary: "Get member signing status for a group",
        operationId: "getGroupContractSignatures",
        description:
            "Returns all group members with their signing status for the active contract. Requires being a group leader or 'contracts:view' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: groupSignatureListSchema,
            description: "Member signing status",
        })
        .notFound({ description: "Group not found" })
        .forbidden()
        .unauthorized()
        .build(),
    requireAuth,
    requireAccess({
        permission: "contracts:view",
        scope: (c) => `group:${c.req.param("groupSlug")}`,
        ownership: { param: "groupSlug", check: isGroupLeader },
    }),
    async (c) => {
        const groupSlug = c.req.param("groupSlug");
        const { db } = c.get("ctx");

        const grp = await db.query.group.findFirst({
            where: eq(schema.group.slug, groupSlug),
        });

        if (!grp) {
            throw new HTTPException(404, { message: "Group not found" });
        }

        const activeContract = await db.query.contract.findFirst({
            where: eq(schema.contract.isActive, true),
        });

        const memberships = await db.query.groupMembership.findMany({
            where: eq(schema.groupMembership.groupSlug, groupSlug),
        });

        const results = await Promise.all(
            memberships.map(async (m) => {
                if (!activeContract) {
                    return {
                        userId: m.userId,
                        hasSigned: false,
                        signedAt: null,
                    };
                }

                const sig = await db.query.contractSignature.findFirst({
                    where: and(
                        eq(
                            schema.contractSignature.contractId,
                            activeContract.id,
                        ),
                        eq(schema.contractSignature.userId, m.userId),
                    ),
                });

                return {
                    userId: m.userId,
                    hasSigned: !!sig,
                    signedAt: sig?.signedAt?.toISOString() ?? null,
                };
            }),
        );

        return c.json(
            {
                members: results,
                totalMembers: results.length,
                signedCount: results.filter((r) => r.hasSigned).length,
            },
            200,
        );
    },
);
```

- [ ] **Step 2: Write `revoke-signature.ts`**

```typescript
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { isGroupLeader } from "~/lib/group/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { revokeSignatureResponseSchema } from "./schema";

export const revokeSignatureRoute = route().delete(
    "/groups/:groupSlug/signatures/:userId",
    describeRoute({
        tags: ["contracts"],
        summary: "Revoke a member's contract signature",
        operationId: "revokeContractSignature",
        description:
            "Removes a member's signature from the active contract. Requires being a group leader or 'contracts:manage' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: revokeSignatureResponseSchema,
            description: "Signature revoked",
        })
        .notFound({ description: "Signature not found" })
        .forbidden()
        .unauthorized()
        .build(),
    requireAuth,
    requireAccess({
        permission: "contracts:manage",
        scope: (c) => `group:${c.req.param("groupSlug")}`,
        ownership: { param: "groupSlug", check: isGroupLeader },
    }),
    async (c) => {
        const userId = c.req.param("userId");
        const { db } = c.get("ctx");

        const activeContract = await db.query.contract.findFirst({
            where: eq(schema.contract.isActive, true),
        });

        if (!activeContract) {
            throw new HTTPException(404, { message: "No active contract" });
        }

        const deleted = await db
            .delete(schema.contractSignature)
            .where(
                and(
                    eq(schema.contractSignature.contractId, activeContract.id),
                    eq(schema.contractSignature.userId, userId),
                ),
            )
            .returning();

        if (deleted.length === 0) {
            throw new HTTPException(404, { message: "Signature not found" });
        }

        return c.json({ message: "Signature revoked" }, 200);
    },
);
```

- [ ] **Step 3: Typecheck**

```bash
bun run typecheck
```

Expected: PASS

---

### Task 11: Update group schema, wire contracts router into app

**Files:**

- Modify: `apps/api/src/routes/groups/schema.ts`
- Create: `apps/api/src/routes/contracts/index.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Add contract fields to `updateGroupSchema`**

In `apps/api/src/routes/groups/schema.ts`, inside `updateGroupSchema`'s `z.object({...})`, add after `finesAdminId`:

```typescript
        contractSigningRequired: z.boolean().optional().meta({
            description: "Whether contract signing is required for group members",
        }),
        contractNotificationEmail: z
            .string()
            .email()
            .max(200)
            .optional()
            .nullable()
            .meta({
                description: "Email to notify when a member signs the contract. Defaults to group contact email then leader email.",
            }),
```

- [ ] **Step 2: Add contract fields to `groupSchema` (response)**

In `groupSchema`'s `z.object({...})`, add after `finesAdminId`:

```typescript
        contractSigningRequired: z.boolean().meta({
            description: "Whether contract signing is required",
        }),
        contractNotificationEmail: z
            .string()
            .nullable()
            .meta({ description: "Contract notification email" }),
```

- [ ] **Step 3: Create the contracts router**

`apps/api/src/routes/contracts/index.ts`:

```typescript
import { route } from "~/lib/route";
import { activateContractRoute } from "./activate";
import { createContractRoute } from "./create";
import { getActiveContractRoute } from "./get-active";
import { groupSignaturesRoute } from "./group-signatures";
import { listContractsRoute } from "./list";
import { mySignatureRoute } from "./my-signature";
import { revokeSignatureRoute } from "./revoke-signature";
import { signContractRoute } from "./sign";

export const contractsRoutes = route()
    .route("/", getActiveContractRoute)
    .route("/", mySignatureRoute)
    .route("/", signContractRoute)
    .route("/", listContractsRoute)
    .route("/", createContractRoute)
    .route("/", activateContractRoute)
    .route("/", groupSignaturesRoute)
    .route("/", revokeSignatureRoute);
```

- [ ] **Step 4: Register in `app.ts`**

In `apps/api/src/app.ts`, add the import:

```typescript
import { contractsRoutes } from "./routes/contracts";
```

Then in the `.route()` chain after `.route("/groups", groupsRoutes)`:

```typescript
        .route("/contracts", contractsRoutes)
```

- [ ] **Step 5: Full backend typecheck**

```bash
bun run typecheck
```

Expected: PASS

- [ ] **Step 6: Commit backend**

```bash
git add packages/db/src/schema/org.ts packages/auth/src/rbac/permissions/registry.ts packages/email/src/template/ apps/api/src/routes/contracts/ apps/api/src/routes/groups/schema.ts apps/api/src/app.ts packages/db/drizzle/
git commit -m "feat: contract signing backend — DB schema, RBAC, API routes, email"
```

---

## Phase 2: SDK Regeneration

### Task 12: Regenerate SDK types

The SDK in `packages/sdk/src/generated/` is auto-generated from the backend OpenAPI spec. After adding new routes, regenerate it.

- [ ] **Step 1: Build the project to regenerate the SDK**

```bash
bun run build
```

Expected: Build completes. `packages/sdk/src/generated/openapi.ts` and `packages/sdk/src/generated/schemas.ts` now include `Contract`, `ActiveContract`, `SignatureStatus`, `CreateContract`, `GroupSignatureList`, `GroupSignatureMember`, `SignContractResponse`, `ActivateContractResponse`, `RevokeSignatureResponse` types. The `Group` type now includes `contractSigningRequired` and `contractNotificationEmail`.

- [ ] **Step 2: Typecheck the whole monorepo**

```bash
bun run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit SDK**

```bash
git add packages/sdk/src/generated/
git commit -m "chore: regenerate SDK with contract signing types"
```

---

## Phase 3: Frontend

### Task 13: Contract API query helpers

**Files:**

- Create: `apps/kvark/src/api/queries/contracts.ts`

- [ ] **Step 1: Write the query and mutation helpers**

```typescript
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { apiClient } from "#/api/api-client";
import { CreateContract } from "@tihlde/sdk";

const ContractQueryKeys = {
    active: ["contracts", "active"] as const,
    mySignature: ["contracts", "my-signature"] as const,
    list: ["contracts", "list"] as const,
    groupSignatures: ["contracts", "group-signatures"] as const,
} as const;

export const getActiveContractQuery = () =>
    queryOptions({
        queryKey: [...ContractQueryKeys.active],
        queryFn: () => apiClient.get("/api/contracts/active"),
    });

export const getMySignatureQuery = () =>
    queryOptions({
        queryKey: [...ContractQueryKeys.mySignature],
        queryFn: () => apiClient.get("/api/contracts/my-signature"),
    });

export const getContractsQuery = () =>
    queryOptions({
        queryKey: [...ContractQueryKeys.list],
        queryFn: () => apiClient.get("/api/contracts"),
    });

export const getGroupSignaturesQuery = (groupSlug: string) =>
    queryOptions({
        queryKey: [...ContractQueryKeys.groupSignatures, groupSlug],
        queryFn: () =>
            apiClient.get("/api/contracts/groups/{groupSlug}/signatures", {
                params: { groupSlug },
            }),
    });

export const signContractMutation = mutationOptions({
    mutationFn: () => apiClient.post("/api/contracts/sign", {}),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...ContractQueryKeys.mySignature],
        });
    },
});

export const createContractMutation = mutationOptions({
    mutationFn: ({ data }: { data: CreateContract }) =>
        apiClient.post("/api/contracts", { json: data }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...ContractQueryKeys.list],
        });
    },
});

export const activateContractMutation = mutationOptions({
    mutationFn: ({ id }: { id: string }) =>
        apiClient.patch("/api/contracts/{id}/activate", { params: { id } }),
    onSuccess(_, __, ___, ctx) {
        ctx.client.invalidateQueries({ queryKey: [...ContractQueryKeys.list] });
        ctx.client.invalidateQueries({
            queryKey: [...ContractQueryKeys.active],
        });
        ctx.client.invalidateQueries({
            queryKey: [...ContractQueryKeys.mySignature],
        });
    },
});

export const revokeSignatureMutation = mutationOptions({
    mutationFn: ({
        groupSlug,
        userId,
    }: {
        groupSlug: string;
        userId: string;
    }) =>
        apiClient.delete(
            "/api/contracts/groups/{groupSlug}/signatures/{userId}",
            { params: { groupSlug, userId } },
        ),
    onSuccess(_, vars, __, ctx) {
        ctx.client.invalidateQueries({
            queryKey: [...ContractQueryKeys.groupSignatures, vars.groupSlug],
            exact: false,
        });
    },
});
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
```

Expected: PASS

---

### Task 14: Profile page — wire membership tab with contract section

**Files:**

- Modify: `apps/kvark/src/routes/_app/profil.me.tsx`

The current page renders the overview content regardless of sidebar selection. We need to:

1. Switch content based on `active`
2. Add a `MembershipSection` that fetches real data + shows contract status

- [ ] **Step 1: Add new imports**

At the top of `profil.me.tsx`, add these imports after existing ones:

```typescript
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { getMyGroupsQuery } from "#/api/queries/groups";
import {
    getActiveContractQuery,
    getMySignatureQuery,
} from "#/api/queries/contracts";
```

- [ ] **Step 2: Replace static section with conditional rendering**

In `ProfilePage`, replace the `<section>` block:

```tsx
// BEFORE:
<section className="flex flex-col gap-6">
    <OverviewHeader />
    <StatGrid stats={STATS} />
    <UpcomingSection events={UPCOMING} />
    <TodoSection todos={TODOS} />
</section>

// AFTER:
<section className="flex flex-col gap-6">
    {active === "oversikt" && (
        <>
            <OverviewHeader />
            <StatGrid stats={STATS} />
            <UpcomingSection events={UPCOMING} />
            <TodoSection todos={TODOS} />
        </>
    )}
    {active === "medlemskap" && (
        <Suspense fallback={<MembershipSkeleton />}>
            <MembershipSection />
        </Suspense>
    )}
</section>
```

- [ ] **Step 3: Add `MembershipSkeleton` component**

```tsx
function MembershipSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
        </div>
    );
}
```

- [ ] **Step 4: Add `MembershipSection` container**

```tsx
function MembershipSection() {
    const { data: groups } = useSuspenseQuery(getMyGroupsQuery());
    const { data: signatureStatus } = useSuspenseQuery(getMySignatureQuery());
    const { data: activeContract } = useSuspenseQuery(getActiveContractQuery());

    const requiringGroups = groups.filter((g) => g.contractSigningRequired);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl">Medlemskap</h2>
                <p className="text-sm text-muted-foreground">
                    Dine aktive gruppemedlemskap
                </p>
            </div>

            {requiringGroups.length > 0 && activeContract && (
                <ContractSigningBanner
                    groupNames={requiringGroups.map((g) => g.name)}
                    hasSigned={signatureStatus.hasSigned}
                    signedAt={signatureStatus.signedAt}
                />
            )}

            <div className="flex flex-col gap-3">
                <h3 className="text-xs text-muted-foreground">
                    AKTIVE GRUPPER
                </h3>
                {groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Du er ikke medlem av noen grupper.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {groups.map((group) => (
                            <li key={group.slug}>
                                <Card
                                    size="sm"
                                    className="flex-row items-center gap-3"
                                >
                                    <div className="ml-3 flex min-w-0 flex-1 flex-col">
                                        <span className="font-medium">
                                            {group.name}
                                        </span>
                                        <span className="text-sm text-muted-foreground capitalize">
                                            {group.membership.role}
                                        </span>
                                    </div>
                                    {group.contractSigningRequired && (
                                        <div className="pr-3">
                                            <Badge
                                                variant="outline"
                                                className="gap-1.5"
                                            >
                                                <FileText />
                                                Kontrakt
                                            </Badge>
                                        </div>
                                    )}
                                </Card>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 5: Add `ContractSigningBanner` component**

```tsx
type ContractSigningBannerProps = {
    groupNames: string[];
    hasSigned: boolean;
    signedAt: string | null;
};

function ContractSigningBanner({
    groupNames,
    hasSigned,
    signedAt,
}: ContractSigningBannerProps) {
    if (hasSigned) {
        const date = signedAt
            ? new Date(signedAt).toLocaleDateString("nb-NO")
            : null;
        return (
            <Alert>
                <CheckCircle2 className="size-4" />
                <AlertTitle>Frivillighetskontrakt signert</AlertTitle>
                <AlertDescription>
                    {date ? `Signert ${date}.` : "Kontrakten er signert."}
                </AlertDescription>
            </Alert>
        );
    }

    const groupList = groupNames.join(", ");
    return (
        <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Frivillighetskontrakt mangler</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
                <span>
                    Siden du er medlem av {groupList} må du signere
                    frivillighetskontrakten.
                </span>
                <div>
                    <Button asChild size="sm">
                        <Link to="/kontrakt">Gå til signering</Link>
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
    );
}
```

- [ ] **Step 6: Typecheck**

```bash
bun run typecheck
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/kvark/src/routes/_app/profil.me.tsx apps/kvark/src/api/queries/contracts.ts
git commit -m "feat: profile membership tab — groups list + contract signing status"
```

---

### Task 15: Contract signing page

**Files:**

- Create: `apps/kvark/src/routes/_app/kontrakt.tsx`

- [ ] **Step 1: Write the signing page**

```tsx
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
    useSuspenseQuery,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { CheckCircle2, ScrollText } from "lucide-react";
import {
    getActiveContractQuery,
    getMySignatureQuery,
    signContractMutation,
} from "#/api/queries/contracts";

export const Route = createFileRoute("/_app/kontrakt")({
    component: ContractPage,
});

function ContractPage() {
    return (
        <div className="container mx-auto max-w-3xl px-4 py-8">
            <Suspense fallback={<ContractSkeleton />}>
                <ContractContent />
            </Suspense>
        </div>
    );
}

function ContractSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-[60vh] w-full" />
            <Skeleton className="h-10 w-36" />
        </div>
    );
}

function ContractContent() {
    const { data: contract } = useSuspenseQuery(getActiveContractQuery());
    const { data: signatureStatus } = useSuspenseQuery(getMySignatureQuery());
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [hasScrolled, setHasScrolled] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);

    const sign = useMutation({
        mutationFn: signContractMutation.mutationFn,
        onSuccess: async () => {
            queryClient.invalidateQueries({
                queryKey: ["contracts", "my-signature"],
            });
            await navigate({ to: "/profil/me" });
        },
    });

    // Enable sign button when the sentinel div (below the PDF) enters the viewport
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || signatureStatus.hasSigned) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setHasScrolled(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.5 },
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [signatureStatus.hasSigned]);

    if (signatureStatus.hasSigned) {
        const date = signatureStatus.signedAt
            ? new Date(signatureStatus.signedAt).toLocaleDateString("nb-NO")
            : null;
        return (
            <div className="flex flex-col items-center gap-4 py-12">
                <CheckCircle2 className="size-12" />
                <h1 className="text-2xl">Kontrakten er signert</h1>
                <p className="text-sm text-muted-foreground">
                    {date
                        ? `Du signerte frivillighetskontrakten ${date}.`
                        : "Du har allerede signert frivillighetskontrakten."}
                </p>
                <Button asChild variant="outline">
                    <Link to="/profil/me">Tilbake til profil</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl">Frivillighetskontrakt</h1>
                <p className="text-sm text-muted-foreground">
                    {contract.title} · Versjon {contract.version}
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ScrollText className="size-5" />
                        Les gjennom kontrakten
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <iframe
                        src={contract.downloadUrl}
                        title="Frivillighetskontrakt"
                        className="w-full rounded-b-lg"
                        style={{ height: "65vh", border: "none" }}
                    />
                </CardContent>
            </Card>

            {/* Sentinel: becomes visible after the user scrolls past the PDF card */}
            <div ref={sentinelRef} className="flex flex-col gap-3">
                {!hasScrolled && (
                    <p className="text-sm text-muted-foreground">
                        Scroll gjennom hele kontrakten for å låse opp signering.
                    </p>
                )}

                <Button
                    size="lg"
                    disabled={!hasScrolled || sign.isPending}
                    onClick={() => sign.mutate()}
                >
                    {sign.isPending ? "Signerer..." : "Signer kontrakt"}
                </Button>

                {sign.isError && (
                    <p className="text-sm text-destructive">
                        Noe gikk galt. Prøv igjen.
                    </p>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/kvark/src/routes/_app/kontrakt.tsx
git commit -m "feat: contract signing page with scroll-to-unlock"
```

---

### Task 16: Admin opptak — contract document management

**Files:**

- Modify: `apps/kvark/src/routes/admin/opptak.tsx`

Flow: admin uploads PDF via existing `/api/assets` endpoint → gets `fileKey` → fills title/version form → creates contract record → can activate any version.

- [ ] **Step 1: Write the admin contract management page**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { Suspense, useRef, useState } from "react";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Input } from "@tihlde/ui/ui/input";
import { Label } from "@tihlde/ui/ui/label";
import { Badge } from "@tihlde/ui/ui/badge";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import { CheckCircle2, Upload } from "lucide-react";
import { apiClient } from "#/api/api-client";
import {
    getContractsQuery,
    createContractMutation,
    activateContractMutation,
} from "#/api/queries/contracts";

export const Route = createFileRoute("/admin/opptak")({
    component: OpptakPage,
});

function OpptakPage() {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl">Kontraktstyring</h1>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <ContractManagementContent />
            </Suspense>
        </div>
    );
}

type UploadStatus = "idle" | "uploading" | "done" | "error";

function ContractManagementContent() {
    const { data: contracts } = useSuspenseQuery(getContractsQuery());
    const createContract = useMutation(createContractMutation);
    const activateContract = useMutation(activateContractMutation);

    const [title, setTitle] = useState("");
    const [version, setVersion] = useState("");
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
    const [fileKey, setFileKey] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    async function handleFileUpload(file: File) {
        setUploadStatus("uploading");
        setFileKey(null);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const result = await apiClient.post("/api/assets", {
                body: formData,
            });
            setFileKey(result.key);
            setUploadStatus("done");
            console.log("PDF uploaded, key:", result.key);
        } catch (err) {
            console.error("PDF upload failed:", err);
            setUploadStatus("error");
        }
    }

    function handleCreate() {
        if (!title || !version || !fileKey) return;
        createContract.mutate(
            { data: { title, version, fileKey } },
            {
                onSuccess: () => {
                    setTitle("");
                    setVersion("");
                    setFileKey(null);
                    setUploadStatus("idle");
                    if (fileRef.current) fileRef.current.value = "";
                },
            },
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Last opp ny kontraktversjon</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="contract-title">Tittel</Label>
                        <Input
                            id="contract-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Frivillighetskontrakt 2026"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="contract-version">Versjon</Label>
                        <Input
                            id="contract-version"
                            value={version}
                            onChange={(e) => setVersion(e.target.value)}
                            placeholder="2026-01"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="contract-file">PDF-fil</Label>
                        <div className="flex items-center gap-3">
                            <Input
                                id="contract-file"
                                ref={fileRef}
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file);
                                }}
                            />
                            {uploadStatus === "uploading" && (
                                <span className="shrink-0 text-sm text-muted-foreground">
                                    Laster opp…
                                </span>
                            )}
                            {uploadStatus === "done" && (
                                <CheckCircle2 className="size-5 shrink-0" />
                            )}
                            {uploadStatus === "error" && (
                                <span className="shrink-0 text-sm text-destructive">
                                    Feil
                                </span>
                            )}
                        </div>
                    </div>
                    <Button
                        onClick={handleCreate}
                        disabled={
                            !title ||
                            !version ||
                            !fileKey ||
                            createContract.isPending
                        }
                    >
                        <Upload />
                        {createContract.isPending
                            ? "Oppretter…"
                            : "Opprett kontrakt"}
                    </Button>
                    {createContract.isError && (
                        <p className="text-sm text-destructive">
                            Noe gikk galt. Prøv igjen.
                        </p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Kontraktversjoner</CardTitle>
                </CardHeader>
                <CardContent>
                    {contracts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Ingen kontrakter lastet opp ennå.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tittel</TableHead>
                                    <TableHead>Versjon</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Opprettet</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {contracts.map((contract) => (
                                    <TableRow key={contract.id}>
                                        <TableCell className="font-medium">
                                            {contract.title}
                                        </TableCell>
                                        <TableCell>
                                            {contract.version}
                                        </TableCell>
                                        <TableCell>
                                            {contract.isActive ? (
                                                <Badge>Aktiv</Badge>
                                            ) : (
                                                <Badge variant="outline">
                                                    Inaktiv
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(
                                                contract.createdAt,
                                            ).toLocaleDateString("nb-NO")}
                                        </TableCell>
                                        <TableCell>
                                            {!contract.isActive && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={
                                                        activateContract.isPending
                                                    }
                                                    onClick={() =>
                                                        activateContract.mutate(
                                                            {
                                                                id: contract.id,
                                                            },
                                                        )
                                                    }
                                                >
                                                    Aktiver
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/kvark/src/routes/admin/opptak.tsx
git commit -m "feat: admin contract management page (upload, activate, list)"
```

---

### Task 17: Admin grupper — group contract settings + member signing status

**Files:**

- Modify: `apps/kvark/src/routes/admin/grupper.tsx`

Shows groups the user leads. Per group: toggle `contractSigningRequired`, set notification email, view member signing status, revoke signatures.

- [ ] **Step 1: Write the admin groups contract settings page**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Input } from "@tihlde/ui/ui/input";
import { Label } from "@tihlde/ui/ui/label";
import { Switch } from "@tihlde/ui/ui/switch";
import { Badge } from "@tihlde/ui/ui/badge";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@tihlde/ui/ui/accordion";
import { getMyGroupsQuery, updateGroupMutation } from "#/api/queries/groups";
import {
    getGroupSignaturesQuery,
    revokeSignatureMutation,
} from "#/api/queries/contracts";

export const Route = createFileRoute("/admin/grupper")({
    component: GrupperPage,
});

function GrupperPage() {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl">Grupper — Kontraktinnstillinger</h1>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <GroupContractSettingsContent />
            </Suspense>
        </div>
    );
}

function GroupContractSettingsContent() {
    const { data: groups } = useSuspenseQuery(getMyGroupsQuery());
    const leaderGroups = groups.filter((g) => g.membership.role === "leader");

    if (leaderGroups.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Du er ikke leder for noen grupper.
            </p>
        );
    }

    return (
        <Accordion type="single" collapsible className="flex flex-col gap-1">
            {leaderGroups.map((group) => (
                <AccordionItem
                    key={group.slug}
                    value={group.slug}
                    className="border rounded-lg px-4"
                >
                    <AccordionTrigger>
                        <div className="flex items-center gap-3">
                            <span className="font-medium">{group.name}</span>
                            {group.contractSigningRequired && (
                                <Badge variant="secondary">
                                    Kontrakt aktiv
                                </Badge>
                            )}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <Suspense
                            fallback={<Skeleton className="h-48 w-full" />}
                        >
                            <GroupContractPanel
                                slug={group.slug}
                                name={group.name}
                                contactEmail={group.contactEmail}
                                contractSigningRequired={
                                    group.contractSigningRequired
                                }
                                contractNotificationEmail={
                                    group.contractNotificationEmail
                                }
                            />
                        </Suspense>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}

type GroupContractPanelProps = {
    slug: string;
    name: string;
    contactEmail: string | null;
    contractSigningRequired: boolean;
    contractNotificationEmail: string | null;
};

function GroupContractPanel({
    slug,
    name,
    contactEmail,
    contractSigningRequired,
    contractNotificationEmail,
}: GroupContractPanelProps) {
    const { data: signatures } = useSuspenseQuery(
        getGroupSignaturesQuery(slug),
    );
    const updateGroup = useMutation(updateGroupMutation);
    const revokeSignature = useMutation(revokeSignatureMutation);

    const [notificationEmail, setNotificationEmail] = useState(
        contractNotificationEmail ?? contactEmail ?? "",
    );

    function handleToggle(checked: boolean) {
        updateGroup.mutate({
            slug,
            data: { contractSigningRequired: checked },
        });
    }

    function handleSaveEmail() {
        updateGroup.mutate({
            slug,
            data: {
                contractNotificationEmail: notificationEmail.trim() || null,
            },
        });
    }

    return (
        <div className="flex flex-col gap-6 pb-4 pt-2">
            <Card>
                <CardContent className="flex flex-col gap-4 pt-4">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <Label>Krev frivillighetskontrakt</Label>
                            <span className="text-sm text-muted-foreground">
                                Medlemmer må signere kontrakten
                            </span>
                        </div>
                        <Switch
                            checked={contractSigningRequired}
                            onCheckedChange={handleToggle}
                            disabled={updateGroup.isPending}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>Varslings-epost</Label>
                        <span className="text-sm text-muted-foreground">
                            Sendes hit når et medlem signerer. Tomt = bruker
                            gruppens kontaktepost.
                        </span>
                        <div className="flex gap-2">
                            <Input
                                type="email"
                                value={notificationEmail}
                                onChange={(e) =>
                                    setNotificationEmail(e.target.value)
                                }
                                placeholder={contactEmail ?? "epost@tihlde.org"}
                            />
                            <Button
                                variant="outline"
                                onClick={handleSaveEmail}
                                disabled={updateGroup.isPending}
                            >
                                Lagre
                            </Button>
                        </div>
                        {updateGroup.isError && (
                            <p className="text-sm text-destructive">
                                Lagring feilet. Prøv igjen.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        Signeringsstatus
                        <Badge variant="outline">
                            {signatures.signedCount}/{signatures.totalMembers}{" "}
                            signert
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {signatures.members.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Ingen medlemmer i gruppen.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bruker-ID</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Dato</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {signatures.members.map((member) => (
                                    <TableRow key={member.userId}>
                                        <TableCell className="font-mono text-sm">
                                            {member.userId}
                                        </TableCell>
                                        <TableCell>
                                            {member.hasSigned ? (
                                                <Badge>Signert</Badge>
                                            ) : (
                                                <Badge variant="destructive">
                                                    Ikke signert
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {member.signedAt
                                                ? new Date(
                                                      member.signedAt,
                                                  ).toLocaleDateString("nb-NO")
                                                : "—"}
                                        </TableCell>
                                        <TableCell>
                                            {member.hasSigned && (
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    disabled={
                                                        revokeSignature.isPending
                                                    }
                                                    onClick={() =>
                                                        revokeSignature.mutate({
                                                            groupSlug: slug,
                                                            userId: member.userId,
                                                        })
                                                    }
                                                >
                                                    Trekk tilbake
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
```

Expected: PASS

- [ ] **Step 3: Final lint + format**

```bash
bun run lint:fix && bun run format:fix
```

Expected: No errors

- [ ] **Step 4: Full typecheck**

```bash
bun run typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/kvark/src/routes/admin/grupper.tsx
git commit -m "feat: group contract settings and member signing status in admin"
```

---

## Spec Coverage Checklist

| Requirement                                       | Implemented in                                           |
| ------------------------------------------------- | -------------------------------------------------------- |
| Contract signing prompt in profile membership tab | Task 14 `ContractSigningBanner`                          |
| Groups listed in prompt (X, Y, Z)                 | Task 14 `requiringGroups.map(g => g.name)`               |
| Link to signing page                              | Task 14 `<Link to="/kontrakt">`                          |
| PDF must be scrolled before sign button           | Task 15 `IntersectionObserver` sentinel                  |
| Sign button creates signature record              | Task 8 `contractSignature` insert                        |
| Email sent to group leaders only                  | Task 8 `enqueueEmail` loop, notification email chain     |
| Default email = leader's email                    | Task 8 fallback chain                                    |
| Per-group contract toggle in group settings       | Task 17 `Switch` → `updateGroupMutation`                 |
| Configurable notification email per group         | Task 17 email input + save                               |
| One global contract (not per-group)               | Single `contract` table, one active at a time            |
| User sees signed status + date                    | Task 14 `ContractSigningBanner` (signed state)           |
| Admin sees who has/hasn't signed                  | Task 17 `GroupContractPanel` signatures table            |
| Admin can revoke signatures                       | Task 17 "Trekk tilbake" + Task 10 `revokeSignatureRoute` |
| Super-admin uploads + manages contract document   | Task 16 `admin/opptak.tsx`                               |
| Contract activated from admin panel               | Task 16 Activate button → Task 9 `activateContractRoute` |
