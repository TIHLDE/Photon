import { schema } from "@photon/db";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { validator } from "hono-openapi";
import type z from "zod";
import { requireEventAccess } from "~/lib/event/access";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { WRAPPED_ARRANGER_PERMISSIONS, submittedOnly } from "~/lib/wrapped";
import { requireAuth } from "~/middleware/auth";
import {
    eventIdParamSchema,
    selectAllWrappedPhotosResponseSchema,
    selectAllWrappedPhotosSchema,
} from "./schema";

export const selectAllWrappedPhotosRoute = route().put(
    "/:eventId/wrapped/photos/selection",
    describeRoute({
        tags: ["wrapped"],
        summary: "Pick every photo, or clear the selection",
        operationId: "selectAllWrappedPhotos",
        description:
            "Pick every photo submitted at the event, or take them all out of the selection, in one go. Drafts are never touched, and a photo that was already picked keeps the time it was picked. Requires 'events:update' or 'events:manage', globally or for the arranging group.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: selectAllWrappedPhotosResponseSchema,
            description: "OK",
        })
        .forbidden({
            description: "Requires events:update or events:manage permission",
        })
        .build(),
    requireAuth,
    // Before the access check, which would otherwise hand Postgres an id
    // that is not a uuid.
    validator("param", eventIdParamSchema),
    requireEventAccess({ permission: WRAPPED_ARRANGER_PERMISSIONS }),
    validator("json", selectAllWrappedPhotosSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { eventId } = c.req.valid("param");
        const { selected } = c.req.valid("json");

        const where = and(
            eq(schema.wrappedPhoto.eventId, eventId),
            submittedOnly(),
        );

        // Only the photos whose state changes, so a picked photo keeps the
        // time it was first chosen.
        await db
            .update(schema.wrappedPhoto)
            .set({ selectedAt: selected ? new Date() : null })
            .where(
                and(
                    where,
                    selected
                        ? isNull(schema.wrappedPhoto.selectedAt)
                        : isNotNull(schema.wrappedPhoto.selectedAt),
                ),
            );

        const [totalCount, selectedCount] = await Promise.all([
            db.$count(schema.wrappedPhoto, where),
            db.$count(
                schema.wrappedPhoto,
                and(where, isNotNull(schema.wrappedPhoto.selectedAt)),
            ),
        ]);

        c.get("logger").info(
            { eventId, selected, selectedCount },
            "Wrapped photo selection changed for every photo",
        );

        return c.json({
            totalCount,
            selectedCount,
        } satisfies z.infer<typeof selectAllWrappedPhotosResponseSchema>);
    },
);
