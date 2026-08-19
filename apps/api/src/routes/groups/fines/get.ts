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
            "Retrieve detailed information about a specific fine. Group members can view every fine in their own group, and the fines admin and root can view any. Anyone party to a fine — the member who received it and the one who handed it out — can always view it, membership or not.",
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

        /**
         * Check authorization: a fine you are party to, membership in the
         * group (Lepton parity), the fines admin, or root.
         *
         * Party is both ends of the bot — the member who got it and the one
         * who wrote it. Neither loses sight of it by leaving the group: the
         * receiver still owes it, and the giver still has to answer for it.
         */
        const isParty =
            fine.userId === user.id || fine.createdByUserId === user.id;

        if (!isParty && !(await canViewFines(ctx, user.id, group))) {
            throw new HTTPException(403, {
                message: "Not authorized to view this fine",
            });
        }

        return c.json(serializeFineLaw(fine));
    },
);
