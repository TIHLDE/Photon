import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { captureAuth } from "~/middleware/auth";
import { motetidEventSchema, slugParamSchema } from "./schema";

export const getRoute = route().get(
    "/events/:slug",
    describeRoute({
        tags: ["motetid"],
        summary: "Get a scheduling event by slug",
        operationId: "getMotetidEvent",
        description:
            "The full availability board for a scheduling event: participants with their slot selections. Publicly readable via the share link; authentication only enriches the viewer info.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: motetidEventSchema,
            description: "OK",
        })
        .notFound({ description: "Event not found" })
        .build(),
    captureAuth,
    validator("param", slugParamSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { slug } = c.req.valid("param");
        const user = c.get("user");

        const event = await db.query.motetidEvent.findFirst({
            where: eq(schema.motetidEvent.slug, slug),
            with: {
                participants: {
                    with: {
                        slots: {
                            columns: { date: true, time: true, status: true },
                        },
                    },
                },
            },
        });

        if (!event) {
            throw new HTTPException(404, { message: "Event not found" });
        }

        const viewerParticipant = user
            ? event.participants.find((p) => p.userId === user.id)
            : undefined;

        return c.json(
            {
                id: event.id,
                slug: event.slug,
                title: event.title,
                dates: [...event.dates].sort(),
                startTime: event.startTime,
                endTime: event.endTime,
                slotDuration: event.slotDuration,
                deadline: event.deadline?.toISOString() ?? null,
                createdAt: event.createdAt.toISOString(),
                participants: event.participants.map((participant) => ({
                    id: participant.id,
                    name: participant.name,
                    userId: participant.userId,
                    slots: participant.slots,
                })),
                viewer: {
                    isAuthenticated: Boolean(user),
                    isOwner: Boolean(user && event.createdById === user.id),
                    participantId: viewerParticipant?.id ?? null,
                    name: viewerParticipant?.name ?? user?.name ?? null,
                },
            },
            200,
        );
    },
);
