import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { isValidUUID } from "~/lib/validation/uuid";
import { requireAuth } from "~/middleware/auth";
import { canManageLaws } from "./permissions";
import { lawSchema, updateLawSchema } from "./schema";

export const updateLawRoute = route().patch(
    "/:groupSlug/laws/:lawId",
    describeRoute({
        tags: ["laws"],
        summary: "Update a law",
        operationId: "updateLaw",
        description:
            "Update a paragraph in a group's lovverk. Requires being the group's fines admin (botsjef) or a group leader.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: lawSchema,
            description: "Law updated successfully",
        })
        .forbidden({
            description: "Not authorized to manage laws for this group",
        })
        .notFound({ description: "Law or group not found" })
        .build(),
    requireAuth,
    validator("json", updateLawSchema),
    async (c) => {
        const body = c.req.valid("json");
        const ctx = c.get("ctx");
        const { db } = ctx;
        const groupSlug = c.req.param("groupSlug");
        const lawId = c.req.param("lawId");
        const user = c.get("user");

        if (!isValidUUID(lawId)) {
            throw new HTTPException(404, {
                message: `Law with ID "${lawId}" not found`,
            });
        }

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

        const [updated] = await db
            .update(schema.groupLaw)
            .set({
                ...(body.paragraph !== undefined && {
                    paragraph: body.paragraph.toFixed(2),
                }),
                ...(body.title !== undefined && { title: body.title }),
                ...(body.description !== undefined && {
                    description: body.description,
                }),
                ...(body.amount !== undefined && { amount: body.amount }),
            })
            .where(
                and(
                    eq(schema.groupLaw.id, lawId),
                    eq(schema.groupLaw.groupSlug, groupSlug),
                ),
            )
            .returning();

        if (!updated) {
            throw new HTTPException(404, {
                message: `Law with ID "${lawId}" not found`,
            });
        }

        return c.json(updated);
    },
);
