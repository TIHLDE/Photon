import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { isGroupLeader } from "~/lib/group/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { createFineSchema, fineSchema } from "./schema";
import { serializeFineLaw } from "./serialize";

export const createFineRoute = route().post(
    "/:groupSlug/fines",
    describeRoute({
        tags: ["fines"],
        summary: "Create fine",
        operationId: "createFine",
        description:
            "Create a new fine for a group member. Requires being a group leader OR having 'fines:create' permission (globally or scoped to this group).",
    })
        .schemaResponse({
            statusCode: 201,
            schema: fineSchema,
            description: "Fine created successfully",
        })
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

        /**
         * A paragraph belongs to exactly one group's lovverk. Without this
         * check a fine could cite another group's paragraph — the response
         * would then show a title from a lovverk the members cannot read.
         */
        if (body.lawId) {
            const law = await db
                .select()
                .from(schema.groupLaw)
                .where(eq(schema.groupLaw.id, body.lawId))
                .limit(1)
                .then((res) => res[0]);

            if (!law || law.groupSlug !== body.groupSlug) {
                throw new HTTPException(404, {
                    message: `Law with ID "${body.lawId}" not found in group "${body.groupSlug}"`,
                });
            }
        }

        // Create the fine
        const [created] = await db
            .insert(schema.fine)
            .values({
                ...body,
                createdByUserId: user.id,
                status: "pending",
            })
            .returning();

        if (!created) {
            throw new HTTPException(500, { message: "Failed to create fine" });
        }

        // Re-read with the relations the response schema promises — the insert
        // itself returns the bare row, without user, creator or paragraph.
        const newFine = await db.query.fine.findFirst({
            where: eq(schema.fine.id, created.id),
            with: {
                user: { columns: { id: true, name: true, image: true } },
                createdByUser: {
                    columns: { id: true, name: true, image: true },
                },
                law: { columns: { id: true, paragraph: true, title: true } },
            },
        });

        if (!newFine) {
            throw new HTTPException(500, {
                message: "Fine was created but could not be read back",
            });
        }

        return c.json(serializeFineLaw(newFine), 201);
    },
);
