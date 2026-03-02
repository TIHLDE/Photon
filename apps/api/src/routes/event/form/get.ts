import { hasPermission } from "@photon/auth/rbac";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { getEventFormWithDetails, userHasSubmitted } from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { eventFormDetailSchema, eventFormParamsSchema } from "./schema";

export const getEventFormRoute = route().get(
    "/:eventId/forms/:type",
    describeRoute({
        tags: ["events", "forms"],
        summary: "Get event form",
        operationId: "getEventForm",
        description:
            "Get a specific form (survey or evaluation) for an event with all fields and options",
    })
        .schemaResponse({
            statusCode: 200,
            schema: eventFormDetailSchema,
            description: "Success",
        })
        .forbidden({ description: "Evaluation forms require attendance" })
        .notFound({ description: "Form not found" })
        .build(),
    requireAuth,
    validator("param", eventFormParamsSchema),
    async (c) => {
        const { db, ...ctx } = c.get("ctx");
        const user = c.get("user");
        const { eventId, type: formType } = c.req.valid("param");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
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
