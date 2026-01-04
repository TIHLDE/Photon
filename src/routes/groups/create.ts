import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "~/db";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";

const createGroupSchema = z.object({
    slug: z
        .string()
        .min(1)
        .max(128)
        .regex(
            /^[a-z0-9-]+$/,
            "Slug must contain only lowercase letters, numbers, and hyphens",
        )
        .meta({ description: "Unique group slug identifier" }),
    imageUrl: z
        .string()
        .url()
        .max(600)
        .optional()
        .meta({ description: "Group image URL" }),
    name: z.string().min(1).max(128).meta({ description: "Group name" }),
    description: z
        .string()
        .optional()
        .meta({ description: "Group description" }),
    contactEmail: z
        .string()
        .email()
        .max(200)
        .optional()
        .meta({ description: "Group contact email" }),
    type: z.string().max(50).meta({
        description: "Group type (e.g., committee, study, interestgroup)",
    }),
    finesInfo: z
        .string()
        .default("")
        .meta({ description: "Information about group fines policy" }),
    finesActivated: z
        .boolean()
        .default(false)
        .meta({ description: "Whether fines are activated for this group" }),
    finesAdminId: z
        .string()
        .max(255)
        .optional()
        .meta({ description: "User ID of the fines administrator" }),
});

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["groups"],
        summary: "Create group",
        operationId: "createGroup",
        description: "Create a new group. Requires 'groups:create' permission.",
    })
        .response(201, "Group created successfully")
        .badRequest("Invalid input or slug already exists")
        .build(),
    requireAuth,
    requirePermission("groups:create"),
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
