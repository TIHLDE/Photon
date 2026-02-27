import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { createGroupSchema, groupSchema } from "./schema";

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["groups"],
        summary: "Create group",
        operationId: "createGroup",
        description: "Create a new group. Requires 'groups:create' permission.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: groupSchema,
            description: "Group created successfully",
        })
        .badRequest({ description: "Invalid input or slug already exists" })
        .build(),
    requireAuth,
    requireAccess({ permission: "groups:create" }),
    validator("json", createGroupSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db } = c.get("ctx");

        // Check if slug already exists
        const existingGroup = await db
            .select()
            .from(schema.group)
            .where(eq(schema.group.slug, body.slug))
            .limit(1);

        if (existingGroup.length > 0) {
            throw new HTTPException(400, {
                message: `Group with slug "${body.slug}" already exists`,
            });
        }

        // Validate fines admin if provided
        if (body.finesAdminId) {
            const finesAdmin = await db
                .select()
                .from(schema.user)
                .where(eq(schema.user.id, body.finesAdminId))
                .limit(1);

            if (finesAdmin.length === 0) {
                throw new HTTPException(400, {
                    message: `User with ID "${body.finesAdminId}" does not exist`,
                });
            }
        }

        const [newGroup] = await db
            .insert(schema.group)
            .values(body)
            .returning();

        return c.json(newGroup, 201);
    },
);
