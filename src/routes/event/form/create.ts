import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { schema } from "~/db";
import { hasPermission } from "~/lib/auth/rbac/permissions";
import { createFieldsAndOptions } from "~/lib/form/service";
import { describeAuthenticatedRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { createEventFormSchema } from "../../../lib/form/schema";

export const createEventFormRoute = route().post(
    "/:eventId/forms",
    describeAuthenticatedRoute({
        tags: ["events", "forms"],
        summary: "Create event form",
        operationId: "createEventForm",
        description:
            "Create a survey or evaluation form for an event. Requires event write permission.",
    })
        .response(201, "Created")
        .badRequest("Form already exists for this event type")
        .forbidden("Cant create form for specified event")
        .notFound("Event not found")
        .build(),
    requireAuth,
    validator("json", createEventFormSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db, ...ctx } = c.get("ctx");
        const user = c.get("user");
        const eventId = c.req.param("eventId");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        // Check if event exists
        const event = await db.query.event.findFirst({
            where: eq(schema.event.id, eventId),
        });

        if (!event) {
            throw new HTTPException(404, {
                message: "Event not found",
            });
        }

        // Check permission - must have events:write or be organizer
        const hasEventsWrite = await hasPermission(
            { db, ...ctx },
            user.id,
            "events:write",
        );

        let isOrganizer = false;
        if (event.organizerGroupSlug) {
            const membership = await db.query.groupMembership.findFirst({
                where: (membership, { and, eq }) =>
                    and(
                        eq(
                            membership.groupSlug,
                            event.organizerGroupSlug ?? "",
                        ),
                        eq(membership.userId, user.id),
                        eq(membership.role, "leader"),
                    ),
            });
            isOrganizer = !!membership;
        }

        if (!hasEventsWrite && !isOrganizer) {
            throw new HTTPException(403, {
                message:
                    "You do not have permission to create forms for this event",
            });
        }

        // Check if form already exists for this event type
        const existingEventForm = await db.query.formEventForm.findFirst({
            where: (eventForm, { and, eq }) =>
                and(
                    eq(eventForm.eventId, eventId),
                    eq(eventForm.type, body.type),
                ),
        });

        if (existingEventForm) {
            throw new HTTPException(400, {
                message: `A ${body.type} form already exists for this event`,
            });
        }

        // Create form
        const [form] = await db
            .insert(schema.form)
            .values({
                title: body.title,
                description: body.description,
                isTemplate: false,
            })
            .returning();

        if (!form) {
            throw new HTTPException(500, {
                message: "Failed to create form",
            });
        }

        // Create event form link
        await db.insert(schema.formEventForm).values({
            formId: form.id,
            eventId,
            type: body.type,
        });

        // Create fields and options
        if (body.fields && body.fields.length > 0) {
            await createFieldsAndOptions(db, form.id, body.fields);
        }

        // Fetch complete form
        const createdForm = await db.query.form.findFirst({
            where: eq(schema.form.id, form.id),
            with: {
                fields: {
                    orderBy: (fields, { asc }) => [asc(fields.order)],
                    with: {
                        options: {
                            orderBy: (options, { asc }) => [asc(options.order)],
                        },
                    },
                },
            },
        });

        return c.json(
            {
                id: createdForm?.id,
                title: createdForm?.title,
                description: createdForm?.description,
                type: body.type,
                resource_type: "EventForm",
                created_at: createdForm?.createdAt.toISOString(),
                updated_at: createdForm?.updatedAt.toISOString(),
                fields: createdForm?.fields.map((field) => ({
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
            },
            201,
        );
    },
);
