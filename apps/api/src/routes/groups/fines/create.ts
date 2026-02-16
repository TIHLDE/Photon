import { requireAccess, requireAuth } from "@photon/auth/server";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { isGroupLeader } from "~/lib/group/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

const createFineSchema = z.object({
    userId: z
        .string()
        .max(255)
        .meta({ description: "User ID who receives the fine" }),
    groupSlug: z
        .string()
        .max(128)
        .meta({ description: "Group slug that issues the fine" }),
    reason: z.string().min(1).meta({ description: "Reason for the fine" }),
    amount: z
        .number()
        .int()
        .positive()
        .meta({ description: "Fine amount in NOK" }),
    defense: z.string().optional().meta({ description: "User's defense text" }),
});

export const createFineRoute = route().post(
    "/:groupSlug/fines",
    describeRoute({
        tags: ["fines"],
        summary: "Create fine",
        operationId: "createFine",
        description:
            "Create a new fine for a group member. Requires being a group leader OR having 'fines:create' permission (globally or scoped to this group).",
    })
        .response({ statusCode: 201, description: "Fine created successfully" })
        .badRequest({
            description: "Invalid input or fines not activated for group",
        })
        .forbidden({
            description: "Not authorized to create fines for this group",
        })
        .notFound({ description: "Group or user not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: "fines:create",
        scope: (c) => `group:${c.req.param("groupSlug")}`,
        ownership: { param: "groupSlug", check: isGroupLeader },
    }),
    validator("json", createFineSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db } = c.get("ctx");
        const user = c.get("user");

        // Validate group exists and has fines activated
        const group = await db
            .select()
            .from(schema.group)
            .where(eq(schema.group.slug, body.groupSlug))
            .limit(1)
            .then((res) => res[0]);

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${body.groupSlug}" not found`,
            });
        }

        if (!group.finesActivated) {
            throw new HTTPException(400, {
                message: `Fines are not activated for group "${body.groupSlug}"`,
            });
        }

        // Validate user exists
        const targetUser = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.id, body.userId))
            .limit(1);

        if (targetUser.length === 0) {
            throw new HTTPException(404, {
                message: `User with ID "${body.userId}" not found`,
            });
        }

        // Create the fine
        const [newFine] = await db
            .insert(schema.fine)
            .values({
                ...body,
                createdByUserId: user.id,
                status: "pending",
            })
            .returning();

        return c.json(newFine, 201);
    },
);
