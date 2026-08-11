import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { canManageLaws } from "./permissions";
import { createLawSchema, lawSchema } from "./schema";

export const createLawRoute = route().post(
    "/:groupSlug/laws",
    describeRoute({
        tags: ["laws"],
        summary: "Create a law",
        operationId: "createLaw",
        description:
            "Add a paragraph to a group's lovverk. Requires being the group's fines admin (botsjef) or a group leader.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: lawSchema,
            description: "Law created successfully",
        })
        .forbidden({
            description: "Not authorized to manage laws for this group",
        })
        .notFound({ description: "Group not found" })
        .build(),
    requireAuth,
    validator("json", createLawSchema),
    async (c) => {
        const body = c.req.valid("json");
        const ctx = c.get("ctx");
        const { db } = ctx;
        const groupSlug = c.req.param("groupSlug");
        const user = c.get("user");

        const group = await db
            .select()
            .from(schema.group)
            .where(eq(schema.group.slug, groupSlug))
            .limit(1)
            .then((res) => res[0]);

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${groupSlug}" not found`,
            });
        }

        if (!(await canManageLaws(ctx, user.id, group))) {
            throw new HTTPException(403, {
                message: "Not authorized to manage laws for this group",
            });
        }

        const [newLaw] = await db
            .insert(schema.groupLaw)
            .values({
                groupSlug,
                paragraph: body.paragraph.toFixed(2),
                title: body.title,
                description: body.description ?? "",
                amount: body.amount ?? 1,
            })
            .returning();

        return c.json(newLaw, 201);
    },
);
