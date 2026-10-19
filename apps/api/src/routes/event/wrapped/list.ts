import { schema } from "@photon/db";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { validator } from "hono-openapi";
import type z from "zod";
import { requireEventAccess } from "~/lib/event/access";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { WRAPPED_ARRANGER_PERMISSIONS, submittedOnly } from "~/lib/wrapped";
import { requireAuth } from "~/middleware/auth";
import {
    PaginationSchema,
    getNextPage,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import { eventIdParamSchema, wrappedPhotoListResponseSchema } from "./schema";
import { serializePhoto } from "./serialize";

export const listWrappedPhotosRoute = route().get(
    "/:eventId/wrapped/photos",
    describeRoute({
        tags: ["wrapped"],
        summary: "List the photos taken at an event",
        operationId: "listWrappedPhotos",
        description:
            "Every photo members have submitted from the event's camera, for the organizer to pick from. Drafts are never listed. Requires 'events:update' or 'events:manage', globally or for the arranging group — nobody else sees a photo before it is published.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: wrappedPhotoListResponseSchema,
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
    validator("query", PaginationSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { eventId } = c.req.valid("param");
        const { page, pageSize } = c.req.valid("query");

        // Submitted only, counts included: a draft is the member's alone.
        const where = and(
            eq(schema.wrappedPhoto.eventId, eventId),
            submittedOnly(),
        );
        const [totalCount, selectedCount] = await Promise.all([
            db.$count(schema.wrappedPhoto, where),
            db.$count(
                schema.wrappedPhoto,
                and(where, isNotNull(schema.wrappedPhoto.selectedAt)),
            ),
        ]);
        const totalPages = getTotalPages(totalCount, pageSize);

        /**
         * Oldest first, like the gallery: photos keep arriving while the
         * organizer looks, and this way new ones land at the end instead of
         * reshuffling the grid under their thumb.
         */
        const photos = await db.query.wrappedPhoto.findMany({
            where,
            orderBy: [
                asc(schema.wrappedPhoto.createdAt),
                asc(schema.wrappedPhoto.id),
            ],
            limit: pageSize,
            offset: getPageOffset(page, pageSize),
            with: { uploadedBy: { columns: { id: true, name: true } } },
        });

        return c.json({
            totalCount,
            pages: totalPages,
            nextPage: getNextPage(page, totalPages),
            selectedCount,
            items: photos.map(serializePhoto),
        } satisfies z.infer<typeof wrappedPhotoListResponseSchema>);
    },
);
