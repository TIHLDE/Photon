import { eq } from "drizzle-orm";
import { describeRoute, resolver } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { schema } from "~/db";
import { userHasSubmitted } from "~/lib/form/service";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

const eventFormListResponseSchema = z.array(
    z.object({
        id: z.string().uuid(),
        title: z.string(),
        description: z.string().nullable(),
        type: z.enum(["survey", "evaluation"]),
        resource_type: z.string(),
        viewer_has_answered: z.boolean(),
        created_at: z.string(),
        updated_at: z.string(),
    }),
);

export const listEventFormsRoute = route().get(
    "/:eventId/forms",
    describeRoute({
        tags: ["events", "forms"],
        summary: "List event forms",
        description: "Get all forms (survey and evaluation) for an event",
        responses: {
            200: {
                description: "Success",
                content: {
                    "application/json": {
                        schema: resolver(eventFormListResponseSchema),
                    },
                },
            },
            404: {
                description: "Event not found",
            },
        },
    }),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");
        const user = c.get("user");
        const eventId = c.req.param("eventId");

        // Check if event exists
        const event = await db.query.event.findFirst({
            where: eq(schema.event.id, eventId),
        });

        if (!event) {
            throw new HTTPException(404, {
                message: "Event not found",
            });
        }

        // Get all event forms
        const eventForms = await db.query.formEventForm.findMany({
            where: eq(schema.formEventForm.eventId, eventId),
            with: {
                form: true,
            },
        });

        // Check if user has answered each form
        const formsWithAnswers = await Promise.all(
            eventForms.map(async (eventForm) => {
                const hasAnswered = user
                    ? await userHasSubmitted(db, eventForm.form.id, user.id)
                    : false;

                return {
                    id: eventForm.form.id,
                    title: eventForm.form.title,
                    description: eventForm.form.description,
                    type: eventForm.type,
                    resource_type: "EventForm",
                    viewer_has_answered: hasAnswered,
                    created_at: eventForm.form.createdAt.toISOString(),
                    updated_at: eventForm.form.updatedAt.toISOString(),
                };
            }),
        );

        return c.json(formsWithAnswers);
    },
);
