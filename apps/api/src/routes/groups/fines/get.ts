import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { isValidUUID } from "~/lib/validation/uuid";
import { requireAuth } from "~/middleware/auth";
import { canViewFines, requireFinesGroup } from "./permissions";
import { fineSchema } from "./schema";
import { serializeFineLaw } from "./serialize";

export const getFineRoute = route().get(
    "/:groupSlug/fines/:fineId",
    describeRoute({
        tags: ["fines"],
        summary: "Get fine by ID",
        operationId: "getFine",
        description:
            "Retrieve detailed information about a specific fine. Group members can view fines in their own group, users can always view their own fines, and fines admins / 'fines:view' holders can view all fines for the group.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: fineSchema,
            description: "Fine details retrieved successfully",
        })
        .forbidden({ description: "Not authorized to view this fine" })
        .notFound({ description: "Fine or group not found" })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const fineId = c.req.param("fineId");
        const groupSlug = c.req.param("groupSlug");
        const user = c.get("user");

        if (!isValidUUID(fineId)) {
            throw new HTTPException(404, {
                message: `Fine with ID "${fineId}" not found`,
            });
        }

        const group = await requireFinesGroup(ctx, groupSlug);

        // Include public user info (name/image) so the UI can display names
        // instead of user IDs
        const fine = await db.query.fine.findFirst({
            where: eq(schema.fine.id, fineId),
            with: {
                user: {
                    columns: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
                createdByUser: {
                    columns: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
                law: {
                    columns: {
                        id: true,
                        paragraph: true,
                        title: true,
                    },
                },
            },
        });

        if (!fine) {
            throw new HTTPException(404, {
                message: `Fine with ID "${fineId}" not found`,
            });
        }

        if (fine.groupSlug !== groupSlug) {
            throw new HTTPException(404, {
                message: `Fine does not belong to group "${groupSlug}"`,
            });
        }

        // Check authorization: own fine, membership in the group (Lepton
        // parity), fines admin, or fines:view (globally or scoped).
        const isOwner = fine.userId === user.id;

        if (!isOwner && !(await canViewFines(ctx, user.id, group))) {
            throw new HTTPException(403, {
                message: "Not authorized to view this fine",
            });
        }

        return c.json(serializeFineLaw(fine));
    },
);
