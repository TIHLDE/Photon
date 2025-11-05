import { describeRoute, resolver } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { hasPermission } from "~/lib/auth/rbac/permissions";
import { getEventFormWithDetails, userHasSubmitted } from "~/lib/form/service";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

const eventFormDetailResponseSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    type: z.enum(["survey", "evaluation"]),
    resource_type: z.string(),
    viewer_has_answered: z.boolean(),
    website_url: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    fields: z.array(
        z.object({
            id: z.string().uuid(),
            title: z.string(),
            type: z.enum(["text_answer", "multiple_select", "single_select"]),
            required: z.boolean(),
            order: z.number(),
            options: z.array(
                z.object({
                    id: z.string().uuid(),
                    title: z.string(),
                    order: z.number(),
                }),
            ),
        }),
    ),
});

export const getEventFormRoute = route().get(
    "/:eventId/forms/:type",
    describeRoute({
        tags: ["events", "forms"],
        summary: "Get event form",
        description:
            "Get a specific form (survey or evaluation) for an event with all fields and options",
        responses: {
            200: {
                description: "Success",
                content: {
                    "application/json": {
                        schema: resolver(eventFormDetailResponseSchema),
                    },
                },
            },
            403: {
                description: "Forbidden - Evaluation forms require attendance",
            },
            404: {
                description: "Form not found",
            },
        },
    }),
    requireAuth,
    async (c) => {
        const { db, ...ctx } = c.get("ctx");
        const user = c.get("user");
        const eventId = c.req.param("eventId");
        const formType = c.req.param("type") as "survey" | "evaluation";

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        // Validate type
        if (formType !== "survey" && formType !== "evaluation") {
            throw new HTTPException(400, {
                message: "Invalid form type. Must be 'survey' or 'evaluation'",
            });
        }

        // Get event form
        const eventFormData = await getEventFormWithDetails(
            db,
            eventId,
            formType,
        );

        if (!eventFormData) {
            throw new HTTPException(404, {
                message: `No ${formType} form found for this event`,
            });
        }

        // For evaluation forms, check if user attended or is organizer
        if (formType === "evaluation") {
            const hasEventsManage = await hasPermission(
                { db, ...ctx },
                user.id,
                "events:manage",
            );

            const registration = await db.query.eventRegistration.findFirst({
                where: (reg, { and, eq }) =>
                    and(eq(reg.eventId, eventId), eq(reg.userId, user.id)),
            });

            const isAttendee = registration?.status === "attended";

            if (!hasEventsManage && !isAttendee) {
                throw new HTTPException(403, {
                    message:
                        "You must have attended the event to access the evaluation",
                });
            }
        }

        const hasAnswered = await userHasSubmitted(
            db,
            eventFormData.form.id,
            user.id,
        );

        return c.json({
            id: eventFormData.form.id,
            title: eventFormData.form.title,
            description: eventFormData.form.description,
            type: eventFormData.type,
            resource_type: "EventForm",
            viewer_has_answered: hasAnswered,
            website_url: `/sporreskjema/${eventFormData.form.id}/`,
            created_at: eventFormData.form.createdAt.toISOString(),
            updated_at: eventFormData.form.updatedAt.toISOString(),
            fields: eventFormData.form.fields.map((field) => ({
                id: field.id,
                title: field.title,
                type: field.type,
                required: field.required,
                order: field.order,
                options: field.options.map((opt) => ({
                    id: opt.id,
                    title: opt.title,
                    order: opt.order,
                })),
            })),
        });
    },
);
