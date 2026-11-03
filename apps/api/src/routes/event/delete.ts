import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { releaseAssetUrls } from "~/lib/asset/release";
import { describeRoute } from "~/lib/openapi";
import { requireEventAccess } from "~/lib/event/access";
import { isEventOwner } from "../../lib/event/middleware";
import { route } from "../../lib/route";
import { requireAuth } from "../../middleware/auth";
import { deleteEventResponseSchema } from "./schema";

export const deleteRoute = route().delete(
    "/:eventId",
    describeRoute({
        tags: ["events"],
        summary: "Delete an event",
        operationId: "deleteEvent",
        description:
            "Delete an event by its ID. Event creators can delete their own events. Users with 'events:delete' — globally or for the arranging group — can delete any event they hold it for. This action is irreversible and will remove all associated data, including registrations and feedback. An event with paid or refunded payments, or a checkout still open at Vipps, cannot be deleted.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteEventResponseSchema,
            description: "Event successfully deleted",
        })
        .forbidden({
            description:
                "You must be the event creator or have events:delete permission",
        })
        .notFound({ description: "Event with the specified ID does not exist" })
        .response({
            statusCode: 409,
            description:
                "The event has paid or refunded payments, or a checkout still open at Vipps",
        })
        .build(),
    requireAuth,
    requireEventAccess({
        permission: "events:delete",
        ownership: isEventOwner,
    }),
    async (c) => {
        const { eventId } = c.req.param();
        const ctx = c.get("ctx");
        const { db } = ctx;

        // Check if the event exists
        const event = await db
            .select()
            .from(schema.event)
            .where(eq(schema.event.id, eventId))
            .limit(1)
            .then((res) => res[0]);

        if (!event) {
            return c.json({ message: "Event not found" }, 404);
        }

        await db.transaction(async (tx) => {
            // Payment rows cascade with the event, so this is the last chance to
            // keep them. The locks stop a checkout attaching after the check.
            await tx
                .select({ id: schema.event.id })
                .from(schema.event)
                .where(eq(schema.event.id, eventId))
                .for("update");
            await tx
                .select({ userId: schema.eventRegistration.userId })
                .from(schema.eventRegistration)
                .where(eq(schema.eventRegistration.eventId, eventId))
                .for("update");
            const payments = await tx
                .select({
                    status: schema.eventPayment.status,
                    providerPaymentId: schema.eventPayment.providerPaymentId,
                })
                .from(schema.eventPayment)
                .where(eq(schema.eventPayment.eventId, eventId))
                .for("update");

            if (
                payments.some(
                    (p) => p.status === "paid" || p.status === "refunded",
                )
            ) {
                throw new HTTPException(409, {
                    message:
                        "Arrangementet har betalinger og kan ikke slettes. Betalinger og refusjoner må bevares.",
                });
            }

            if (
                payments.some(
                    (p) => p.status === "pending" && p.providerPaymentId,
                )
            ) {
                throw new HTTPException(409, {
                    message:
                        "Noen er i gang med å betale for arrangementet. Prøv igjen om litt.",
                });
            }

            await tx.delete(schema.event).where(eq(schema.event.id, eventId));
        });

        await releaseAssetUrls(ctx, [event.imageUrl]);

        return c.json(
            {
                message: c.get("isResourceOwner")
                    ? "Your event has been successfully deleted"
                    : "Event successfully deleted",
            },
            200,
        );
    },
);
