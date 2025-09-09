import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db from "~/db";
import { requireAuth } from "~/middleware/auth";
import { requirePermissions } from "~/middleware/permission";
import { eventFeedback } from "~/db/schema/events";
import { and, eq } from "drizzle-orm";

export const updateFeedbackRoute = new Hono();

const paramsSchema = z.object({
    id: z.uuid({ version: "v4" }),
    feedbackId: z.uuid({ version: "v4" }),
});
const bodySchema = z
    .object({
        rating: z.number().int().min(1).max(5).nullable().optional(),
        comment: z.string().max(2000).nullable().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, {
        message: "Provide at least one field",
    });
const feedbackSchema = z.object({
    id: z.uuid({ version: "v4" }),
    eventId: z.uuid({ version: "v4" }),
    userId: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    comment: z.string().nullable().optional(),
    createdAt: z.iso.datetime(),
});

updateFeedbackRoute.patch(
    "/:feedbackId",
    describeRoute({
        tags: ["events - feedback"],
        summary: "Update feedback",
        responses: {
            200: {
                description: "Updated",
                content: {
                    "application/json": { schema: resolver(feedbackSchema) },
                },
            },
            404: { description: "Not found" },
        },
    }),
    requireAuth,
    requirePermissions("events:feedback:update"),
    validator("param", paramsSchema),
    validator("json", bodySchema),
    async (c) => {
        const { id, feedbackId } = c.req.valid("param");
        const body = c.req.valid("json");
        const [updated] = await db
            .update(eventFeedback)
            .set({
                rating: body.rating ?? undefined,
                comment: body.comment ?? undefined,
            })
            .where(
                and(
                    eq(eventFeedback.id, feedbackId),
                    eq(eventFeedback.eventId, id),
                ),
            )
            .returning();
        if (!updated) return c.body(null, 404);
        return c.json(updated);
    },
);
