import { schema } from "@photon/db";
import { desc, eq, inArray, or } from "drizzle-orm";
import { normalizeDates } from "~/lib/motetid/time";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { motetidEventListSchema } from "./schema";

export const listRoute = route().get(
    "/events",
    describeRoute({
        tags: ["motetid"],
        summary: "List your scheduling events",
        operationId: "listMotetidEvents",
        description:
            "Every scheduling event the authenticated member created or participates in, newest first.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: motetidEventListSchema,
            description: "OK",
        })
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;

        const participations = await db
            .select({ eventId: schema.motetidParticipant.eventId })
            .from(schema.motetidParticipant)
            .where(eq(schema.motetidParticipant.userId, userId));

        const participatingIds = participations.map((p) => p.eventId);

        const events = await db.query.motetidEvent.findMany({
            where: participatingIds.length
                ? or(
                      eq(schema.motetidEvent.createdById, userId),
                      inArray(schema.motetidEvent.id, participatingIds),
                  )
                : eq(schema.motetidEvent.createdById, userId),
            orderBy: [desc(schema.motetidEvent.createdAt)],
            with: {
                participants: { columns: { id: true } },
            },
        });

        return c.json(
            events.map((event) => ({
                id: event.id,
                slug: event.slug,
                title: event.title,
                dateMode: event.dateMode,
                dates: normalizeDates(event.dates, event.dateMode),
                startTime: event.startTime,
                endTime: event.endTime,
                deadline: event.deadline?.toISOString() ?? null,
                createdAt: event.createdAt.toISOString(),
                isOwner: event.createdById === userId,
                participantCount: event.participants.length,
            })),
            200,
        );
    },
);
